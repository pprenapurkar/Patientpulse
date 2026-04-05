"""ConversationStore — persists conversation history in Redis (TTL: 24h)."""
from __future__ import annotations

import json
from datetime import datetime

import structlog

from backend.app.schemas.agent_types import ConversationTurn
from backend.app.core.config import get_settings

logger = structlog.get_logger()

CONTEXT_TTL = 86400  # 24 hours


class ConversationStore:
    """Stores conversation history per patient in Redis with 24h TTL."""

    def __init__(self) -> None:
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis
            settings = get_settings()
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    def _key(self, patient_id: str) -> str:
        return f"conv:{patient_id}"

    async def get_history(self, patient_id: str) -> list[ConversationTurn]:
        """Retrieve conversation history for a patient."""
        try:
            redis = await self._get_redis()
            raw = await redis.get(self._key(patient_id))
            if not raw:
                return []
            turns = json.loads(raw)
            return [ConversationTurn(**t) for t in turns]
        except Exception as e:
            logger.warning("conv_store_get_error", patient_id=patient_id, error=str(e))
            return []

    async def append(self, patient_id: str, role: str, content: str) -> None:
        """Append a turn to conversation history and enforce 10-turn limit."""
        try:
            redis = await self._get_redis()
            history = await self.get_history(patient_id)
            history.append(ConversationTurn(role=role, content=content, timestamp=datetime.utcnow()))
            # Keep last 10 turns
            history = history[-10:]
            await redis.set(
                self._key(patient_id),
                json.dumps([t.model_dump(mode="json") for t in history]),
                ex=CONTEXT_TTL,
            )
        except Exception as e:
            logger.warning("conv_store_append_error", patient_id=patient_id, error=str(e))
