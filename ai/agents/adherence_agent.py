"""AdherenceAgent — patient companion NL extraction + deterministic escalation."""
from __future__ import annotations

import json
import re
import time
from typing import Any

import structlog

from ai.agents.base_agent import BaseAgent
from backend.app.schemas.agent_types import AgentResponse, CheckinExtraction, PatientContext

logger = structlog.get_logger()

ESCALATION_KEYWORDS = {"chest pain", "can't breathe", "cannot breathe", "emergency", "very dizzy", "unconscious", "fainted"}


def _deterministic_flag_level(extraction: CheckinExtraction, raw_message: str) -> str:
    """
    Deterministic escalation state machine.
    Safety-critical — NEVER LLM-derived.
    """
    # Keyword escalation
    msg_lower = raw_message.lower()
    if any(kw in msg_lower for kw in ESCALATION_KEYWORDS):
        return "ESCALATE"

    # Severity-based escalation
    if extraction.severity_score is not None:
        if extraction.severity_score >= 4 and extraction.severity_trend == "WORSENING":
            return "ESCALATE"
        if extraction.severity_score >= 3 or extraction.medication_status == "REPORTED_ISSUE":
            return "FOLLOW_UP"

    return "ROUTINE"


class AdherenceAgent(BaseAgent):
    """
    Powers the patient companion chat.
    LLM extracts symptom/severity/medication from NL.
    Escalation decision is deterministic — state machine only.
    """

    agent_id = "adherence"
    prompt_name = "companion"
    prompt_version = 1

    async def run(
        self,
        context: PatientContext,
        patient_message: str = "",
        **kwargs: Any,
    ) -> AgentResponse:
        """Process patient check-in message. Returns extraction + companion reply."""
        start = time.monotonic()

        user_message = json.dumps({
            "patient_context": {
                "age": context.patient_summary.age,
                "sex": context.patient_summary.sex,
                "conditions": [{"display": c.code.coding[0].display if c.code.coding else ""} for c in context.conditions],
                "medications": [{"display": m.medication_codeable_concept.coding[0].display if m.medication_codeable_concept.coding else ""} for m in context.medications],
            },
            "message": patient_message,
            "conversation_history": [{"role": t.role, "content": t.content} for t in context.conversation_history[-5:]],
        }, default=str)

        raw_text = await self._call_claude(user_message, context, stream=False, companion_mode=True)

        # Parse extraction
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            parsed = json.loads(match.group()) if match else {}

        extraction = CheckinExtraction(
            symptom_type=parsed.get("symptom_type"),
            severity_score=parsed.get("severity_score"),
            severity_trend=parsed.get("severity_trend"),
            medication_status=parsed.get("medication_status"),
            flag_level=parsed.get("flag_level", "ROUTINE"),
            companion_reply=parsed.get("companion_reply", "I hear you — thanks for checking in today."),
        )

        # Deterministic override of flag_level — safety-critical
        extraction.flag_level = _deterministic_flag_level(extraction, patient_message)

        latency_ms = int((time.monotonic() - start) * 1000)
        return self._make_response(context, extraction.model_dump(mode="json"), [], latency_ms)
