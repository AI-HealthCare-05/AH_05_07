"""Verify that application source and browser bundles keep secret boundaries intact."""

from __future__ import annotations

import argparse
import ast
import re
import tempfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

TEXT_SUFFIXES = {".js", ".jsx", ".json", ".py", ".ts", ".tsx", ".yaml", ".yml"}
SOURCE_ROOTS = (Path("app"), Path("web/src"), Path("ops"), Path(".github/workflows"))
SECRET_PATTERNS = {
    "Supabase secret key": re.compile(r"\bsb_secret_[A-Za-z0-9_-]+", re.IGNORECASE),
    "Supabase service-role marker": re.compile(r"\b(?:service[_-]?role|SUPABASE_SERVICE_ROLE_KEY)\b", re.IGNORECASE),
    "JWT-like literal": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    "private-key block": re.compile(r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----"),
}
HEALTH_LOGGING_PATTERN = re.compile(r"\b(?:request\.(?:body|json)|systolic|diastolic)\b", re.IGNORECASE)


@dataclass(frozen=True)
class Finding:
    path: Path
    rule: str


def iter_text_files(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if not path.exists():
            continue
        if path.is_file():
            if path.suffix in TEXT_SUFFIXES:
                yield path
            continue
        yield from (
            candidate for candidate in path.rglob("*") if candidate.is_file() and candidate.suffix in TEXT_SUFFIXES
        )


def scan_secret_patterns(paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_text_files(paths):
        content = path.read_text(encoding="utf-8", errors="replace")
        for rule, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                findings.append(Finding(path, rule))
    return findings


def scan_health_logging(paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_text_files(paths):
        if path.suffix != ".py":
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"), filename=path)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            if not isinstance(node.func.value, ast.Name):
                continue
            logger_name = node.func.value.id
            if logger_name not in {"logging", "logger", "default_logger"} and not logger_name.endswith("_logger"):
                continue
            arguments = [*node.args, *(keyword.value for keyword in node.keywords)]
            if any(HEALTH_LOGGING_PATTERN.search(ast.unparse(argument)) for argument in arguments):
                findings.append(Finding(path, "request or blood-pressure value logging"))
                break
    return findings


def verify(source_roots: Iterable[Path], web_dist: Path | None) -> list[Finding]:
    findings = scan_secret_patterns(source_roots)
    findings.extend(scan_health_logging(source_roots))
    if web_dist is not None:
        findings.extend(scan_secret_patterns((web_dist,)))
    return findings


def assert_self_test(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def run_self_test() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = root / "app"
        source.mkdir()
        clean = source / "clean.py"
        clean.write_text('publishable_key = "sb_publishable_example"\n', encoding="utf-8")
        assert_self_test(not verify((source,), None), "publishable keys must remain allowed")

        cases = {
            "secret.py": 'key = "sb_secret_example"\n',
            "service_role.py": "service_role = True\n",
            "jwt.py": 'token = "eyJabcdefghijk.abcdefghijk.abcdefghijk"\n',
            "private_key.py": 'key = "-----BEGIN PRIVATE KEY-----"\n',
            "logging.py": 'logger.info(\n    "record=%s", request.json\n)\n',
        }
        for filename, content in cases.items():
            path = source / filename
            path.write_text(content, encoding="utf-8")
            assert_self_test(verify((source,), None), f"{filename} must be rejected")
            path.unlink()

    print("secret-boundary self-test: passed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-dist", type=Path, default=Path("web/dist"), help="built Vite asset directory")
    parser.add_argument("--self-test", action="store_true", help="run synthetic pass/fail controls only")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    findings = verify(SOURCE_ROOTS, args.web_dist)
    if findings:
        for finding in findings:
            print(f"secret-boundary violation: {finding.path}: {finding.rule}")
        raise SystemExit(1)

    print("secret-boundary verification: passed")


if __name__ == "__main__":
    main()
