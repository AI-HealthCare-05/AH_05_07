"""Operator-local Wrangler transport. No credentials, public URLs, or deletes.

This intentionally does NOT implement public publication or change bucket
settings. Nonce + digest keys make retries idempotent for this single-writer
archive. They are not a substitute for server-enforced S3 conditional writes.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ALLOWED_BUCKET = "sk7-design-corpus-private"
PREFIX = "visual-factory/v1/"
KEY_PATTERN = re.compile(
    r"visual-factory/v1/[a-f0-9]{32}/[a-f0-9]{32}/(?:originals|derivatives|indexes)/[a-f0-9]{64}\.(?:png|webp|json)\Z"
)


class TransportError(RuntimeError):
    """Remote state is unverified; preserve the pending batch."""


def validate_target(config: dict) -> str:
    bucket = config.get("bucket")
    if bucket != ALLOWED_BUCKET:
        raise TransportError(
            "Only the explicitly reviewed sk7-design-corpus-private archive is supported. Public/product buckets are refused."
        )
    if config.get("privateTargetConfirmed") is not True:
        raise TransportError("Private target review is required. Run configure-r2 --confirm-private-target first.")
    account = config.get("accountId")
    if account is not None and not re.fullmatch(r"[a-fA-F0-9]{32}", account):
        raise TransportError("Account ID must be 32 hexadecimal characters, not a token.")
    return bucket


def require_private_output(dev: str, domains: str) -> None:
    # Exact current upstream Wrangler success strings. Unknown/localized output
    # fails CLOSED, rather than interpreting an empty/error response as private.
    disabled = "Public access via the r2.dev URL is disabled."
    empty = "There are no custom domains connected to this bucket."
    if disabled not in dev or "Public access is enabled" in dev:
        raise TransportError("r2.dev is enabled or its status could not be verified. No settings were changed.")
    if empty not in domains or re.search(r"(?im)^\s*domain\s*:", domains):
        raise TransportError(
            "Custom domains are present or their status could not be verified. No settings were changed."
        )


class WranglerTransport:
    def __init__(self, config: dict, runner=None):
        self.bucket = validate_target(config)
        self.account = config.get("accountId")
        self.runner = runner or subprocess.run
        self.binary = config.get("wranglerBinary") or shutil.which("wrangler")
        if not self.binary:
            raise TransportError("Wrangler was not found in PATH. Use the terminal where wrangler login succeeded.")

    def _run(self, arguments: list[str], cwd: str) -> str:
        env = dict(os.environ)
        env.update({"NO_COLOR": "1", "CI": "true", "WRANGLER_SEND_METRICS": "false"})
        if self.account:
            env["CLOUDFLARE_ACCOUNT_ID"] = self.account
        try:
            result = self.runner(
                [self.binary, *arguments],
                cwd=cwd,
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise TransportError(
                "Wrangler could not complete. Keep the pending batch and retry intentionally."
            ) from exc
        if result.returncode:
            # Do not forward CLI output that might contain auth/account details.
            raise TransportError(
                f"Wrangler {' '.join(arguments[:3])} failed (exit {result.returncode}). Run the matching read-only check in your terminal; do not paste tokens."
            )
        return result.stdout

    def check_private(self) -> dict:
        with tempfile.TemporaryDirectory(prefix="sk7-r2-check-") as tmp:
            dev = self._run(["r2", "bucket", "dev-url", "get", self.bucket], tmp)
            domains = self._run(["r2", "bucket", "domain", "list", self.bucket], tmp)
        require_private_output(dev, domains)
        return {
            "bucket": self.bucket,
            "r2DevDisabled": True,
            "customDomainsEmpty": True,
            "workerExposure": "operator-attested-not-account-wide-audited",
        }

    def put_verified(self, key: str, data: bytes, content_type: str) -> None:
        if not KEY_PATTERN.fullmatch(key):
            raise TransportError("Refused object key outside the isolated private archive.")
        digest = hashlib.sha256(data).hexdigest()
        if key.rsplit("/", 1)[1].split(".", 1)[0] != digest:
            raise TransportError("Object key must contain the exact SHA-256 of its bytes.")
        with tempfile.TemporaryDirectory(prefix="sk7-r2-transfer-") as tmp:
            source = Path(tmp) / "upload.bin"
            target = Path(tmp) / "readback.bin"
            source.write_bytes(data)
            self._run(
                [
                    "r2",
                    "object",
                    "put",
                    f"{self.bucket}/{key}",
                    "--remote",
                    "--file",
                    str(source),
                    "--content-type",
                    content_type,
                    "--cache-control",
                    "private, no-store",
                ],
                tmp,
            )
            self._run(["r2", "object", "get", f"{self.bucket}/{key}", "--remote", "--file", str(target)], tmp)
            if not target.is_file() or target.stat().st_size != len(data):
                raise TransportError("Remote readback size mismatch; index was not committed.")
            if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                raise TransportError("Remote readback SHA-256 mismatch; index was not committed.")
