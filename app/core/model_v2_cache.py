from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MODEL_V2_NO_STORE_PATHS = frozenset({"/api/v1/model-v2/product-score", "/api/v1/model-v2/score"})


class ModelV2NoStoreMiddleware:
    """Set the cache policy after routing and handled errors, without reading bodies."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] not in MODEL_V2_NO_STORE_PATHS:
            await self.app(scope, receive, send)
            return

        async def send_no_store(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["Cache-Control"] = "no-store"
            await send(message)

        await self.app(scope, receive, send_no_store)
