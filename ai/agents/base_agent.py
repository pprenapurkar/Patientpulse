"""BaseAgent — abstract base class all AI agents must extend."""
from __future__ import annotations

import time
import uuid
from abc import ABC, abstractmethod
from typing import Any

import anthropic
import structlog

from ai.prompts.registry import PromptRegistry
from backend.app.core.config import get_settings
from backend.app.core.security import PHIRedactionValidator
from backend.app.schemas.agent_types import AgentResponse, PatientContext

logger = structlog.get_logger()

CLAUDE_CONFIG = {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1000,
    "temperature": 0,
}

COMPANION_CLAUDE_CONFIG = {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 300,
    "temperature": 0.3,
    "stream": False,
}


class BaseAgent(ABC):
    """Abstract base — every LLM agent extends this."""

    agent_id: str
    prompt_name: str
    prompt_version: int = 1

    def __init__(self) -> None:
        settings = get_settings()
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.prompt = PromptRegistry.get(self.prompt_name, self.prompt_version)
        self.phi_validator = PHIRedactionValidator()

    @abstractmethod
    async def run(self, context: PatientContext, **kwargs: Any) -> AgentResponse:
        """All agents implement this method."""
        ...

    async def _call_claude(
        self,
        user_message: str,
        context: PatientContext,
        stream: bool = False,
        companion_mode: bool = False,
    ) -> str | anthropic.Stream:
        """Call Claude API with PHI validation and audit logging."""
        # 1. Validate no PHI before call
        context_dict = context.model_dump(mode="json")
        self.phi_validator.validate(context_dict)

        # 2. Build messages
        messages = [{"role": "user", "content": user_message}]

        # 3. Select config
        cfg = COMPANION_CLAUDE_CONFIG if companion_mode else CLAUDE_CONFIG

        # 4. Call Claude API
        start = time.monotonic()
        request_id = str(uuid.uuid4())

        response = self.client.messages.create(
            model=cfg["model"],
            max_tokens=cfg["max_tokens"],
            temperature=cfg.get("temperature", 0),
            system=self.prompt,
            messages=messages,
            stream=stream,
        )

        latency_ms = int((time.monotonic() - start) * 1000)

        # 5. Log safe fields only — never log prompt text or patient values
        logger.info(
            "claude_api_call",
            agent_id=self.agent_id,
            prompt_name=self.prompt_name,
            prompt_version=self.prompt_version,
            model=cfg["model"],
            latency_ms=latency_ms,
            patient_id=context.patient_id,
            request_id=request_id,
        )

        if stream:
            return response
        return response.content[0].text

    def _make_response(
        self,
        context: PatientContext,
        output: dict,
        citations: list | None = None,
        latency_ms: int = 0,
    ) -> AgentResponse:
        """Build a standard AgentResponse envelope."""
        return AgentResponse(
            agent_id=self.agent_id,
            patient_id=context.patient_id,
            request_id=str(uuid.uuid4()),
            output=output,
            citations=citations or [],
            latency_ms=latency_ms,
            model_version=CLAUDE_CONFIG["model"],
            prompt_version=self.prompt_version,
            is_clinical_prediction=False,
        )
