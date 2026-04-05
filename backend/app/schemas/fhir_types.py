"""FHIR R4 resource Pydantic models (subset used by PatientPulse)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# Shared config: accept both snake_case and camelCase input, always output camelCase
_ALIAS_CONFIG = ConfigDict(populate_by_name=True)


class Coding(BaseModel):
    model_config = _ALIAS_CONFIG
    system: str
    code: str
    display: str | None = None


class CodeableConcept(BaseModel):
    model_config = _ALIAS_CONFIG
    coding: list[Coding]
    text: str | None = None


class Reference(BaseModel):
    model_config = _ALIAS_CONFIG
    reference: str
    display: str | None = None


class ValueQuantity(BaseModel):
    model_config = _ALIAS_CONFIG
    value: float
    unit: str
    system: str = "http://unitsofmeasure.org"
    code: str


class FHIRCondition(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["Condition"] = Field(alias="resourceType", default="Condition")
    id: str
    clinical_status: CodeableConcept = Field(alias="clinicalStatus")
    code: CodeableConcept
    subject: Reference
    onset_date_time: datetime | None = Field(alias="onsetDateTime", default=None)

    @field_validator("subject")
    @classmethod
    def subject_must_be_patient(cls, v: Reference) -> Reference:
        if not v.reference.startswith("Patient/"):
            raise ValueError("subject.reference must start with 'Patient/'")
        return v


class FHIRMedicationStatement(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["MedicationStatement"] = Field(alias="resourceType", default="MedicationStatement")
    id: str
    status: Literal["active", "completed", "stopped"]
    medication_codeable_concept: CodeableConcept = Field(alias="medicationCodeableConcept")
    subject: Reference
    dosage: list[dict] | None = None


class FHIRObservation(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["Observation"] = Field(alias="resourceType", default="Observation")
    id: str
    status: Literal["final", "preliminary", "amended"]
    category: list[CodeableConcept]
    code: CodeableConcept
    subject: Reference
    effective_date_time: datetime = Field(alias="effectiveDateTime")
    value_quantity: ValueQuantity | None = Field(alias="valueQuantity", default=None)
    value_string: str | None = Field(alias="valueString", default=None)


class FHIRAllergyIntolerance(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["AllergyIntolerance"] = Field(alias="resourceType", default="AllergyIntolerance")
    id: str
    code: CodeableConcept
    patient: Reference
    criticality: str | None = None


class FHIREncounter(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["Encounter"] = Field(alias="resourceType", default="Encounter")
    id: str
    status: str
    subject: Reference
    period: dict | None = None


class FHIRCarePlan(BaseModel):
    model_config = _ALIAS_CONFIG

    resource_type: Literal["CarePlan"] = Field(alias="resourceType", default="CarePlan")
    id: str
    status: str
    subject: Reference
