"""Application configuration — loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Typed settings loaded from environment variables."""

    # App
    app_env: str = "development"
    log_level: str = "INFO"

    # FHIR
    hapi_fhir_base_url: str = "http://localhost:8080/fhir"

    # Database
    postgres_url: str = "postgresql://hapi:hapipassword@localhost:5432/hapi"

    # Redis
    redis_url: str = "redis://:redispassword@localhost:6379/0"
    redis_ttl_seconds: int = 300  # 5 minutes for FHIR read cache
    redis_context_ttl_seconds: int = 86400  # 24h for patient context

    # AI
    anthropic_api_key: str = ""

    # Auth (stubbed)
    clinician_token: str = ""
    patient_token: str = ""
    patient_id: str = "maria-chen-uuid"

    # Rate limiting
    rate_limit_requests_per_minute: int = 100

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
