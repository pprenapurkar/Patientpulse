"""RxNormClient — NIH RxNorm REST API integration for drug interaction checks."""
from __future__ import annotations

import structlog
import httpx

from backend.app.schemas.agent_types import DrugInteraction, InteractionResult
from datetime import datetime

logger = structlog.get_logger()

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
TIMEOUT = httpx.Timeout(8.0)

# Curated interaction data for demo (covers GLP-1 + current meds)
CACHED_INTERACTIONS: dict[str, list[dict]] = {
    "add_glp1": [],  # GLP-1 + Metformin/Lisinopril/Amlodipine — no significant interactions
    "increase_metformin": [],  # Dose increase — no new interactions expected
}


class RxNormTimeoutError(Exception):
    """Raised when RxNorm API does not respond in time."""


class RxNormClient:
    """Client for NIH RxNorm interaction API."""

    async def check_interactions(
        self, rxcuis: list[str], scenario_type: str
    ) -> InteractionResult:
        """
        Check drug-drug interactions for a set of RxNorm concept IDs.
        Falls back to curated cache if API times out.
        """
        try:
            interactions = await self._fetch_live_interactions(rxcuis)
            source = "rxnorm_live"
        except (RxNormTimeoutError, Exception) as e:
            logger.warning("rxnorm_timeout_using_cache", scenario_type=scenario_type, error=str(e))
            interactions = self._get_cached_interactions(scenario_type)
            source = "rxnorm_cached"

        severity = self._compute_overall_severity(interactions)
        return InteractionResult(
            checked_at=datetime.utcnow(),
            interactions=interactions,
            overall_severity=severity,
            data_source=source,
        )

    async def _fetch_live_interactions(self, rxcuis: list[str]) -> list[DrugInteraction]:
        """Fetch interactions from NIH RxNav API."""
        if not rxcuis:
            return []

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            params = {"rxcuis": "+".join(rxcuis)}
            r = await client.get(f"{RXNORM_BASE}/interaction/list.json", params=params)
            r.raise_for_status()
            data = r.json()

        interactions: list[DrugInteraction] = []
        full_interactions = data.get("fullInteractionTypeGroup", [])
        for group in full_interactions:
            for interaction_type in group.get("fullInteractionType", []):
                for pair in interaction_type.get("interactionPair", []):
                    concepts = pair.get("interactionConcept", [])
                    if len(concepts) >= 2:
                        interactions.append(DrugInteraction(
                            drug_a=concepts[0].get("minConceptItem", {}).get("name", ""),
                            drug_b=concepts[1].get("minConceptItem", {}).get("name", ""),
                            severity=self._map_severity(pair.get("severity", "")),
                            description=pair.get("description", ""),
                            rxnorm_concept_id=concepts[0].get("minConceptItem", {}).get("rxcui", ""),
                        ))
        return interactions

    def _get_cached_interactions(self, scenario_type: str) -> list[DrugInteraction]:
        """Return curated cached interactions for known scenarios."""
        cached = CACHED_INTERACTIONS.get(scenario_type, [])
        return [DrugInteraction(**i) for i in cached]

    def _compute_overall_severity(self, interactions: list[DrugInteraction]) -> str:
        order = ["NONE", "MILD", "MODERATE", "SEVERE"]
        if not interactions:
            return "NONE"
        max_sev = max(interactions, key=lambda i: order.index(i.severity))
        return max_sev.severity

    def _map_severity(self, rxnorm_severity: str) -> str:
        mapping = {"high": "SEVERE", "moderate": "MODERATE", "low": "MILD", "N/A": "NONE"}
        return mapping.get(rxnorm_severity.lower(), "NONE")
