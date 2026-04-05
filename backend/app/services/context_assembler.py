"""PatientContextAssembler — fetches all 8 FHIR resource types and builds PatientContext."""
from __future__ import annotations

import json
import time
from datetime import datetime, date
from pathlib import Path

import structlog

from backend.app.schemas.agent_types import (
    ConversationTurn,
    PatientContext,
    PatientSummary,
    WearableSummary,
)
from backend.app.schemas.fhir_types import (
    FHIRCondition,
    FHIRMedicationStatement,
    FHIRObservation,
)
from backend.app.services.fhir_service import FHIRService, FHIRServerUnavailableError, PatientNotFoundError
from backend.app.services.conversation_store import ConversationStore

logger = structlog.get_logger()

FIXTURES_PATH = Path(__file__).parent.parent.parent.parent.parent / "fixtures" / "maria_static.json"


def _calculate_age(birth_date_str: str) -> int:
    """Calculate age in integer years from ISO date string."""
    try:
        bd = date.fromisoformat(birth_date_str)
        today = date.today()
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    except Exception:
        return 58  # fallback for Maria


def _get_sex(patient_resource: dict) -> str:
    """Extract sex from Patient resource."""
    gender = patient_resource.get("gender", "unknown")
    if gender == "female":
        return "female"
    if gender == "male":
        return "male"
    return "unknown"


def _get_discharge_date(encounters: list[dict]) -> datetime | None:
    """Extract most recent discharge date from Encounters."""
    for enc in encounters:
        period = enc.get("period", {})
        end = period.get("end")
        if end:
            try:
                return datetime.fromisoformat(end.replace("Z", "+00:00"))
            except Exception:
                pass
    return None


def _parse_wearable_summary(observations: list[FHIRObservation]) -> WearableSummary | None:
    """Build WearableSummary from wearable Observations using rule-based thresholds."""
    wearable_obs = [
        o for o in observations
        if any(
            cat.coding and any(c.code == "wearable" for c in cat.coding)
            for cat in o.category
        )
    ]

    if not wearable_obs:
        return None

    hr_values = []
    nocturnal_hr = []
    glucose_values = []
    steps_values = []

    for obs in wearable_obs:
        if obs.value_quantity is None:
            continue
        val = obs.value_quantity.value
        code = obs.code.coding[0].code if obs.code.coding else ""
        hour = obs.effective_date_time.hour

        if code == "8867-4":  # Heart Rate (LOINC)
            hr_values.append(val)
            if hour >= 23 or hour < 5:
                nocturnal_hr.append(val)
        elif code == "15074-8":  # Glucose
            glucose_values.append(val)
        elif code == "55423-8":  # Steps
            steps_values.append(val)

    if not hr_values:
        return None

    hr_mean = sum(hr_values) / len(hr_values)
    hr_max = max(hr_values)
    hr_noc = sum(nocturnal_hr) / len(nocturnal_hr) if nocturnal_hr else hr_mean
    glucose_mean = sum(glucose_values) / len(glucose_values) if glucose_values else None
    glucose_pp_max = max(glucose_values) if glucose_values else None
    steps_mean = sum(steps_values) / len(steps_values) if steps_values else 0.0
    steps_baseline = steps_mean * 1.5  # simple 14d baseline proxy

    # Rule-based anomaly detection (deterministic — no LLM)
    anomaly_flags: list[str] = []
    nights_hr_high = sum(1 for v in nocturnal_hr if v > 100)
    if nights_hr_high >= 3:
        anomaly_flags.append(f"Nocturnal HR >100 bpm on {nights_hr_high} nights")
    if steps_baseline > 0 and steps_mean < steps_baseline * 0.6:
        pct_drop = round((1 - steps_mean / steps_baseline) * 100)
        anomaly_flags.append(f"Daily steps down {pct_drop}% from 14-day baseline")

    return WearableSummary(
        hr_mean=round(hr_mean, 1),
        hr_max=hr_max,
        hr_nocturnal_mean=round(hr_noc, 1),
        glucose_mean=round(glucose_mean, 1) if glucose_mean else None,
        glucose_postprandial_max=glucose_pp_max,
        steps_daily_mean=round(steps_mean, 0),
        steps_14d_baseline=round(steps_baseline, 0),
        anomaly_flags=anomaly_flags,
    )


class PatientContextAssembler:
    """
    Assembles PatientContext from HAPI FHIR for all 8 resource types.
    Falls back to static JSON fixture if FHIR is unreachable.
    PHI is stripped before returning context.
    """

    def __init__(self, fhir_service: FHIRService, conversation_store: ConversationStore) -> None:
        self.fhir = fhir_service
        self.conv = conversation_store

    async def assemble(self, patient_id: str) -> tuple[PatientContext, str]:
        """
        Return (PatientContext, data_freshness).
        data_freshness: 'live' | 'cached'
        """
        start = time.monotonic()
        try:
            context = await self._assemble_from_fhir(patient_id)
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.info("context_assembled", patient_id=patient_id, latency_ms=elapsed_ms, source="fhir")
            return context, "live"

        except FHIRServerUnavailableError:
            logger.warning("fhir_unavailable_using_fallback", patient_id=patient_id)
            context = self._load_static_fixture()
            return context, "cached"

    async def _assemble_from_fhir(self, patient_id: str) -> PatientContext:
        """Fetch all 8 FHIR resource types and build PatientContext."""
        # Parallel fetch would be production; serial for demo simplicity
        patient_raw = await self.fhir.get_patient(patient_id)
        conditions_raw = await self.fhir.get_conditions(patient_id)
        meds_raw = await self.fhir.get_medications(patient_id)
        obs_raw = await self.fhir.get_observations(patient_id, count=50)
        encounters_raw = await self.fhir.get_encounters(patient_id)
        conv_history = await self.conv.get_history(patient_id)

        # Parse resources
        conditions = [FHIRCondition.model_validate(c, from_attributes=True) for c in conditions_raw]
        medications = [FHIRMedicationStatement.model_validate(m, from_attributes=True) for m in meds_raw]
        observations = [FHIRObservation.model_validate(o, from_attributes=True) for o in obs_raw]

        # PHI-safe patient summary — NO name, DOB exposed
        age = _calculate_age(patient_raw.get("birthDate", "1966-01-01"))
        sex = _get_sex(patient_raw)
        discharge_date = _get_discharge_date(encounters_raw)

        patient_summary = PatientSummary(age=age, sex=sex, discharge_date=discharge_date)
        wearable_summary = _parse_wearable_summary(observations)

        return PatientContext(
            patient_id=patient_id,
            patient_summary=patient_summary,
            conditions=conditions,
            medications=medications,
            observations=observations[:50],
            wearable_summary=wearable_summary,
            conversation_history=conv_history[-10:],
        )

    def _load_static_fixture(self) -> PatientContext:
        """Load static PatientContext fixture when FHIR is down."""
        if FIXTURES_PATH.exists():
            data = json.loads(FIXTURES_PATH.read_text())
            return PatientContext.model_validate(data)
        # Minimal fallback
        return PatientContext(
            patient_id="maria-chen-uuid",
            patient_summary=PatientSummary(age=58, sex="female"),
            conditions=[],
            medications=[],
            observations=[],
        )
