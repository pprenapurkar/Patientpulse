"""ScenarioAgent — RxNorm check + deterministic projection + LLM narrative."""
from __future__ import annotations

import json
import time
from typing import Any

import structlog

from ai.agents.base_agent import BaseAgent
from ai.engines.projection_engine import ProjectionEngine
from backend.app.schemas.agent_types import (
    AgentResponse,
    HbA1cProjection,
    PatientContext,
    ScenarioOutput,
)
from backend.app.services.rxnorm_client import RxNormClient

logger = structlog.get_logger()

# RxNorm concept IDs for Maria's medications + scenario drugs
RXCUIS_BY_SCENARIO = {
    "add_glp1": ["860975", "314076", "197361", "2200644"],  # Metformin + Lisinopril + Amlodipine + Semaglutide
    "increase_metformin": ["860975", "314076", "197361"],
}


class ScenarioAgent(BaseAgent):
    """
    What-if scenario simulator.
    Order: RxNorm check (deterministic) → Projection (deterministic) → LLM narrative only.
    LLM is NEVER used for numeric computation.
    """

    agent_id = "scenario"
    prompt_name = "scenario"
    prompt_version = 1

    def __init__(self) -> None:
        super().__init__()
        self.rxnorm = RxNormClient()
        self.projection = ProjectionEngine()

    async def run(
        self,
        context: PatientContext,
        scenario_type: str = "add_glp1",
        **kwargs: Any,
    ) -> AgentResponse:
        """Run scenario: interaction check → projection → narrative."""
        start = time.monotonic()

        # 1. Deterministic: RxNorm interaction check
        rxcuis = RXCUIS_BY_SCENARIO.get(scenario_type, [])
        interaction_result = await self.rxnorm.check_interactions(rxcuis, scenario_type)

        # 2. Deterministic: HbA1c projection
        current_hba1c = self._get_current_hba1c(context)
        projection = self.projection.compute(
            scenario_type=scenario_type,
            current_hba1c=current_hba1c,
            patient_context=context,
        )

        # 3. LLM: narrative only (no numbers invented by LLM)
        narrative_message = json.dumps({
            "scenario_type": scenario_type,
            "patient_context": {
                "age": context.patient_summary.age,
                "sex": context.patient_summary.sex,
                "conditions": [
                    {"display": c.code.coding[0].display if c.code.coding else "Unknown"}
                    for c in context.conditions
                ],
                "current_medications": [
                    {"display": m.medication_codeable_concept.coding[0].display if m.medication_codeable_concept.coding else "Unknown"}
                    for m in context.medications
                ],
            },
            "interaction_result": {
                "interactions": [i.model_dump() for i in interaction_result.interactions],
                "overall_severity": interaction_result.overall_severity,
            },
            "projection": {
                "hba1c_delta_range": list(projection.hba1c_delta_range),
                "weeks": projection.weeks,
            },
        }, default=str)

        narrative_raw = await self._call_claude(narrative_message, context, stream=False)

        try:
            narrative_dict = json.loads(narrative_raw)
            narrative = narrative_dict.get("narrative", narrative_raw)
        except json.JSONDecodeError:
            narrative = narrative_raw

        output = ScenarioOutput(
            interaction_result=interaction_result,
            projection=projection,
            narrative=narrative,
            is_clinical_prediction=False,
            disclaimer="Illustrative projection — not a clinical prediction.",
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        return self._make_response(context, output.model_dump(mode="json"), [], latency_ms)

    def _get_current_hba1c(self, context: PatientContext) -> float:
        """Extract latest HbA1c value from observations."""
        for obs in context.observations:
            if obs.code.coding and obs.code.coding[0].code == "4548-4":
                if obs.value_quantity:
                    return obs.value_quantity.value
        return 8.0  # fallback
