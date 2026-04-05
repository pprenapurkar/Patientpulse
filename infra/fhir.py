"""FHIR-related routes — /api/v1/fhir/*"""
from __future__ import annotations
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from backend.app.services.context_assembler import PatientContextAssembler
from backend.app.services.conversation_store import ConversationStore
from backend.app.services.fhir_service import get_fhir_service

router = APIRouter(tags=["fhir"])

def _get_assembler() -> PatientContextAssembler:
    return PatientContextAssembler(
        fhir_service=get_fhir_service(),
        conversation_store=ConversationStore(),
    )

@router.get("/Patient/{patient_id}/context")
async def get_patient_context(patient_id: str, request: Request):
    """Assemble patient context from FHIR resources."""
    assembler = _get_assembler()
    context, source = await assembler.assemble(patient_id)
    return context.model_dump()

@router.get("/Observation")
async def get_observations(request: Request):
    """Get FHIR observations (placeholder)."""
    return JSONResponse({"resourceType": "Bundle", "entry": []})
