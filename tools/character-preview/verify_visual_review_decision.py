"""Validate a human World v2 visual-review decision without activating production."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

SPECIES = {"koala", "mouse", "owl", "pig"}
FINAL = {"accept-family", "hold-family", "reject-family"}
VALUE = {"accept", "hold", "reject"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(decision_path: Path, manifest_path: Path, allow_pending: bool = False) -> dict:
    decision = json.loads(decision_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if decision.get("documentType") != "COMPANION_WORLD_V2_VISUAL_REVIEW_DECISION":
        raise ValueError("wrong decision documentType")

    if manifest.get("documentType") != "COMPANION_WORLD_V2_VISUAL_REVIEW_PACKAGE":
        raise ValueError("wrong review package documentType")

    if decision.get("reviewPackageManifestSha256") != sha256(manifest_path):
        raise ValueError("review package manifest SHA-256 mismatch")

    if decision.get("productionActivationApproved") is not False:
        raise ValueError("visual review cannot approve production activation")

    entries = decision.get("species")

    if not isinstance(entries, list) or len(entries) != 4:
        raise ValueError("decision must contain four species entries")

    if {entry.get("speciesKey") for entry in entries} != SPECIES:
        raise ValueError("decision species set mismatch")

    candidate_index = {
        (item["speciesKey"], item["variantKey"]): item
        for item in manifest["candidates"]
    }

    pending_found = False

    for entry in entries:
        species = entry["speciesKey"]

        for variant in ("lite", "standard"):
            source = candidate_index[(species, variant)]

            if entry[f"{variant}CandidateId"] != source["candidateId"]:
                raise ValueError(f"{species}/{variant} candidate ID mismatch")

            if entry[f"{variant}Sha256"] != source["sha256"]:
                raise ValueError(f"{species}/{variant} SHA mismatch")

        values = [
            entry.get("decision"),
            entry.get("silhouette"),
            entry.get("motion"),
            entry.get("screenFit", {}).get("S01"),
            entry.get("screenFit", {}).get("S02"),
            entry.get("screenFit", {}).get("S10"),
        ]

        for value in values:
            if value == "pending":
                pending_found = True
            elif value not in VALUE:
                raise ValueError(f"invalid human review value: {value!r}")

    overall = decision.get("overallDecision")

    if overall == "pending":
        pending_found = True
    elif overall not in FINAL:
        raise ValueError("invalid overallDecision")

    if pending_found and not allow_pending:
        raise ValueError("human visual review is still pending")

    if not pending_found:
        if decision.get("status") != "completed-human-review":
            raise ValueError("completed decisions require completed-human-review status")

        reviewer = decision.get("reviewer")
        reviewed_at = decision.get("reviewedAt")

        if not isinstance(reviewer, str) or not reviewer.strip():
            raise ValueError("completed decision requires reviewer")

        if not isinstance(reviewed_at, str) or not reviewed_at.strip():
            raise ValueError("completed decision requires reviewedAt")

        if overall == "accept-family":
            for entry in entries:
                accepted = [
                    entry["decision"],
                    entry["silhouette"],
                    entry["motion"],
                    entry["screenFit"]["S01"],
                    entry["screenFit"]["S02"],
                    entry["screenFit"]["S10"],
                ]

                if any(value != "accept" for value in accepted):
                    raise ValueError(
                        "accept-family requires every species visual field to accept"
                    )

    return {
        "status": "valid-pending" if pending_found else "valid-completed",
        "speciesCount": 4,
        "overallDecision": overall,
        "productionActivationApproved": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--decision", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--allow-pending", action="store_true")
    args = parser.parse_args()

    print(
        json.dumps(
            verify(
                args.decision,
                args.manifest,
                args.allow_pending,
            ),
            ensure_ascii=False,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
