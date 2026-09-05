"""Loopback-only, read-only viewer server with explicit asset and vendor roots."""

import argparse
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
ASSET_SUFFIXES = {".glb", ".png", ".jpg", ".webp"}


def contained(root, relative):
    if (
        not isinstance(relative, str)
        or not relative
        or "\\" in relative
        or ":" in relative
        or "\x00" in relative
        or any(part in {"", ".", ".."} for part in relative.split("/"))
    ):
        raise ValueError("Unavailable resource")
    path = (root / relative).resolve()
    if path == root or root not in path.parents or not path.is_file():
        raise ValueError("Unavailable resource")
    return path


def catalog(asset_root):
    data = json.loads((asset_root / "catalog.json").read_text(encoding="utf-8"))
    if data.get("schema_version") != 1 or len(data.get("animals", [])) != 12:
        raise ValueError("Invalid local catalog")
    ids = set()
    for animal in data["animals"]:
        if not isinstance(animal.get("id"), str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", animal["id"]):
            raise ValueError("Invalid asset identifier")
        if not isinstance(animal.get("name"), str) or not animal["name"].strip():
            raise ValueError("Invalid asset name")
        if animal["id"] in ids:
            raise ValueError("Duplicate asset")
        ids.add(animal["id"])
        animal["file_bytes"] = {}
        for variant in ("hero", "standard", "light"):
            relative = animal.get(variant)
            if relative:
                path = contained(asset_root, relative)
                if path.suffix not in ASSET_SUFFIXES:
                    raise ValueError("Unsupported asset type")
                animal["file_bytes"][variant] = path.stat().st_size
    return json.dumps(data, ensure_ascii=False).encode()


def resource(route, asset_root, vendor_root):
    if route == "/catalog.json":
        return catalog(asset_root), "application/json"
    if route.startswith("/assets/"):
        path = contained(asset_root, route.removeprefix("/assets/"))
        if path.suffix not in ASSET_SUFFIXES:
            raise ValueError("Unsupported asset")
        return path.read_bytes(), mimetypes.guess_type(path)[0] or "application/octet-stream"
    if route.startswith("/vendor/"):
        path = contained(vendor_root, route.removeprefix("/vendor/"))
        if path.suffix != ".js":
            raise ValueError("Unsupported vendor resource")
        return path.read_bytes(), "text/javascript"
    name = route.removeprefix("/") or "index.html"
    if name not in {"index.html", "viewer.js", "ground-reference.js", "viewer.css", "boot.js", "fallback.svg"}:
        raise ValueError("Unavailable page")
    path = HERE / name
    return path.read_bytes(), mimetypes.guess_type(path)[0] or "application/octet-stream"


def handler(asset_root, vendor_root):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_HEAD(self):  # noqa: N802
            self.do_GET(head=True)

        def do_GET(self, head=False):  # noqa: N802
            try:
                route = unquote(urlsplit(self.path).path)
                content, mime = resource(route, asset_root, vendor_root)
                self.send_response(200)
                self.send_header(
                    "Content-Type", mime + ("; charset=utf-8" if mime.startswith(("text/", "application/json")) else "")
                )
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Cross-Origin-Resource-Policy", "same-origin")
                self.end_headers()
                if not head:
                    self.wfile.write(content)
            except (ValueError, KeyError, OSError, json.JSONDecodeError):
                self.send_error(404, "Local resource unavailable")

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", required=True, type=Path)
    parser.add_argument("--vendor", required=True, type=Path)
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    catalog(args.assets.resolve())
    if not (args.vendor / "build/three.module.js").is_file():
        raise SystemExit("Prepare the pinned local vendor first")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler(args.assets.resolve(), args.vendor.resolve()))
    print(f"Local character review: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
