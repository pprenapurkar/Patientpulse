"""DiagnosticAgent — grounded clinical trend analysis with FHIR citations."""
from __future__ import annotations

import json
import re
import time
from typing import Any, AsyncIterator

import structlog

from ai.agents.base_agent import BaseAgent
from backend.app.schemas.agent_types import (
    AgentResponse,
    Citation,
    DiagnosticOutput,
    PatientContext,
    RiskFlag,
)

logger = structlog.get_logger()


def _build_context_message(context: PatientContext, query: str) -> str:
    """Serialize PatientContext (PHI-safe) into the Claude user message."""
    obs_summary = []
    for obs in context.observations[:20]:  # limit for token budget
        code = obs.code.coding[0].code if obs.code.coding else "?"
        display = obs.code.coding[0].display if obs.code.coding else "?"
        val = f"{obs.value_quantity.value} {obs.value_quantity.unit}" if obs.value_quantity else obs.value_string or "N/A"
        obs_summary.append({"id": obs.id, "code": code, "display": display, "value": val, "date": obs.effective_date_time.date().isoformat()})

    cond_summary = []
    for cond in context.conditions:
        code = cond.code.coding[0].code if cond.code.coding else "?"
        display = cond.code.coding[0].display if cond.code.coding else "?"
        cond_summary.append({"code": code, "display": display})

    med_summary = []
    for med in context.medications:
        code = med.medication_codeable_concept.coding[0].code if med.medication_codeable_concept.coding else "?"
        display = med.medication_codeable_concept.coding[0].display if med.medication_codeable_concept.coding else "?"
        med_summary.append({"code": code, "display": display, "status": med.status})

    payload = {
        "patient_context": {
            "age": context.patient_summary.age,
            "sex": context.patient_summary.sex,
            "conditions": cond_summary,
            "medications": med_summary,
            "observations": obs_summary,
            "wearable_summary": context.wearable_summary.model_dump() if context.wearable_summary else None,
        },
        "query": query,
        "conversation_history": [
            {"role": t.role, "content": t.content} for t in context.conversation_history[-5:]
        ],
    }
    return json.dumps(payload, default=str)


def _extract_citations(output_dict: dict, obs_ids: set[str]) -> list[Citation]:
    """Extract Obs:{id} citations from output and validate against context."""
    citations: list[Citation] = []
    text = json.dumps(output_dict)
    matches = re.findall(r"Obs:([a-zA-Z0-9\-]+)", text)
    for obs_id in matches:
        if obs_id in obs_ids:
            citations.append(Citation(observation_id=obs_id, field_path="valueQuantity.value", value="cited", unit=None))
    return citations


class DiagnosticAgent(BaseAgent):
    """Analyzes patient FHIR data for trends and risk flags. Every number cites a FHIR Observation ID."""

    agent_id = "diagnostic"
    prompt_name = "diagnostic"
    prompt_version = 1

    async def run(self, context: PatientContext, query: str = "", **kwargs: Any) -> AgentResponse:
        """Run diagnostic analysis. Returns AgentResponse with DiagnosticOutput."""
        start = time.monotonic()
        user_message = _build_context_message(context, query)
        obs_ids = {obs.id for obs in context.observations}

        raw_text = await self._call_claude(user_message, context, stream=False)

        # Parse JSON output
        try:
            output_dict = json.loads(raw_text)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            output_dict = json.loads(match.group()) if match else {"trend_analysis": raw_text, "risk_flags": [], "suggested_labs": [], "medication_notes": "", "disclaimer": "This analysis is for clinical decision support only and is not a clinical prediction or diagnosis."}

        citations = _extract_citations(output_dict, obs_ids)
        latency_ms = int((time.monotonic() - start) * 1000)

        return self._make_response(context, output_dict, citations, latency_ms)

    async def stream_run(self, context: PatientContext, query: str = "") -> AsyncIterator[str]:
        """Stream diagnostic analysis token by token for SSE endpoint."""
        user_message = _build_context_message(context, query)
        stream = await self._call_claude(user_message, context, stream=True)

        full_text = ""
        for event in stream:
            if event.type == "content_block_delta":
                delta = event.delta.text
                full_text += delta
                yield delta

        yield f"\n\n__DONE__:{full_text}"
