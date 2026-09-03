"""Verify deployed web, API health, and CORS without sending user data."""

from __future__ import annotations

import argparse
import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

USER_AGENT = "ah-05-07-deployment-smoke/1.0"
REQUESTED_METHODS = {
    "GET": "authorization",
    "POST": "authorization,content-type",
    "PUT": "authorization,content-type",
    "DELETE": "authorization",
}


class SmokeError(RuntimeError):
    """Raised when a deployment response does not meet the public contract."""


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: dict[str, str]
    body: bytes


def normalise_base_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SmokeError("base URLs must be absolute HTTP(S) URLs")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise SmokeError("base URLs must not contain credentials, query strings, or fragments")
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"


def origin_from_url(value: str) -> str:
    parsed = urlsplit(value)
    return f"{parsed.scheme}://{parsed.netloc}"


def endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}{path}"


def request(url: str, method: str = "GET", headers: dict[str, str] | None = None) -> HttpResponse:
    request_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    try:
        with urlopen(Request(url, method=method, headers=request_headers), timeout=10) as response:  # noqa: S310
            return HttpResponse(
                status=response.status,
                headers={name.lower(): value for name, value in response.headers.items()},
                body=response.read(4096),
            )
    except HTTPError as error:
        raise SmokeError(f"{method} {url} returned HTTP {error.code}") from error
    except URLError as error:
        raise SmokeError(f"{method} {url} could not be reached") from error


def require_status(response: HttpResponse, url: str, expected: int = 200) -> None:
    if response.status != expected:
        raise SmokeError(f"GET {url} returned HTTP {response.status}; expected {expected}")


def require_status_payload(response: HttpResponse, url: str, expected_status: str) -> None:
    require_status(response, url)
    try:
        payload = json.loads(response.body)
    except json.JSONDecodeError as error:
        raise SmokeError(f"GET {url} did not return a JSON status payload") from error
    if payload != {"status": expected_status}:
        raise SmokeError(f"GET {url} returned an unexpected status payload")


def require_cors_preflight(api_base_url: str, web_origin: str) -> None:
    preflight_url = endpoint(api_base_url, "/api/v1/observations/window")
    for method, request_headers in REQUESTED_METHODS.items():
        response = request(
            preflight_url,
            method="OPTIONS",
            headers={
                "Origin": web_origin,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": request_headers,
            },
        )
        if response.status not in {200, 204}:
            raise SmokeError(f"OPTIONS {preflight_url} returned HTTP {response.status}")
        if response.headers.get("access-control-allow-origin") != web_origin:
            raise SmokeError(f"OPTIONS {preflight_url} did not allow the configured web origin")
        allowed_methods = {
            value.strip().upper() for value in response.headers.get("access-control-allow-methods", "").split(",")
        }
        if method not in allowed_methods:
            raise SmokeError(f"OPTIONS {preflight_url} did not allow {method}")
        allowed_headers = {
            value.strip().lower() for value in response.headers.get("access-control-allow-headers", "").split(",")
        }
        requested_headers = {value.strip().lower() for value in request_headers.split(",")}
        if not requested_headers.issubset(allowed_headers):
            raise SmokeError(f"OPTIONS {preflight_url} did not allow the required request headers")


def verify(api_base_url: str, web_base_url: str) -> None:
    api_base_url = normalise_base_url(api_base_url)
    web_base_url = normalise_base_url(web_base_url)
    web_response = request(web_base_url)
    require_status(web_response, web_base_url)
    require_status_payload(request(endpoint(api_base_url, "/live")), endpoint(api_base_url, "/live"), "ok")
    require_status_payload(request(endpoint(api_base_url, "/ready")), endpoint(api_base_url, "/ready"), "ready")
    require_cors_preflight(api_base_url, origin_from_url(web_base_url))


@dataclass(frozen=True)
class FixtureConfig:
    web_status: int = 200
    ready_payload: dict[str, str] | None = None
    cors_origin: str | None = None


@contextmanager
def fixture_server(config: FixtureConfig) -> Iterator[str]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/":
                self._send(config.web_status, b"<html></html>", "text/html")
            elif self.path == "/live":
                self._send(200, b'{"status":"ok"}', "application/json")
            elif self.path == "/ready":
                payload = config.ready_payload or {"status": "ready"}
                self._send(200, json.dumps(payload).encode(), "application/json")
            else:
                self._send(404, b"", "text/plain")

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", config.cors_origin or self.headers.get("Origin", ""))
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.end_headers()

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def require_self_test_failure(config: FixtureConfig) -> None:
    with fixture_server(config) as base_url:
        try:
            verify(base_url, base_url)
        except SmokeError:
            return
    raise AssertionError("synthetic invalid deployment unexpectedly passed")


def run_self_test() -> None:
    with fixture_server(FixtureConfig()) as base_url:
        verify(base_url, base_url)
    require_self_test_failure(FixtureConfig(web_status=503))
    require_self_test_failure(FixtureConfig(ready_payload={"status": "not-ready"}))
    require_self_test_failure(FixtureConfig(cors_origin="https://unexpected.example"))
    print("deployment-smoke self-test: passed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base-url", help="public API base URL")
    parser.add_argument("--web-base-url", help="public web base URL")
    parser.add_argument("--self-test", action="store_true", help="run synthetic local pass/fail controls only")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return
    if not args.api_base_url or not args.web_base_url:
        parser.error("--api-base-url and --web-base-url are required unless --self-test is used")

    verify(args.api_base_url, args.web_base_url)
    print("deployment-smoke verification: passed")


if __name__ == "__main__":
    main()
