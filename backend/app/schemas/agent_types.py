"""Agent input/output Pydantic schemas — PatientContext, AgentResponse, etc."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.fhir_types import (
    FHIRCondition,
    FHIRMedicationStatement,
    FHIRObservation,
)

_ALIAS_CONFIG = ConfigDict(populate_by_name=True)


class PatientSummary(BaseModel):
    model_config = _ALIAS_CONFIG
    age: int
    sex: Literal["male", "female", "unknown"]
    discharge_date: datetime | None = None


class WearableSummary(BaseModel):
    model_config = _ALIAS_CONFIG
    period_hours: int = 72
    hr_mean: float
    hr_max: float
    hr_nocturnal_mean: float
    glucose_mean: float | None = None
    glucose_postprandial_max: float | None = None
    steps_daily_mean: float
    steps_14d_baseline: float
    anomaly_flags: list[str] = Field(default_factory=list)


class ConversationTurn(BaseModel):
    model_config = _ALIAS_CONFIG
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime


class PatientContext(BaseModel):
    model_config = _ALIAS_CONFIG

    patient_id: str
    patient_summary: PatientSummary
    conditions: list[FHIRCondition]
    medications: list[FHIRMedicationStatement]
    observations: list[FHIRObservation]
    wearable_summary: WearableSummary | None = None
    conversation_history: list[ConversationTurn] = Field(default_factory=list)
    assembled_at: datetime = Field(default_factory=datetime.utcnow)
    # Fields the frontend reads for cache status
    data_freshness: Literal["live", "cached"] = "live"
    cache_timestamp: str | None = None


class Citation(BaseModel):
    model_config = _ALIAS_CONFIG
    observation_id: str
    field_path: str
    value: str
    unit: str | None = None


class AgentResponse(BaseModel):
    model_config = _ALIAS_CONFIG
    agent_id: str
    patient_id: str
    request_id: str
    output: dict[str, Any]
    citations: list[Citation] = Field(default_factory=list)
    latency_ms: int
    model_version: str
    prompt_version: int
    is_clinical_prediction: Literal[False] = False


class RiskFlag(BaseModel):
    model_config = _ALIAS_CONFIG
    flag: str
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    citation: str


class DiagnosticOutput(BaseModel):
    model_config = _ALIAS_CONFIG
    trend_analysis: str
    risk_flags: list[RiskFlag]
    suggested_labs: list[str]
    medication_notes: str
    disclaimer: str


class AlertFlag(BaseModel):
    model_config = _ALIAS_CONFIG
    flag_id: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    category: Literal["WEARABLE_ANOMALY", "ADHERENCE", "CLINICAL_TREND"]
    title: str
    detail: str
    observation_ids: list[str]
    recommended_action: str | None = None


class AlertOutput(BaseModel):
    model_config = _ALIAS_CONFIG
    flags: list[AlertFlag]


class DrugInteraction(BaseModel):
    model_config = _ALIAS_CONFIG
    drug_a: str
    drug_b: str
    severity: Literal["NONE", "MILD", "MODERATE", "SEVERE"]
    description: str
    rxnorm_concept_id: str


class InteractionResult(BaseModel):
    model_config = _ALIAS_CONFIG
    checked_at: datetime
    interactions: list[DrugInteraction]
    overall_severity: Literal["NONE", "MILD", "MODERATE", "SEVERE"]
    data_source: Literal["rxnorm_live", "rxnorm_cached"]


class ProjectionDataPoint(BaseModel):
    model_config = _ALIAS_CONFIG
    week: int
    hba1c_projected: float
    weight_projected_kg: float | None = None


class HbA1cProjection(BaseModel):
    model_config = _ALIAS_CONFIG
    weeks: int = 12
    hba1c_delta_range: tuple[float, float]
    weight_delta_range_kg: tuple[float, float] | None = None
    chart_data: list[ProjectionDataPoint]


class ScenarioOutput(BaseModel):
    model_config = _ALIAS_CONFIG
    interaction_result: InteractionResult
    projection: HbA1cProjection
    narrative: str
    is_clinical_prediction: Literal[False] = False
    disclaimer: str = "Illustrative projection — not a clinical prediction."


class CheckinExtraction(BaseModel):
    model_config = _ALIAS_CONFIG
    symptom_type: str | None = None
    severity_score: int | None = None
    severity_trend: Literal["IMPROVING", "STABLE", "WORSENING"] | None = None
    medication_status: Literal["CONFIRMED", "PENDING", "REPORTED_ISSUE"] | None = None
    flag_level: Literal["ROUTINE", "FOLLOW_UP", "ESCALATE"] = "ROUTINE"
    companion_reply: str = ""
