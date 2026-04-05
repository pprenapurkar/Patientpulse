"""AlertAgent — fully rule-based proactive alert generation. NO LLM."""
from __future__ import annotations

import uuid
from typing import Any

import structlog

from backend.app.schemas.agent_types import AlertFlag, AlertOutput, PatientContext

logger = structlog.get_logger()

# Rule thresholds (deterministic — not LLM-derived)
HR_NOCTURNAL_THRESHOLD = 100  # bpm
STEPS_DECLINE_THRESHOLD = 0.40  # 40% below baseline
HBAIC_HIGH_THRESHOLD = 8.0  # %
SYSTOLIC_HIGH_THRESHOLD = 140  # mmHg

LOINC_HBAIC = "4548-4"
LOINC_SYSTOLIC_BP = "8480-6"
LOINC_HR = "8867-4"


class AlertAgent:
    """
    Rule-based proactive alert agent.
    Scans wearable anomalies and cross-references FHIR Conditions.
    Returns max 2 flags — no LLM involved.
    """

    agent_id = "alert"

    def run(self, context: PatientContext) -> AlertOutput:
        """Generate up to 2 proactive alert flags from patient context."""
        candidates: list[tuple[int, AlertFlag]] = []  # (priority, flag)

        # ── Wearable anomaly flags ─────────────────────────────────────────
        if context.wearable_summary:
            ws = context.wearable_summary

            if ws.hr_nocturnal_mean > HR_NOCTURNAL_THRESHOLD:
                obs_ids = self._find_obs_ids(context, LOINC_HR)
                candidates.append((10, AlertFlag(
                    flag_id=str(uuid.uuid4()),
                    severity="HIGH",
                    category="WEARABLE_ANOMALY",
                    title="Elevated nocturnal heart rate",
                    detail=f"Mean nocturnal HR {ws.hr_nocturnal_mean:.0f} bpm over 72h — threshold is {HR_NOCTURNAL_THRESHOLD} bpm. Pattern spans multiple nights.",
                    observation_ids=obs_ids[:5],
                    recommended_action="Review nocturnal vitals; consider sleep study if pattern persists.",
                )))

            if ws.steps_14d_baseline > 0:
                decline = 1 - (ws.steps_daily_mean / ws.steps_14d_baseline)
                if decline >= STEPS_DECLINE_THRESHOLD:
                    obs_ids = self._find_obs_ids(context, "55423-8")  # Steps LOINC
                    candidates.append((8, AlertFlag(
                        flag_id=str(uuid.uuid4()),
                        severity="MEDIUM",
                        category="WEARABLE_ANOMALY",
                        title="Significant activity decline",
                        detail=f"Daily steps dropped {decline * 100:.0f}% from 14-day baseline ({ws.steps_daily_mean:.0f} vs {ws.steps_14d_baseline:.0f} baseline). May indicate deconditioning or pain.",
                        observation_ids=obs_ids[:5],
                        recommended_action="Assess mobility and pain at next visit.",
                    )))

        # ── Clinical trend flags (cross-reference FHIR Conditions) ─────────
        has_t2d = any(
            any(c.code == "44054006" for c in cond.code.coding)
            for cond in context.conditions
        )
        if has_t2d:
            hba1c_obs = [
                obs for obs in context.observations
                if obs.code.coding and obs.code.coding[0].code == LOINC_HBAIC
            ]
            if hba1c_obs:
                latest = hba1c_obs[0]
                val = latest.value_quantity.value if latest.value_quantity else 0
                if val >= HBAIC_HIGH_THRESHOLD:
                    candidates.append((9, AlertFlag(
                        flag_id=str(uuid.uuid4()),
                        severity="HIGH",
                        category="CLINICAL_TREND",
                        title=f"HbA1c above target ({val}%)",
                        detail=f"Latest HbA1c is {val}% [Obs:{latest.id}] — above 8% threshold in the context of T2D diagnosis. Combined with reduced activity, glycemic control may be worsening.",
                        observation_ids=[latest.id],
                        recommended_action="Review current Metformin dose; consider referral to endocrinology.",
                    )))

        has_htn = any(
            any(c.code == "38341003" for c in cond.code.coding)
            for cond in context.conditions
        )
        if has_htn:
            bp_obs = [
                obs for obs in context.observations
                if obs.code.coding and obs.code.coding[0].code == LOINC_SYSTOLIC_BP
            ]
            if bp_obs:
                latest_bp = bp_obs[0]
                val = latest_bp.value_quantity.value if latest_bp.value_quantity else 0
                if val >= SYSTOLIC_HIGH_THRESHOLD:
                    candidates.append((7, AlertFlag(
                        flag_id=str(uuid.uuid4()),
                        severity="MEDIUM",
                        category="CLINICAL_TREND",
                        title=f"Systolic BP elevated ({val} mmHg)",
                        detail=f"Latest systolic BP {val} mmHg [Obs:{latest_bp.id}] — at or above 140 mmHg threshold with active Hypertension diagnosis.",
                        observation_ids=[latest_bp.id],
                        recommended_action="Verify home BP readings; review Lisinopril and Amlodipine adherence.",
                    )))

        # Sort by priority desc, return top 2
        candidates.sort(key=lambda x: x[0], reverse=True)
        top_flags = [flag for _, flag in candidates[:2]]

        logger.info("alert_agent_run", patient_id=context.patient_id, flags_generated=len(top_flags))
        return AlertOutput(flags=top_flags)

    def _find_obs_ids(self, context: PatientContext, loinc_code: str) -> list[str]:
        """Find Observation IDs matching a LOINC code."""
        return [
            obs.id for obs in context.observations
            if obs.code.coding and any(c.code == loinc_code for c in obs.code.coding)
        ]


class WearableAgent:
    """
    Fully rule-based wearable anomaly detector. NO LLM.
    Anomaly detection is handled inside PatientContextAssembler._parse_wearable_summary().
    This agent surfaces those flags for the API layer.
    """

    agent_id = "wearable"

    def get_anomalies(self, context: PatientContext) -> list[str]:
        """Return rule-based anomaly flag strings from wearable summary."""
        if context.wearable_summary:
            return context.wearable_summary.anomaly_flags
        return []
