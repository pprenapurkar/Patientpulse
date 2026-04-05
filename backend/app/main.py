"""PatientPulse FastAPI application entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import fhir, ai, patient
from backend.app.api.middleware.auth import AuthMiddleware
from backend.app.api.middleware.rate_limit import RateLimitMiddleware
from backend.app.core.config import get_settings

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="PatientPulse API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware (outermost first) ───────────────────────────────────────────────
# CORS: explicit origins required when allow_credentials=True
# (browsers reject wildcard "*" + credentials per the CORS spec)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
app.add_middleware(AuthMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(fhir.router, prefix="/api/v1/fhir")
app.include_router(ai.router, prefix="/api/v1/ai")
app.include_router(patient.router, prefix="/api/v1/patient")


# ── Health endpoint (no auth required) ────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ── Wearable seed endpoint (dev only) ─────────────────────────────────────────
@app.post("/api/v1/dev/seed-wearables/{patient_id}", tags=["dev"])
async def seed_wearables(patient_id: str):
    """Seed 72h simulated wearable data for a patient. Development use only."""
    from backend.app.services.fhir_service import get_fhir_service
    from backend.app.services.wearable_ingester import WearableIngester

    ingester = WearableIngester(get_fhir_service())
    count = await ingester.ingest(patient_id, hours=72)
    return {"status": "ok", "observations_written": count}
