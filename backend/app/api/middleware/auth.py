"""Authentication middleware for PatientPulse API."""
from __future__ import annotations

from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.core.config import get_settings


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT-based authentication middleware (stubbed with hardcoded tokens for demo)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate auth token on all requests except health/docs/OPTIONS."""
        
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip authentication for health check and docs
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authorization header"},
            )

        token = auth_header.replace("Bearer ", "").strip()
        settings = get_settings()

        # Validate token and assign role
        if token == settings.clinician_token:
            request.state.role = "CLINICIAN"
            request.state.user_id = "clinician-demo"
        elif token == settings.patient_token:
            request.state.role = "PATIENT"
            request.state.user_id = "patient-demo"
        else:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authentication token"},
            )

        return await call_next(request)
