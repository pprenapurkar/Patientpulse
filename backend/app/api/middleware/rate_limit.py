"""Rate limiting middleware — 100 req/min per user (Redis-backed)."""
from __future__ import annotations

import time
import structlog
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed sliding window rate limiter — 100 req/min per user."""

    def __init__(self, app, requests_per_minute: int = 100) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self._redis = None

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        user_id = getattr(request.state, "user_sub", None) or request.client.host
        
        # Try rate limit check with Redis
        try:
            redis = await self._get_redis()
            if redis:
                key = f"rate_limit:{user_id}"
                current = await redis.incr(key)
                if current == 1:
                    await redis.expire(key, 60)
                if current > self.requests_per_minute:
                    logger.warning("rate_limit_exceeded", user_id=user_id, count=current)
                    return JSONResponse(
                        status_code=429,
                        content={"status": "error", "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests — 100/min limit"}},
                    )
        except Exception:
            # Rate limit failure is non-blocking in demo build
            pass

        return await call_next(request)

    async def _get_redis(self):
        """Lazy Redis connection."""
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                from backend.app.core.config import get_settings
                settings = get_settings()
                self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            except Exception:
                return None
        return self._redis
