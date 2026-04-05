"""OrchestratorAgent — routes clinical queries to appropriate agents."""
from __future__ import annotations

from typing import Any, AsyncIterator

import structlog

from ai.agents.diagnostic_agent import DiagnosticAgent
from backend.app.schemas.agent_types import AgentResponse, PatientContext

logger = structlog.get_logger()


class OrchestratorAgent:
    """
    Routes clinical queries to specialist agents.
    Hackathon build: serial routing — all clinical queries → DiagnosticAgent.
    Production build: parallel fan-out.
    """

    agent_id = "orchestrator"

    def __init__(self) -> None:
        self.diagnostic = DiagnosticAgent()

    async def run(self, context: PatientContext, query: str, **kwargs: Any) -> AgentResponse:
        """Route query to DiagnosticAgent and return response."""
        logger.info("orchestrator_routing", patient_id=context.patient_id, route="DiagnosticAgent")
        return await self.diagnostic.run(context, query=query)

    async def stream(self, context: PatientContext, query: str) -> AsyncIterator[str]:
        """Stream diagnostic analysis for SSE endpoint."""
        logger.info("orchestrator_streaming", patient_id=context.patient_id)
        async for chunk in self.diagnostic.stream_run(context, query=query):
            yield chunk
