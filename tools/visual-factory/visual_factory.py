#!/usr/bin/env python3
"""SK7 private candidate intake v0.3. Python 3.10+, standard library only.

Default scan is read-only. Ingest/watch are foreground local tasks. Cloud
backup requires a separately confirmed private target and an explicit flag.
No app runtime, product manifest, repository config or public bucket is edited.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import stat
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

sys.dont_write_bytecode = True

from media_probe import MAX_BYTES, MediaError, inspect_media, sanitize_png  # noqa: E402
from r2_transport import ALLOWED_BUCKET, PREFIX, TransportError, WranglerTransport, validate_target  # noqa: E402

VERSION = "sk7-visual-factory/v0.3"
DEFAULT_HOME = Path.home() / "SK7-Visual-Factory"
DIGEST = re.compile(r"[a-f0-9]{64}\Z")
BLOB = re.compile(r"(?:originals|derivatives)/[a-f0-9]{64}\.(?:png|webp)\Z")
SCENES = {
    "S12": "visual/v2/scenes/s12/empty-state.webp",
    "S13": "visual/v2/scenes/s13/retry-state.webp",
    "S06": "visual/v2/scenes/s06/challenge-locked.webp",
    "S02": "visual/v2/scenes/s02/home-base.webp",
}


class FactoryError(RuntimeError):
    """Actionable, non-secret local failure."""


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def safe_home(home: Path) -> Path:
    home = home.expanduser().absolute()
    if home in (Path("/"), Path.home(), Path.home() / "Downloads"):
        raise FactoryError("Choose a dedicated archive directory, not root, home, or Downloads.")
    if home.is_symlink():
        raise FactoryError("The workspace root must not be a symlink.")
    # Keep local originals/config out of all Git worktrees, including the old v0.2 inbox.
    resolved = home.resolve()
    if any((parent / ".git").exists() for parent in (resolved, *resolved.parents)):
        raise FactoryError("Choose an archive home outside the repository, for example ~/SK7-Visual-Factory.")
    return home


def safe_path(home: Path, relative: str) -> Path:
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or any(p in (".", "..") for p in parts):
        raise FactoryError("Unsafe workspace-relative path.")
    target = home
    for part in parts:
        target = target / part
        if target.is_symlink():
            raise FactoryError("Symlinks in archive paths are refused.")
    return target


def atomic_write(home: Path, relative: str, data: bytes) -> None:
    path = safe_path(home, relative)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix=".sk7-write-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def immutable_write(home: Path, relative: str, data: bytes) -> None:
    path = safe_path(home, relative)
    if path.exists():
        if path.read_bytes() != data:
            raise FactoryError("Existing archive bytes differ; refusing overwrite.")
        return
    atomic_write(home, relative, data)


def read_json(home: Path, relative: str, default=None):
    path = safe_path(home, relative)
    if not path.exists():
        return default
    if path.stat().st_size > 16 * 1024 * 1024:
        raise FactoryError("Local metadata exceeds its size limit.")
    return json.loads(path.read_text("utf-8"))


def config(home: Path) -> dict:
    value = read_json(home, "config.json")
    if value is None:
        raise FactoryError("Workspace not initialized. Run: python3 visual_factory.py init")
    if value.get("schemaVersion") != VERSION or not re.fullmatch(r"[a-f0-9]{32}", value.get("workspaceId", "")):
        raise FactoryError("Unsupported or invalid config; v0.2 config is not imported automatically.")
    inbox = Path(value.get("inbox", ""))
    if not inbox.is_absolute() or inbox.is_symlink() or not inbox.is_dir():
        raise FactoryError("Configured inbox must be an existing real directory.")
    return value


def init_workspace(home: Path, inbox: Path | None = None) -> dict:
    home = safe_home(home)
    if (home / "config.json").exists():
        return config(home)
    inbox = (inbox or home / "inbox").expanduser().absolute()
    if inbox.is_symlink():
        raise FactoryError("Inbox must not be a symlink.")
    # Reject broad acquisition paths: no whole home, root, or general Downloads scan.
    if inbox in (Path.home(), Path.home() / "Downloads", Path("/")):
        raise FactoryError("Select a dedicated image inbox, not home, Downloads or filesystem root.")
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    for folder in ("originals", "derivatives", "records", "pending", "receipts"):
        safe_path(home, folder).mkdir(exist_ok=True, mode=0o700)
    inbox.mkdir(parents=True, exist_ok=True, mode=0o700)
    value = {
        "schemaVersion": VERSION,
        "workspaceId": uuid.uuid4().hex,
        "inbox": str(inbox),
        "bucket": None,
        "privateTargetConfirmed": False,
        "accountId": None,
        "source": "user-supplied",
        "createdAt": now(),
    }
    atomic_write(home, "config.json", encoded(value))
    return value


@contextmanager
def workspace_lock(home: Path):
    path = safe_path(home, ".session.lock")
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise FactoryError(
            "Another session or a crash lock exists. Stop the other process; use unlock --confirm-stopped only after checking."
        ) from exc
    with os.fdopen(fd, "w") as handle:
        handle.write(str(os.getpid()))
    try:
        yield
    finally:
        path.unlink(missing_ok=True)


def read_stable(path: Path, settle_seconds: float = 2.0) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or path.is_symlink():
        raise MediaError("Input must be a regular file, not a symlink.")
    if before.st_size > MAX_BYTES:
        raise MediaError("Input exceeds 32 MiB.")
    if time.time_ns() - before.st_mtime_ns < settle_seconds * 1e9:
        raise MediaError("File is still settling; it will be retried on the next scan.")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        with os.fdopen(fd, "rb") as handle:
            current = os.fstat(handle.fileno())
            if (current.st_ino, current.st_size, current.st_mtime_ns) != (
                before.st_ino,
                before.st_size,
                before.st_mtime_ns,
            ):
                raise MediaError("File changed before reading.")
            data = handle.read(MAX_BYTES + 1)
            after = os.fstat(handle.fileno())
    except OSError as exc:
        raise MediaError("Input became unavailable while reading.") from exc
    latest = path.lstat()

    def fingerprint(st):
        return st.st_ino, st.st_size, st.st_mtime_ns

    if (
        fingerprint(before) != fingerprint(after)
        or fingerprint(after) != fingerprint(latest)
        or len(data) != after.st_size
    ):
        raise MediaError("File changed during reading; retry later.")
    return data


def candidate(path: Path, data: bytes, source: str, scene: str | None) -> tuple[dict, bytes | None]:
    metadata = inspect_media(data, path.suffix)
    sha = digest(data)
    record = {
        "schemaVersion": "sk7-visual-candidate/v1",
        "id": sha,
        "status": "needs-review",
        "runtimeApproved": False,
        "source": source,
        "originalName": path.name,
        "sourceSha256": sha,
        "bytes": len(data),
        "original": f"originals/{sha}.{metadata['format']}",
        "scene": scene,
        "plannedProductKey": SCENES.get(scene),
        "productKeyIsProposalOnly": True,
        "media": metadata,
        "visualReview": {
            "textFree": "not-reviewed",
            "identityMatchesOfficialModel": "not-reviewed",
            "focalPoint": "not-reviewed",
            "rights": "not-reviewed",
        },
    }
    clean = None
    if metadata["format"] == "png":
        clean = sanitize_png(data)
        record["derivative"] = {
            "path": f"derivatives/{digest(clean)}.png",
            "sha256": digest(clean),
            "bytes": len(clean),
            "contentType": "image/png",
            "operation": "separate-png-metadata-clean-copy-not-resized",
        }
    return record, clean


def records(home: Path) -> list[dict]:
    result = []
    folder = safe_path(home, "records")
    for path in sorted(folder.glob("*.json")):
        if not DIGEST.fullmatch(path.stem):
            raise FactoryError("Unexpected record filename.")
        value = read_json(home, f"records/{path.name}")
        if (
            value.get("id") != path.stem
            or value.get("status") != "needs-review"
            or value.get("runtimeApproved") is not False
        ):
            raise FactoryError("Invalid candidate identity/approval state; nothing is auto-approved.")
        result.append(value)
    return result


def make_local_index(home: Path) -> dict:
    value = {
        "schemaVersion": "sk7-private-candidate-index/v1",
        "scope": "local-review-only",
        "runtimeApproved": False,
        "items": records(home),
    }
    atomic_write(home, "index.json", encoded(value))
    cards = []
    for record in value["items"]:
        image = record.get("derivative", {}).get("path", record["original"])
        if not BLOB.fullmatch(image):
            raise FactoryError("Unsafe gallery image path.")
        media = record["media"]
        title = html.escape(record["originalName"])
        alpha = {True: "투명 픽셀 있음", False: "투명 픽셀 없음", None: "투명 픽셀 미검증"}[
            media["hasTransparentPixels"]
        ]
        cards.append(
            f'<article><a href="{image}"><img loading="lazy" src="{image}" alt=""></a>'
            f"<h2>{title}</h2><p>{media['width']} × {media['height']} · {alpha}</p>"
            f"<p>검토 후보 · 운영 미승인</p><code>{record['id'][:16]}</code></article>"
        )
    page = """<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>SK7 이미지 후보 보관함</title><style>
body{font:16px system-ui,sans-serif;margin:32px;background:#f6f4ef;color:#283b36}h1{margin-bottom:8px}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}article{background:white;padding:16px;border-radius:16px}
img{width:100%;height:220px;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 50% / 20px 20px}
h2{font-size:15px;overflow-wrap:anywhere}p{font-size:14px}code{font-size:12px}
</style><h1>SK7 이미지 후보 보관함</h1><p>이 목록은 앱 운영 인덱스가 아닙니다. 생성·보관·운영 승인은 서로 다른 단계입니다.</p><main>"""
    page += "".join(cards) + "</main></html>"
    atomic_write(home, "gallery.html", page.encode("utf-8"))
    return value


def scan_inbox(  # noqa: C901
    home: Path,
    write: bool = False,
    scene: str | None = None,
    settle_seconds: float = 2,
    max_files: int = 100,
    seen: dict | None = None,
) -> dict:
    cfg = config(home)
    inbox = Path(cfg["inbox"])
    output = {
        "mode": "LOCAL_INGEST" if write else "DRY_RUN",
        "r2Writes": 0,
        "accepted": [],
        "skipped": [],
        "rejected": [],
    }
    files = sorted(inbox.iterdir(), key=lambda p: p.name)
    handled = 0
    for path in files:
        if path.name.startswith(".") or path.suffix.lower() not in (".png", ".webp"):
            continue
        if handled >= max_files:
            output["remaining"] = "More files remain; run ingest again."
            break
        try:
            observation = path.lstat()
            signature = (observation.st_ino, observation.st_size, observation.st_mtime_ns)
            if seen is not None and seen.get(path.name) == signature:
                continue
            data = read_stable(path, settle_seconds)
            sha = digest(data)
            if safe_path(home, f"records/{sha}.json").exists():
                output["skipped"].append({"file": path.name, "reason": "already-indexed", "id": sha})
                if seen is not None:
                    seen[path.name] = signature
                continue
            handled += 1
            record, clean = candidate(path, data, cfg["source"], scene)
            if write:
                immutable_write(home, record["original"], data)
                if clean is not None:
                    immutable_write(home, record["derivative"]["path"], clean)
                atomic_write(home, f"records/{sha}.json", encoded(record))
            output["accepted"].append(record)
            if seen is not None:
                seen[path.name] = signature
        except (MediaError, OSError, ValueError) as exc:
            output["rejected"].append({"file": path.name, "reason": str(exc)})
    if write and (output["accepted"] or not safe_path(home, "index.json").exists()):
        make_local_index(home)
    return output


def checked_blob(home: Path, relative: str, sha: str) -> bytes:
    if not BLOB.fullmatch(relative) or not DIGEST.fullmatch(sha):
        raise FactoryError("Invalid archive blob reference.")
    data = safe_path(home, relative).read_bytes()
    if len(data) > MAX_BYTES or digest(data) != sha:
        raise FactoryError("Local archive integrity mismatch; upload stopped.")
    return data


def completed_ids(home: Path) -> set[str]:
    ids = set()
    for path in safe_path(home, "receipts").glob("*.json"):
        receipt = read_json(home, f"receipts/{path.name}")
        if receipt.get("status") == "remote-index-verified":
            ids.update(receipt["sourceIds"])
    return ids


def build_batch(home: Path, cfg: dict) -> dict | None:
    pending = sorted(safe_path(home, "pending").glob("*.json"))
    if pending:
        return read_json(home, f"pending/{pending[0].name}")
    done = completed_ids(home)
    items = [record for record in records(home) if record["id"] not in done][:12]
    if not items:
        return None
    batch_id = uuid.uuid4().hex
    prefix = f"{PREFIX}{cfg['workspaceId']}/{batch_id}/"
    blobs, remote_items = {}, []
    for record in items:
        # Validate every local blob before preparing any remote write.
        checked_blob(home, record["original"], record["sourceSha256"])
        blobs[record["original"]] = {
            "local": record["original"],
            "sha256": record["sourceSha256"],
            "key": prefix + record["original"],
            "contentType": record["media"]["contentType"],
        }
        remote = {
            key: record[key]
            for key in (
                "id",
                "sourceSha256",
                "bytes",
                "status",
                "runtimeApproved",
                "source",
                "scene",
                "media",
                "visualReview",
            )
        }
        remote["originalKey"] = prefix + record["original"]
        if record.get("derivative"):
            derivative = record["derivative"]
            checked_blob(home, derivative["path"], derivative["sha256"])
            blobs[derivative["path"]] = {
                "local": derivative["path"],
                "sha256": derivative["sha256"],
                "key": prefix + derivative["path"],
                "contentType": derivative["contentType"],
            }
            remote["derivativeKey"] = prefix + derivative["path"]
        remote_items.append(remote)
    index = {
        "schemaVersion": "sk7-private-archive-batch/v1",
        "batchId": batch_id,
        "scope": "private-review-only",
        "runtimeApproved": False,
        "items": remote_items,
    }
    index_key = prefix + f"indexes/{digest(encoded(index))}.json"
    plan = {
        "schemaVersion": "sk7-private-backup-plan/v1",
        "batchId": batch_id,
        "workspaceId": cfg["workspaceId"],
        "bucket": cfg["bucket"],
        "objects": list(blobs.values()),
        "index": index,
        "indexKey": index_key,
    }
    atomic_write(home, f"pending/{batch_id}.json", encoded(plan))
    return plan


def sync_private(home: Path, confirmed: bool, transport=None, deadline: float | None = None) -> dict:  # noqa: C901
    cfg = config(home)
    if not confirmed:
        raise FactoryError("Cloud backup needs --confirm-private-upload. This is not product approval.")
    validate_target(cfg)
    if not list(safe_path(home, "pending").glob("*.json")):
        done = completed_ids(home)
        if not any(record["id"] not in done for record in records(home)):
            return {"status": "up-to-date", "r2Writes": 0}
    remote = transport or WranglerTransport(cfg)
    privacy = remote.check_private()
    plan = build_batch(home, cfg)
    if plan is None:
        return {"status": "up-to-date", "r2Writes": 0}
    if (
        plan.get("workspaceId") != cfg["workspaceId"]
        or plan.get("bucket") != cfg["bucket"]
        or not re.fullmatch(r"[a-f0-9]{32}", plan.get("batchId", ""))
    ):
        raise FactoryError("Pending plan does not belong to this workspace/target.")
    expected_prefix = f"{PREFIX}{cfg['workspaceId']}/{plan['batchId']}/"
    # Preflight the COMPLETE pending plan, including its index, before the first PUT.
    prepared = []
    for item in plan["objects"]:
        if item["key"] != expected_prefix + item["local"]:
            raise FactoryError("Pending plan path mismatch.")
        prepared.append((item, checked_blob(home, item["local"], item["sha256"])))
    index_bytes = encoded(plan["index"])
    if plan["indexKey"] != expected_prefix + f"indexes/{digest(index_bytes)}.json":
        raise FactoryError("Pending index integrity mismatch.")
    validate_pending_index(plan, prepared, expected_prefix)
    for item, data in prepared:
        if deadline is not None and time.monotonic() >= deadline:
            raise FactoryError("Session time budget reached; pending batch is preserved for the next sync.")
        remote.put_verified(item["key"], data, item["contentType"])
    # Only publish the snapshot after every referenced image has been read back.
    if deadline is not None and time.monotonic() >= deadline:
        raise FactoryError("Session time budget reached before index; pending batch is preserved.")
    remote.put_verified(plan["indexKey"], index_bytes, "application/json; charset=utf-8")
    receipt = {
        "status": "remote-index-verified",
        "batchId": plan["batchId"],
        "bucket": cfg["bucket"],
        "indexKey": plan["indexKey"],
        "indexSha256": digest(index_bytes),
        "privacy": privacy,
        "sourceIds": [record["id"] for record in plan["index"]["items"]],
        "workspaceId": cfg["workspaceId"],
        "verifiedAt": now(),
        "runtimeChanged": False,
    }
    atomic_write(home, f"receipts/{plan['batchId']}.json", encoded(receipt))
    # Only a task-owned local plan is removed, never input images or R2 objects.
    safe_path(home, f"pending/{plan['batchId']}.json").unlink()
    return receipt


def validate_pending_index(plan: dict, prepared: list, prefix: str) -> None:  # noqa: C901
    index = plan["index"]
    if index.get("runtimeApproved") is not False or index.get("scope") != "private-review-only":
        raise FactoryError("Pending index cannot approve a runtime asset.")
    available = {item["key"]: (item, data) for item, data in prepared}
    referenced = set()
    ids = set()
    for record in index["items"]:
        if record.get("runtimeApproved") is not False or record.get("status") != "needs-review":
            raise FactoryError("Index item is not an unapproved candidate.")
        identity = record.get("id", "")
        if not DIGEST.fullmatch(identity) or record.get("sourceSha256") != identity or identity in ids:
            raise FactoryError("Index identity mismatch or duplication.")
        ids.add(identity)
        key = record["originalKey"]
        if key not in available or available[key][0]["sha256"] != identity or not key.startswith(prefix + "originals/"):
            raise FactoryError("Index references an unverified original.")
        info = inspect_media(available[key][1], Path(key).suffix)
        if info != record["media"] or record["bytes"] != len(available[key][1]):
            raise FactoryError("Index media metadata differs from its bytes.")
        if available[key][0]["contentType"] != info["contentType"]:
            raise FactoryError("Object MIME mismatch.")
        referenced.add(key)
        derivative_key = record.get("derivativeKey")
        if derivative_key:
            if derivative_key not in available or not derivative_key.startswith(prefix + "derivatives/"):
                raise FactoryError("Index references an unverified derivative.")
            if available[derivative_key][1] != sanitize_png(available[key][1]):
                raise FactoryError("Derivative differs from its source normalization.")
            if available[derivative_key][0]["contentType"] != "image/png":
                raise FactoryError("Derivative MIME mismatch.")
            referenced.add(derivative_key)
    if referenced != set(available):
        raise FactoryError("Pending plan contains unindexed objects.")


def configure_r2(home: Path, args) -> dict:
    if not args.confirm_private_target:
        raise FactoryError(
            "Review the bucket and all Worker routes before --confirm-private-target. No settings are changed by this command."
        )
    cfg = config(home)
    account_id = args.account_id if args.account_id is not None else cfg.get("accountId")
    if (list(safe_path(home, "pending").glob("*.json")) or list(safe_path(home, "receipts").glob("*.json"))) and (
        cfg["bucket"],
        cfg.get("accountId"),
    ) != (args.bucket, account_id):
        raise FactoryError("Archive target/account cannot change after a backup plan exists. Use a new workspace.")
    cfg.update(bucket=args.bucket, privateTargetConfirmed=True, accountId=account_id)
    remote = WranglerTransport(cfg)
    result = remote.check_private()
    cfg["privateReviewedAt"] = now()
    atomic_write(home, "config.json", encoded(cfg))
    return result


def watch(home: Path, minutes: int, interval: int, upload: bool, confirmed: bool) -> dict:
    if not 1 <= minutes <= 480 or not 2 <= interval <= 300:
        raise FactoryError("Watch must be 1..480 minutes with a 2..300 second interval.")
    if upload and not confirmed:
        raise FactoryError("--upload also requires --confirm-private-upload.")
    deadline = time.monotonic() + minutes * 60
    scans = 0
    seen = {}
    last_rejections = None
    with workspace_lock(home):
        while time.monotonic() < deadline:
            result = scan_inbox(home, write=True, seen=seen)
            scans += 1
            if result["accepted"] or (result["rejected"] and result["rejected"] != last_rejections):
                print(
                    json.dumps(
                        {"scan": scans, "new": len(result["accepted"]), "rejected": result["rejected"]},
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
            last_rejections = result["rejected"]
            if upload:
                receipt = sync_private(home, confirmed=True, deadline=deadline)
                if receipt["status"] != "up-to-date":
                    print(json.dumps(receipt, ensure_ascii=False), flush=True)
            time.sleep(min(interval, max(0, deadline - time.monotonic())))
    return {"status": "foreground-session-complete", "scans": scans}


def unlock(home: Path, confirmed: bool) -> dict:
    if not confirmed:
        raise FactoryError("Stop/check the owning process before unlock --confirm-stopped.")
    path = safe_path(home, ".session.lock")
    if path.exists():
        pid = int(path.read_text().strip())
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            path.unlink()
        except PermissionError as exc:
            raise FactoryError("Cannot verify the owning process has stopped.") from exc
        else:
            raise FactoryError("The lock owner is still running; do not remove its lock.")
    return {"status": "no-stale-lock"}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--home", type=Path, default=DEFAULT_HOME)
    sub = p.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--inbox", type=Path)
    for name in ("scan", "ingest"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--scene", choices=list(SCENES))
    sub.add_parser("check")
    conf = sub.add_parser("configure-r2")
    conf.add_argument("--bucket", default=ALLOWED_BUCKET)
    conf.add_argument("--account-id")
    conf.add_argument("--confirm-private-target", action="store_true")
    sub.add_parser("doctor-r2")
    sync = sub.add_parser("sync")
    sync.add_argument("--confirm-private-upload", action="store_true")
    mon = sub.add_parser("watch")
    mon.add_argument("--minutes", type=int, default=120)
    mon.add_argument("--interval", type=int, default=5)
    mon.add_argument("--upload", action="store_true")
    mon.add_argument("--confirm-private-upload", action="store_true")
    un = sub.add_parser("unlock")
    un.add_argument("--confirm-stopped", action="store_true")
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        home = safe_home(args.home)
        result = dispatch(home, args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except KeyboardInterrupt:
        print("Stopped. Inputs and any pending batch were preserved.", file=sys.stderr)
        return 130
    except (FactoryError, MediaError, TransportError, OSError, ValueError, KeyError) as exc:
        print(f"Visual Factory stopped: {exc}", file=sys.stderr)
        return 1


def dispatch(home: Path, args):
    if args.command == "init":
        return init_workspace(home, args.inbox)
    cfg = config(home)
    if args.command == "check":
        return {
            "status": "local-config-valid",
            "inbox": cfg["inbox"],
            "cloudEnabled": cfg["privateTargetConfirmed"],
            "runtimeChanged": False,
        }
    if args.command == "scan":
        return scan_inbox(home, scene=args.scene)
    if args.command == "doctor-r2":
        return WranglerTransport(cfg).check_private()
    if args.command == "watch":
        return watch(home, args.minutes, args.interval, args.upload, args.confirm_private_upload)
    if args.command == "unlock":
        return unlock(home, args.confirm_stopped)
    with workspace_lock(home):
        if args.command == "ingest":
            return scan_inbox(home, write=True, scene=args.scene)
        if args.command == "configure-r2":
            return configure_r2(home, args)
        if args.command == "sync":
            return sync_private(home, args.confirm_private_upload)
    raise FactoryError("Unknown command.")


if __name__ == "__main__":
    raise SystemExit(main())
