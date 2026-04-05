"""FHIR Service — HAPI FHIR R4 client wrapper."""
from __future__ import annotations

import structlog
import httpx

from backend.app.core.config import get_settings

logger = structlog.get_logger()

TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class FHIRServerUnavailableError(Exception):
    """Raised when HAPI FHIR server is unreachable."""


class PatientNotFoundError(Exception):
    """Raised when no Patient resource exists for the given ID."""


class FHIRService:
    """Thin async wrapper around HAPI FHIR REST API."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.hapi_fhir_base_url
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=TIMEOUT,
                headers={"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"},
            )
        return self._client

    async def get_resource(self, resource_type: str, resource_id: str) -> dict:
        """Fetch a single FHIR resource by type and ID."""
        try:
            client = await self._get_client()
            r = await client.get(f"/{resource_type}/{resource_id}")
            r.raise_for_status()
            return r.json()
        except httpx.ConnectError as e:
            raise FHIRServerUnavailableError(f"HAPI FHIR unreachable: {e}") from e
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise PatientNotFoundError(resource_id) from e
            raise

    async def search_resources(self, resource_type: str, params: dict) -> list[dict]:
        """Search FHIR resources and return a list of resource dicts."""
        try:
            client = await self._get_client()
            r = await client.get(f"/{resource_type}", params=params)
            r.raise_for_status()
            bundle = r.json()
            entries = bundle.get("entry", [])
            return [e["resource"] for e in entries if "resource" in e]
        except httpx.ConnectError as e:
            raise FHIRServerUnavailableError(f"HAPI FHIR unreachable: {e}") from e

    async def create_resource(self, resource: dict) -> dict:
        """POST a new FHIR resource and return the created resource."""
        resource_type = resource.get("resourceType", "")
        try:
            client = await self._get_client()
            r = await client.post(f"/{resource_type}", json=resource)
            r.raise_for_status()
            return r.json()
        except httpx.ConnectError as e:
            raise FHIRServerUnavailableError(f"HAPI FHIR unreachable: {e}") from e

    async def get_patient(self, patient_id: str) -> dict:
        """Fetch a Patient resource by FHIR ID."""
        try:
            result = await self.get_resource("Patient", patient_id)
            return result
        except PatientNotFoundError:
            # Try searching by identifier
            results = await self.search_resources("Patient", {"_id": patient_id})
            if not results:
                raise PatientNotFoundError(patient_id)
            return results[0]

    async def get_conditions(self, patient_id: str) -> list[dict]:
        """Get active Conditions for a patient."""
        return await self.search_resources("Condition", {
            "patient": patient_id,
            "clinical-status": "active",
            "_count": 20,
        })

    async def get_medications(self, patient_id: str) -> list[dict]:
        """Get active MedicationStatements for a patient."""
        return await self.search_resources("MedicationStatement", {
            "patient": patient_id,
            "status": "active",
            "_count": 20,
        })

    async def get_observations(self, patient_id: str, category: str | None = None, count: int = 50) -> list[dict]:
        """Get Observations for a patient, sorted by date descending."""
        params: dict = {"patient": patient_id, "_sort": "-date", "_count": min(count, 100)}
        if category:
            params["category"] = category
        return await self.search_resources("Observation", params)

    async def get_allergies(self, patient_id: str) -> list[dict]:
        """Get AllergyIntolerance resources for a patient."""
        return await self.search_resources("AllergyIntolerance", {"patient": patient_id, "_count": 20})

    async def get_encounters(self, patient_id: str) -> list[dict]:
        """Get Encounters for a patient, most recent first."""
        return await self.search_resources("Encounter", {
            "patient": patient_id,
            "_sort": "-date",
            "_count": 5,
        })

    async def get_care_plans(self, patient_id: str) -> list[dict]:
        """Get active CarePlans for a patient."""
        return await self.search_resources("CarePlan", {
            "patient": patient_id,
            "status": "active",
            "_count": 5,
        })

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Module-level singleton
_fhir_service: FHIRService | None = None


def get_fhir_service() -> FHIRService:
    """Return module-level FHIRService singleton."""
    global _fhir_service
    if _fhir_service is None:
        _fhir_service = FHIRService()
    return _fhir_service
