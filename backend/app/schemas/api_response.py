"""Standard API response envelope — all routes use APIResponse[T]."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error detail for API error responses."""

    code: str
    message: str
    details: dict = Field(default_factory=dict)


class APIResponse(BaseModel, Generic[T]):
    """Standard API response envelope — every endpoint returns this."""

    status: Literal["success", "error"]
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: T | None = None
    error: ErrorDetail | None = None

    @classmethod
    def ok(cls, data: T) -> "APIResponse[T]":
        """Create a success response."""
        return cls(status="success", data=data)

    @classmethod
    def fail(cls, code: str, message: str, details: dict | None = None) -> "APIResponse[None]":
        """Create an error response."""
        return cls(
            status="error",
            error=ErrorDetail(code=code, message=message, details=details or {}),
        )
