#!/usr/bin/env python3
"""Measure the frozen logistic core in Chromium; outputs stay outside the repo."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import importlib.metadata
import io
import json
import platform
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARTIFACT_SHA256 = "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84"
ORT_VERSION = "1.29.0"
ORT_URL = f"https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-{ORT_VERSION}.tgz"
ORT_INTEGRITY = "sha512-LuQlpX6MFLJZu756erwUeb1mNfoJGbs1kzDwJGNlf5RvfYMdqhcY3vNpDPK40CUV2HoWTkIj+uS0o36GFHjeYw=="
RUNTIME_FILES = ["ort.wasm.bundle.min.mjs", "ort-wasm-simd-threaded.wasm"]
SOURCE_VERSIONS = {"numpy": "2.4.1", "pandas": "3.0.5", "scikit-learn": "1.8.0", "joblib": "1.5.3"}


def command_json(command: list[str], payload: object | None = None) -> object:
    """Capture transient numeric diagnostics in pipes, never terminal/file logs."""
    result = subprocess.run(
        command,
        input=None if payload is None else json.dumps(payload, allow_nan=False),
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        # Deliberately exclude stdout, which can contain transient oracle output.
        raise RuntimeError(f"{Path(command[0]).name} failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def byte_cost(data: bytes) -> dict[str, object]:
    return {
        "raw_bytes": len(data),
        "gzip_level_9_bytes": len(gzip.compress(data, compresslevel=9, mtime=0)),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument(
        "--runtime-tarball", type=Path, help="Optional cached public tarball; integrity is always verified"
    )
    parser.add_argument("--cold-trials", type=int, default=5)
    parser.add_argument("--warm-iterations", type=int, default=200)
    args = parser.parse_args()
    if args.cold_trials < 1 or args.warm_iterations < 1:
        raise SystemExit("Trial counts must be positive")
    artifact_bytes = args.artifact.read_bytes()
    if hashlib.sha256(artifact_bytes).hexdigest() != ARTIFACT_SHA256:
        raise SystemExit("Canonical artifact SHA-256 mismatch; refusing deserialization")
    versions = {name: importlib.metadata.version(name) for name in SOURCE_VERSIONS}
    if versions != SOURCE_VERSIONS or platform.python_version() != "3.13.14":
        raise SystemExit("Use the repository's verified Python 3.13.14/.venv model environment")
    import joblib
    import numpy as np

    artifact = joblib.load(io.BytesIO(artifact_bytes))
    classifier = artifact["pipeline"].named_steps["model"]
    if (
        classifier.coef_.shape != (1, 35)
        or classifier.coef_.dtype != np.float64
        or classifier.intercept_.dtype != np.float64
        or classifier.classes_.tolist() != [0, 1]
    ):
        raise SystemExit("Frozen binary float64 linear core contract mismatch")
    cases = command_json([sys.executable, str(HERE.parent / "fixtures.py")])
    oracle = command_json(
        [sys.executable, str(HERE.parent / "oracle.py"), "--artifact", str(args.artifact.resolve())],
        cases,
    )
    accepted = [row for row in oracle if row["ok"]]
    if not accepted or any(len(row["preprocessed"]) != 35 for row in accepted):
        raise SystemExit("No verified synthetic canonical-preprocessed fixtures")
    directory = Path(tempfile.mkdtemp(prefix="model-v2-wasm-baseline-", dir="/tmp"))
    exporter_versions = command_json(
        [
            "uv",
            "run",
            "--no-project",
            "--python",
            sys.executable,
            "--with",
            "onnx==1.22.0",
            "--with",
            "numpy==2.4.1",
            "python",
            str(HERE / "export_core.py"),
            str(directory / "core.onnx"),
        ],
        {"coefficients": classifier.coef_.tolist(), "intercept": classifier.intercept_.tolist()},
    )
    archive = (
        args.runtime_tarball.read_bytes()
        if args.runtime_tarball
        else urllib.request.urlopen(ORT_URL, timeout=60).read()  # noqa: S310 - fixed pinned public URL
    )
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
    if integrity != ORT_INTEGRITY:
        raise SystemExit("Pinned ONNX Runtime npm tarball integrity mismatch")
    costs = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        package_metadata = json.load(package.extractfile("package/package.json"))
        if package_metadata["version"] != ORT_VERSION:
            raise SystemExit("ONNX Runtime version mismatch")
        for name in RUNTIME_FILES:
            data = package.extractfile(f"package/dist/{name}").read()
            (directory / name).write_bytes(data)
            costs[name] = byte_cost(data)
    costs["core.onnx"] = byte_cost((directory / "core.onnx").read_bytes())
    timings = command_json(
        ["node", str(HERE / "benchmark.mjs")],
        {
            "directory": str(directory),
            "coldTrials": args.cold_trials,
            "warmIterations": args.warm_iterations,
            "rows": [row["preprocessed"] for row in accepted],
            "expected": [row["score"] for row in accepted],
        },
    )
    result = {
        "status": "PASS_LINEAR_CORE_ONLY"
        if all(run["warm"]["mismatchCount"] == 0 for run in timings["runs"])
        else "FAIL_CORE_PARITY",
        "measured_at": datetime.now(UTC).isoformat(),
        "scope": "Fitted canonical logistic core only: 35 already-preprocessed float64 inputs, MatMul/Add/Sigmoid, tensor output. Not raw 11-feature browser preprocessing, adapter/API parity, or production readiness.",
        "artifact_sha256": ARTIFACT_SHA256,
        "measurement_source_sha256": {
            str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [
                HERE / "run.py",
                HERE / "export_core.py",
                HERE / "benchmark.mjs",
                HERE.parent / "fixtures.py",
                HERE.parent / "oracle.py",
            ]
        },
        "fixture_set_sha256": hashlib.sha256(json.dumps(cases, sort_keys=True, allow_nan=False).encode()).hexdigest(),
        "source_artifact_bytes": len(artifact_bytes),
        "source_versions": {"python": platform.python_version(), **versions},
        "exporter_versions": exporter_versions,
        "host": {"system": platform.system(), "release": platform.release(), "machine": platform.machine()},
        "runtime": {
            "package": "onnxruntime-web",
            "version": ORT_VERSION,
            "tarball_url": ORT_URL,
            "integrity": ORT_INTEGRITY,
        },
        "asset_costs": costs,
        "runtime_only_totals": {
            key: sum(costs[name][key] for name in RUNTIME_FILES) for key in ["raw_bytes", "gzip_level_9_bytes"]
        },
        "cost_scope": "Published files, separately gzip level 9; app bytes, HTTP overhead and model bytes excluded from runtime-only total. Benchmark serves uncompressed loopback assets, not a real-device network load.",
        "fixtures": {
            "synthetic_cases": len(cases),
            "canonical_accepted": len(accepted),
            "canonical_rejected_not_sent_to_core": len(cases) - len(accepted),
        },
        "browser_benchmark": timings,
        "safety": {
            "fitted": False,
            "participant_data_read": False,
            "raw_predictions_persisted": False,
            "product_runtime_changed": False,
        },
    }
    output = directory / "aggregate.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": result["status"], "aggregate_path": str(output), "assets_directory": str(directory)}))
    if result["status"] != "PASS_LINEAR_CORE_ONLY":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
