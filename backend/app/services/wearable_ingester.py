"""WearableIngester — consumes simulated wearable stream and writes FHIR Observations."""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

import structlog

from backend.app.services.fhir_service import FHIRService

logger = structlog.get_logger()


def generate_wearable_stream(patient_id: str, hours: int = 72) -> list[dict]:
    """
    Generate 72h of simulated wearable observations for Maria Chen.
    Includes scripted anomaly pattern:
      - Nocturnal HR spike (>100 bpm on nights 2 and 3)
      - Step count decline (-40% from baseline on day 2)
    Returns list of raw FHIR Observation dicts.
    """
    observations: list[dict] = []
    now = datetime.utcnow()
    base_hr = 72
    base_steps_per_hour = 500  # ~12,000/day baseline

    for h in range(hours, 0, -1):
        ts = now - timedelta(hours=h)
        ts_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        hour_of_day = ts.hour
        day_offset = h // 24  # 0 = today, 1 = yesterday, 2 = two days ago

        # ── Heart Rate ─────────────────────────────────────────────────────
        # Scripted anomaly: elevated nocturnal HR on days 1 and 2 (ago)
        is_nocturnal = hour_of_day >= 23 or hour_of_day < 5
        if is_nocturnal and day_offset in (1, 2):
            hr = random.randint(102, 115)  # Anomaly: nocturnal HR > 100
        elif is_nocturnal:
            hr = random.randint(58, 72)   # Normal nocturnal HR
        else:
            hr = int(base_hr + 10 * math.sin(hour_of_day * 0.3) + random.randint(-5, 5))

        observations.append({
            "resourceType": "Observation",
            "status": "final",
            "category": [{
                "coding": [
                    {"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"},
                    {"system": "http://patientpulse.io/categories", "code": "wearable"},
                ],
            }],
            "code": {"coding": [{"system": "http://loinc.org", "code": "8867-4", "display": "Heart rate"}]},
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": ts_str,
            "valueQuantity": {"value": hr, "unit": "beats/min", "system": "http://unitsofmeasure.org", "code": "/min"},
        })

        # ── CGM Glucose (every 2 hours) ────────────────────────────────────
        if h % 2 == 0:
            postprandial = hour_of_day in (8, 9, 12, 13, 18, 19)
            base_glucose = 145 if postprandial else 118
            glucose = base_glucose + random.randint(-15, 20)
            observations.append({
                "resourceType": "Observation",
                "status": "final",
                "category": [{
                    "coding": [
                        {"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"},
                        {"system": "http://patientpulse.io/categories", "code": "wearable"},
                    ],
                }],
                "code": {"coding": [{"system": "http://loinc.org", "code": "15074-8", "display": "Glucose [Moles/volume] in Blood"}]},
                "subject": {"reference": f"Patient/{patient_id}"},
                "effectiveDateTime": ts_str,
                "valueQuantity": {"value": glucose, "unit": "mg/dL", "system": "http://unitsofmeasure.org", "code": "mg/dL"},
            })

        # ── Steps (every 6 hours, daytime only) ───────────────────────────
        if h % 6 == 0 and 6 <= hour_of_day < 22:
            if day_offset >= 1:
                # Scripted anomaly: 40% step decline from day 1 onwards
                steps = int(base_steps_per_hour * 6 * 0.58 + random.randint(-200, 200))
            else:
                steps = int(base_steps_per_hour * 6 + random.randint(-300, 300))

            observations.append({
                "resourceType": "Observation",
                "status": "final",
                "category": [{
                    "coding": [
                        {"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "activity"},
                        {"system": "http://patientpulse.io/categories", "code": "wearable"},
                    ],
                }],
                "code": {"coding": [{"system": "http://loinc.org", "code": "55423-8", "display": "Number of steps in unspecified time Pedometer"}]},
                "subject": {"reference": f"Patient/{patient_id}"},
                "effectiveDateTime": ts_str,
                "valueQuantity": {"value": steps, "unit": "steps", "system": "http://unitsofmeasure.org", "code": "{steps}"},
            })

    return observations


class WearableIngester:
    """Ingests simulated wearable data into HAPI FHIR."""

    def __init__(self, fhir_service: FHIRService) -> None:
        self.fhir = fhir_service

    async def ingest(self, patient_id: str, hours: int = 72) -> int:
        """Generate and write 72h of wearable observations. Returns count written."""
        observations = generate_wearable_stream(patient_id, hours)
        written = 0
        for obs in observations:
            try:
                await self.fhir.create_resource(obs)
                written += 1
            except Exception as e:
                logger.warning("wearable_write_error", patient_id=patient_id, error=str(e))

        logger.info("wearable_ingested", patient_id=patient_id, count=written)
        return written
