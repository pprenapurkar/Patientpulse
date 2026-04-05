"""Security utilities — JWT token validation, PHI redaction."""
from __future__ import annotations

import structlog
from fastapi import HTTPException
from backend.app.core.config import get_settings

logger = structlog.get_logger()

# ── Token roles ───────────────────────────────────────────────────────────────

CLINICIAN_ROLE = "CLINICIAN"
PATIENT_ROLE = "PATIENT"
ADMIN_ROLE = "ADMIN"


class TokenPayload:
    """Parsed and validated JWT payload."""

    def __init__(self, sub: str, role: str, patient_id: str | None = None) -> None:
        self.sub = sub
        self.role = role
        self.patient_id = patient_id


def validate_token(token: str) -> TokenPayload:
    """
    Validate a bearer token and return the parsed payload.
    Hackathon build: accepts two hardcoded demo tokens.
    Production: replace with RS256 JWT validation + SMART on FHIR.
    """
    settings = get_settings()

    if token == settings.clinician_token:
        return TokenPayload(
            sub="dr_priya_uuid",
            role=CLINICIAN_ROLE,
            patient_id=None,
        )

    if token == settings.patient_token:
        return TokenPayload(
            sub=settings.patient_id,
            role=PATIENT_ROLE,
            patient_id=settings.patient_id,
        )

    logger.warning("auth_token_invalid", token_prefix=token[:10] if len(token) > 10 else "short")
    raise HTTPException(status_code=401, detail={"code": "AUTH_TOKEN_INVALID", "message": "Invalid token"})


# ── PHI Redaction ─────────────────────────────────────────────────────────────

PHI_FIELDS_PROHIBITED = [
    "name", "given", "family",
    "birthDate",
    "address", "line", "city", "postalCode",
    "telecom", "phone", "email",
    "ssn", "identifier",
]


class PHILeakError(Exception):
    """Raised when PHI is detected in context before AI call."""


class PHIRedactionValidator:
    """
    Validates that PatientContext does not contain prohibited PHI fields
    before being sent to the Claude API.
    """

    @staticmethod
    def validate(context_dict: dict) -> None:
        """Raise PHILeakError if any prohibited field contains non-null data."""
        violations = []

        for field in PHI_FIELDS_PROHIBITED:
            if PHIRedactionValidator._find_field(context_dict, field):
                violations.append(field)

        if violations:
            logger.critical("phi_leak_detected", fields=violations)
            raise PHILeakError(f"PHI fields detected before AI call: {violations}")

    @staticmethod
    def _find_field(obj: dict | list, target: str) -> bool:
        """Recursively search for a prohibited field with a non-null value."""
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == target and v is not None:
                    return True
                if isinstance(v, (dict, list)):
                    if PHIRedactionValidator._find_field(v, target):
                        return True
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, (dict, list)):
                    if PHIRedactionValidator._find_field(item, target):
                        return True
        return False
