#!/usr/bin/env python3
"""Bounded stdlib-only resolution probe and canonical snapshot entry launcher."""

from __future__ import annotations

import importlib.machinery
import json
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES = json.loads((ROOT / "scripts/model/model_v2_python_boundary.json").read_text())


def require(condition: bool, name: str) -> None:
    if not condition:
        raise RuntimeError(f"Python import boundary rejected: {name}")


def check_spec(name: str, spec, source: str | None, package: bool) -> None:
    require(spec is not None and spec.name == name, name)
    if source is None:
        require(spec.origin is None, name)
    else:
        expected = ROOT / source
        require(spec.origin == str(expected), name)
        require(expected.resolve() == expected and expected.is_relative_to(ROOT), name)
        require(isinstance(spec.loader, importlib.machinery.SourceFileLoader), name)
    locations = spec.submodule_search_locations
    if package:
        require(locations is not None and list(locations) == [str(ROOT / name.replace(".", "/"))], name)
    else:
        require(locations is None, name)


def find_spec(name: str, search):
    # FileFinder is the standard filesystem resolver. Unlike PathFinder's
    # namespace wrapper it can inspect absent-init parents without importing
    # them into sys.modules (which would change subsequent real imports).
    machinery = importlib.machinery
    return machinery.FileFinder(
        list(search)[0],
        (machinery.ExtensionFileLoader, machinery.EXTENSION_SUFFIXES),
        (machinery.SourceFileLoader, machinery.SOURCE_SUFFIXES),
        (machinery.SourcelessFileLoader, machinery.BYTECODE_SUFFIXES),
    ).find_spec(name)


def probe() -> None:
    # Resolve each component with Python's real PathFinder/FileFinder, without
    # executing the application-wide v1 registry merely to inspect a child.
    specs = {}
    for name, source in sorted(RULES["packages"].items(), key=lambda item: item[0].count(".")):
        parent = name.rpartition(".")[0]
        search = specs[parent].submodule_search_locations if parent else [str(ROOT)]
        spec = find_spec(name, search)
        check_spec(name, spec, source, True)
        specs[name] = spec
    for name, source in RULES["modules"].items():
        parent = name.rpartition(".")[0]
        spec = find_spec(name, specs[parent].submodule_search_locations)
        check_spec(name, spec, source, False)


def check_loaded() -> None:
    # Check actual imported objects as well as pre-execution resolution. Fail if
    # a future oracle change accidentally reintroduces unrelated app imports.
    expected = {**RULES["packages"], **RULES["modules"]}
    expected["_sk7_model_v2_router"] = RULES["modules"]["app.apis.v1.model_v2_routers"]
    for name, module in tuple(sys.modules.items()):
        path = getattr(module, "__file__", None)
        local = path is not None and Path(path).resolve().is_relative_to(ROOT)
        if name == "__main__" or not (local or name == "app" or name.startswith("app.")):
            continue
        require(name in expected, name)
        source = expected[name]
        check_spec(name, module.__spec__, source, name in RULES["packages"])
        require(path == (str(ROOT / source) if source else None), name)
        if name in RULES["packages"]:
            require(list(module.__path__) == [str(ROOT / name.replace(".", "/"))], name)


def main() -> None:
    require(bool(sys.flags.isolated) and bool(sys.flags.dont_write_bytecode), "isolated startup required")
    # -I excludes CWD/PYTHONPATH/user site. Only this captured root is inserted;
    # -B and an external empty pycache prefix keep snapshot bytecode unused.
    require(sys.pycache_prefix is not None and not Path(sys.pycache_prefix).exists(), "empty bytecode scope required")
    sys.path.insert(0, str(ROOT))
    probe()
    if len(sys.argv) > 1:
        entry = sys.argv[1]
        require(entry in RULES["entries"], "canonical entry")
        sys.argv = sys.argv[1:]
        runpy.run_path(str(ROOT / entry), run_name="__main__")
        check_loaded()
        probe()


if __name__ == "__main__":
    main()
