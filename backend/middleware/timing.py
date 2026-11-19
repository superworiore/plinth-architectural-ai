from time import perf_counter

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class ProcessTimeMiddleware(BaseHTTPMiddleware):
    """Add the request processing duration to each HTTP response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = perf_counter()
        response = await call_next(request)
        elapsed = perf_counter() - start_time
        response.headers["X-Process-Time"] = f"{elapsed:.6f}"
        return response
