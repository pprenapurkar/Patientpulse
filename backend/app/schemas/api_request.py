"""API request body schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from backend.app.schemas.agent_types import ConversationTurn


class AIQueryRequest(BaseModel):
    """Request body for POST /api/v1/ai/query."""

    patient_id: str
    query: str = Field(..., max_length=500)
    conversation_history: list[ConversationTurn] = Field(default_factory=list, max_length=10)


class ScenarioRequest(BaseModel):
    """Request body for POST /api/v1/ai/scenario."""

    patient_id: str
    scenario_type: Literal["add_glp1", "increase_metformin"]


class CheckinRequest(BaseModel):
    """Request body for POST /api/v1/patient/checkin."""

    patient_id: str
    message: str = Field(..., max_length=500)
    conversation_history: list[ConversationTurn] = Field(default_factory=list, max_length=10)


class MedConfirmRequest(BaseModel):
    """Request body for POST /api/v1/patient/med-confirm."""

    patient_id: str
    medication_rxnorm_id: str
    confirmed_at: datetime


class EscalateRequest(BaseModel):
    """Request body for POST /api/v1/patient/escalate."""

    patient_id: str
    reason: str = Field(..., max_length=500)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "HIGH"
