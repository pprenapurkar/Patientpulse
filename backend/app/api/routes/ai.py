"""AI routes — /api/v1/ai/* — query, scenario, alerts."""
from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ai.agents.alert_agent import AlertAgent
from ai.agents.orchestrator_agent import OrchestratorAgent
from ai.agents.scenario_agent import ScenarioAgent
from backend.app.schemas.api_request import AIQueryRequest, ScenarioRequest
from backend.app.services.context_assembler import PatientContextAssembler
from backend.app.services.conversation_store import ConversationStore
from backend.app.services.fhir_service import (
    FHIRServerUnavailableError,
    PatientNotFoundError,
    get_fhir_service,
)

router = APIRouter(tags=["ai"])


def _get_assembler() -> PatientContextAssembler:
    return PatientContextAssembler(
        fhir_service=get_fhir_service(),
        conversation_store=ConversationStore(),
    )


@router.post("/query")
async def ai_query(body: AIQueryRequest, request: Request) -> StreamingResponse:
    """Submit a clinician NL query. Returns SSE stream."""
    assembler = _get_assembler()
    orchestrator = OrchestratorAgent()
    conv_store = ConversationStore()

    async def generate():
        try:
            context, _ = await assembler.assemble(body.patient_id)
            if body.conversation_history:
                context.conversation_history = body.conversation_history

            request_id = str(uuid.uuid4())
            full_response = ""
            citations: list[dict] = []
            start_time = time.monotonic()

            async for chunk in orchestrator.stream(context, body.query):
                if chunk.startswith("__DONE__:"):
                    full_text = chunk[9:]
                    obs_ids = {obs.id for obs in context.observations}
                    citation_matches = re.findall(r"Obs:([a-zA-Z0-9\-]+)", full_text)
                    citations = [
                        {"observation_id": cid, "value": "cited", "unit": None}
                        for cid in citation_matches if cid in obs_ids
                    ]

                    yield f"event: citations\ndata: {json.dumps({'citations': citations})}\n\n"

                    await conv_store.append(body.patient_id, "user", body.query)
                    await conv_store.append(body.patient_id, "assistant", full_text[:500])

                    latency_ms = int((time.monotonic() - start_time) * 1000)
                    yield f"event: complete\ndata: {json.dumps({'request_id': request_id, 'agent_id': 'diagnostic', 'prompt_version': 1, 'latency_ms': latency_ms})}\n\n"
                else:
                    full_response += chunk
                    yield f"event: token\ndata: {json.dumps({'token': chunk})}\n\n"

        except PatientNotFoundError:
            yield f"event: error\ndata: {json.dumps({'code': 'PATIENT_NOT_FOUND', 'message': 'Patient not found'})}\n\n"
        except FHIRServerUnavailableError:
            yield f"event: error\ndata: {json.dumps({'code': 'FHIR_SERVER_UNAVAILABLE', 'message': 'FHIR unavailable'})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'code': 'AI_GROUNDING_ERROR', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/scenario")
async def ai_scenario(body: ScenarioRequest, request: Request):
    """Run a what-if scenario."""
    assembler = _get_assembler()
    agent = ScenarioAgent()

    try:
        context, _ = await assembler.assemble(body.patient_id)
        response = await agent.run(context, scenario_type=body.scenario_type)
        return response.output  # Return data directly
    except PatientNotFoundError:
        return {"error": "PATIENT_NOT_FOUND", "message": f"Patient {body.patient_id} not found"}
    except Exception as e:
        return {"error": "AI_GROUNDING_ERROR", "message": str(e)}


@router.get("/alerts/{patient_id}")
async def get_alerts(patient_id: str, request: Request):
    """Get proactive alert flags. Rule-based — no LLM."""
    assembler = _get_assembler()
    agent = AlertAgent()

    try:
        context, _ = await assembler.assemble(patient_id)
        alert_output = agent.run(context)
        return {
            "patient_id": patient_id,
            "flags": [f.model_dump(mode="json") for f in alert_output.flags],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except PatientNotFoundError:
        return {"error": "PATIENT_NOT_FOUND", "message": f"Patient {patient_id} not found"}
    except FHIRServerUnavailableError:
        return {"error": "FHIR_SERVER_UNAVAILABLE", "message": "FHIR server unreachable"}
