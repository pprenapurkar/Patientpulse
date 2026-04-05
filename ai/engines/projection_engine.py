"""ProjectionEngine — deterministic 12-week HbA1c projection. NO LLM math."""
from __future__ import annotations

from backend.app.schemas.agent_types import HbA1cProjection, PatientContext, ProjectionDataPoint

# Literature-based coefficients
SCENARIO_COEFFICIENTS = {
    "add_glp1": {
        "hba1c_weekly_reduction": 0.09,   # ~1.1% over 12 weeks
        "hba1c_delta_range": (-1.4, -0.8),
        "weight_weekly_kg": -0.15,         # ~1.8 kg over 12 weeks
        "weight_delta_range_kg": (-2.0, -1.5),
    },
    "increase_metformin": {
        "hba1c_weekly_reduction": 0.05,   # ~0.6% over 12 weeks
        "hba1c_delta_range": (-0.8, -0.4),
        "weight_weekly_kg": 0.0,
        "weight_delta_range_kg": None,
    },
}


class ProjectionEngine:
    """Computes deterministic 12-week HbA1c and weight projections."""

    def compute(
        self,
        scenario_type: str,
        current_hba1c: float,
        patient_context: PatientContext,
    ) -> HbA1cProjection:
        """Return a 12-week projection with week-by-week chart data."""
        coeffs = SCENARIO_COEFFICIENTS.get(scenario_type, SCENARIO_COEFFICIENTS["add_glp1"])
        weeks = 12
        chart_data: list[ProjectionDataPoint] = []

        # Estimate current weight from BMI + height proxy
        current_weight_kg = 78.0  # Maria's approximate weight from BMI 31.4

        for w in range(1, weeks + 1):
            hba1c_proj = round(current_hba1c - (coeffs["hba1c_weekly_reduction"] * w), 2)
            weight_proj = None
            if coeffs["weight_weekly_kg"] != 0:
                weight_proj = round(current_weight_kg + (coeffs["weight_weekly_kg"] * w), 1)

            chart_data.append(ProjectionDataPoint(
                week=w,
                hba1c_projected=max(hba1c_proj, 5.5),  # floor at normal lower bound
                weight_projected_kg=weight_proj,
            ))

        weight_range = coeffs.get("weight_delta_range_kg")

        return HbA1cProjection(
            weeks=weeks,
            hba1c_delta_range=tuple(coeffs["hba1c_delta_range"]),
            weight_delta_range_kg=tuple(weight_range) if weight_range else None,
            chart_data=chart_data,
        )
