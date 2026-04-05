"""FHIRResourceAssembler — converts check-in NL extractions to FHIR Observations."""
from __future__ import annotations

import uuid
from datetime import datetime

import structlog

from backend.app.schemas.agent_types import CheckinExtraction
from backend.app.schemas.fhir_types import (
    CodeableConcept,
    Coding,
    FHIRObservation,
    Reference,
    ValueQuantity,
)
from backend.app.services.fhir_service import FHIRService

logger = structlog.get_logger()

# LOINC codes for check-in observations
LOINC_SYMPTOM = "75325-1"       # Symptom
LOINC_MEDICATION = "61387-8"    # Medication adherence


class FHIRResourceAssembler:
    """Converts AdherenceAgent extractions into FHIR Observation resources."""

    def __init__(self, fhir_service: FHIRService) -> None:
        self.fhir = fhir_service

    async def build_and_write_observations(
        self,
        patient_id: str,
        extraction: CheckinExtraction,
    ) -> list[str]:
        """
        Convert CheckinExtraction to FHIR Observations and write them.
        Returns list of written Observation IDs (twin sync rule: must be non-empty).
        """
        obs_ids: list[str] = []
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Write symptom Observation if symptom present
        if extraction.symptom_type and extraction.severity_score is not None:
            symptom_obs = self._build_symptom_observation(patient_id, extraction, now)
            created = await self.fhir.create_resource(symptom_obs)
            obs_id = created.get("id", str(uuid.uuid4()))
            obs_ids.append(obs_id)
            logger.info("fhir_observation_written", patient_id=patient_id, loinc=LOINC_SYMPTOM, obs_id=obs_id)

        # Write medication adherence Observation if medication status present
        if extraction.medication_status == "CONFIRMED":
            med_obs = self._build_medication_observation(patient_id, extraction, now)
            created = await self.fhir.create_resource(med_obs)
            obs_id = created.get("id", str(uuid.uuid4()))
            obs_ids.append(obs_id)
            logger.info("fhir_observation_written", patient_id=patient_id, loinc=LOINC_MEDICATION, obs_id=obs_id)

        # Always write at least a check-in engagement observation
        if not obs_ids:
            engagement_obs = self._build_engagement_observation(patient_id, now)
            created = await self.fhir.create_resource(engagement_obs)
            obs_id = created.get("id", str(uuid.uuid4()))
            obs_ids.append(obs_id)

        return obs_ids

    def _build_symptom_observation(
        self, patient_id: str, extraction: CheckinExtraction, now: str
    ) -> dict:
        """Build a FHIR Observation for reported symptom with severity."""
        return {
            "resourceType": "Observation",
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey"}]}],
            "code": {
                "coding": [{"system": "http://loinc.org", "code": LOINC_SYMPTOM, "display": "Symptom"}],
                "text": extraction.symptom_type or "Patient-reported symptom",
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": now,
            "valueQuantity": {
                "value": extraction.severity_score,
                "unit": "score",
                "system": "http://unitsofmeasure.org",
                "code": "{score}",
            },
            "note": [{"text": f"Trend: {extraction.severity_trend or 'STABLE'}; Flag: {extraction.flag_level}"}],
        }

    def _build_medication_observation(
        self, patient_id: str, extraction: CheckinExtraction, now: str
    ) -> dict:
        """Build a FHIR Observation for medication confirmation."""
        return {
            "resourceType": "Observation",
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey"}]}],
            "code": {
                "coding": [{"system": "http://loinc.org", "code": LOINC_MEDICATION, "display": "Medication adherence"}],
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": now,
            "valueString": extraction.medication_status or "CONFIRMED",
        }

    def _build_engagement_observation(self, patient_id: str, now: str) -> dict:
        """Build a FHIR Observation recording patient engagement (check-in occurred)."""
        return {
            "resourceType": "Observation",
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey"}]}],
            "code": {
                "coding": [{"system": "http://loinc.org", "code": "61387-8", "display": "Patient engagement check-in"}],
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": now,
            "valueString": "ENGAGED",
        }

    async def build_med_confirm_observation(
        self, patient_id: str, medication_rxnorm_id: str, confirmed_at: datetime
    ) -> str:
        """Build and write a medication confirmation Observation. Returns obs ID."""
        confirmed_at_str = confirmed_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        obs = {
            "resourceType": "Observation",
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey"}]}],
            "code": {
                "coding": [{"system": "http://loinc.org", "code": LOINC_MEDICATION, "display": "Medication adherence one-tap confirmation"}],
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": confirmed_at_str,
            "valueString": f"CONFIRMED:{medication_rxnorm_id}",
        }
        created = await self.fhir.create_resource(obs)
        obs_id = created.get("id", str(uuid.uuid4()))
        logger.info("med_confirm_observation_written", patient_id=patient_id, rxnorm_id=medication_rxnorm_id, obs_id=obs_id)
        return obs_id
