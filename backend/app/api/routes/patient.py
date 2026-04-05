"""Patient-facing routes — /api/v1/patient/*"""
from __future__ import annotations

import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ai.agents.adherence_agent import AdherenceAgent
from backend.app.schemas.api_request import CheckinRequest, EscalateRequest, MedConfirmRequest
from backend.app.services.context_assembler import PatientContextAssembler
from backend.app.services.conversation_store import ConversationStore
from backend.app.services.fhir_resource_assembler import FHIRResourceAssembler
from backend.app.services.fhir_service import get_fhir_service

router = APIRouter(tags=["patient"])


def _get_assembler() -> PatientContextAssembler:
    return PatientContextAssembler(
        fhir_service=get_fhir_service(),
        conversation_store=ConversationStore(),
    )


def _compute_recovery_score(observations: list, medications: list) -> dict:
    """Compute recovery score from FHIR observations."""
    now = datetime.datetime.utcnow()
    
    med_confirms = [
        o for o in observations
        if o.get("code", {}).get("coding", [{}])[0].get("code") == "61387-8"
        and "CONFIRMED" in (o.get("valueString") or "")
    ]
    recent_confirms = sum(
        1 for o in med_confirms
        if (now - datetime.datetime.fromisoformat(
            o.get("effectiveDateTime", "").replace("Z", "+00:00").replace("+00:00", "")
        )).days <= 7
    ) if med_confirms else 0
    adherence_score = min(recent_confirms / 7 * 100, 100)
    
    symptom_obs = [
        o for o in observations
        if o.get("code", {}).get("coding", [{}])[0].get("code") == "75325-1"
    ]
    if symptom_obs:
        latest_sev = symptom_obs[0].get("valueQuantity", {}).get("value", 3)
        symptom_trend_score = max(0, (5 - latest_sev) / 4 * 100)
    else:
        symptom_trend_score = 70.0
    
    engagement_obs = [
        o for o in observations
        if o.get("valueString") == "ENGAGED"
    ]
    engagement_score = min(len(engagement_obs) / 7 * 100, 100) if engagement_obs else 50.0
    
    score = (adherence_score * 0.4) + (symptom_trend_score * 0.4) + (engagement_score * 0.2)
    
    return {
        "score": round(score, 1),
        "adherence_score": round(adherence_score, 1),
        "symptom_trend_score": round(symptom_trend_score, 1),
        "engagement_score": round(engagement_score, 1),
        "trend": "IMPROVING" if score >= 70 else ("STABLE" if score >= 50 else "DECLINING"),
        "score_date": now.date().isoformat(),
        "components": {
            "adherence_score": round(adherence_score, 1),
            "symptom_trend_score": round(symptom_trend_score, 1),
            "engagement_score": round(engagement_score, 1),
        },
    }


@router.post("/checkin")
async def patient_checkin(body: CheckinRequest, request: Request):
    """Patient NL check-in."""
    assembler = _get_assembler()
    agent = AdherenceAgent()
    fhir_assembler = FHIRResourceAssembler(get_fhir_service())
    conv_store = ConversationStore()
    
    context, _ = await assembler.assemble(body.patient_id)
    if body.conversation_history:
        context.conversation_history = body.conversation_history
    
    agent_response = await agent.run(context, patient_message=body.message)
    extraction = agent_response.output
    
    from backend.app.schemas.agent_types import CheckinExtraction
    extraction_model = CheckinExtraction(**extraction)
    obs_ids = await fhir_assembler.build_and_write_observations(body.patient_id, extraction_model)
    
    await conv_store.append(body.patient_id, "user", body.message)
    await conv_store.append(body.patient_id, "assistant", extraction_model.companion_reply)
    
    raw_obs = await get_fhir_service().get_observations(body.patient_id, count=30)
    raw_meds = await get_fhir_service().get_medications(body.patient_id)
    recovery = _compute_recovery_score(raw_obs, raw_meds)
    
    return {
        "reply": extraction_model.companion_reply,
        "extracted": {
            "symptom_type": extraction_model.symptom_type,
            "severity_score": extraction_model.severity_score,
            "severity_trend": extraction_model.severity_trend,
            "medication_status": extraction_model.medication_status,
            "flag_level": extraction_model.flag_level,
        },
        "recovery_score": recovery["score"],
        "fhir_observations_written": obs_ids,
    }


@router.post("/med-confirm")
async def med_confirm(body: MedConfirmRequest, request: Request):
    """One-tap medication confirmation."""
    fhir_assembler = FHIRResourceAssembler(get_fhir_service())
    
    obs_id = await fhir_assembler.build_med_confirm_observation(
        patient_id=body.patient_id,
        medication_rxnorm_id=body.medication_rxnorm_id,
        confirmed_at=body.confirmed_at,
    )
    
    raw_obs = await get_fhir_service().get_observations(body.patient_id, count=30)
    med_confirms = [
        o for o in raw_obs
        if o.get("code", {}).get("coding", [{}])[0].get("code") == "61387-8"
        and "CONFIRMED" in (o.get("valueString") or "")
    ]
    streak_days = min(len(med_confirms), 30)
    milestone_message = None
    if streak_days in (3, 7, 14, 21, 30):
        milestone_message = f"🎉 {streak_days}-day streak! Keep it up!"
    
    return {
        "streak_days": streak_days,
        "milestone_message": milestone_message,
        "fhir_observation_id": obs_id,
    }


@router.post("/escalate")
async def patient_escalate(body: EscalateRequest, request: Request):
    """Patient red-button escalation."""
    fhir = get_fhir_service()
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    obs = {
        "resourceType": "Observation",
        "status": "final",
        "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "75325-1", "display": "Symptom — ESCALATION"}]},
        "subject": {"reference": f"Patient/{body.patient_id}"},
        "effectiveDateTime": now,
        "valueString": f"ESCALATE:{body.severity}:{body.reason[:200]}",
    }
    created = await fhir.create_resource(obs)
    escalation_id = created.get("id", "unknown")
    
    return {
        "escalation_id": escalation_id,
        "status": "SENT",
        "message": "Your care team has been notified. If this is an emergency, call 911.",
        "severity": body.severity,
    }


@router.get("/recovery-score/{patient_id}")
async def get_recovery_score(patient_id: str, request: Request):
    """Get current recovery score."""
    fhir = get_fhir_service()
    raw_obs = await fhir.get_observations(patient_id, count=30)
    raw_meds = await fhir.get_medications(patient_id)
    recovery = _compute_recovery_score(raw_obs, raw_meds)
    recovery["patient_id"] = patient_id
    return recovery
