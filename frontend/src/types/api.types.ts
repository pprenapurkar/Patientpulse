// src/types/api.types.ts — mirrors backend agent_types.py and fhir_types.py exactly

// ── FHIR Types ─────────────────────────────────────────────────────────────

export interface Coding {
  system: string
  code: string
  display?: string
}

export interface CodeableConcept {
  coding: Coding[]
  text?: string
}

export interface Reference {
  reference: string
  display?: string
}

export interface ValueQuantity {
  value: number
  unit: string
  system: string
  code: string
}

export interface FHIRCondition {
  resourceType: 'Condition'
  id: string
  clinicalStatus: CodeableConcept
  code: CodeableConcept
  subject: Reference
  onsetDateTime?: string
}

export interface FHIRMedicationStatement {
  resourceType: 'MedicationStatement'
  id: string
  status: 'active' | 'completed' | 'stopped'
  medicationCodeableConcept: CodeableConcept
  subject: Reference
  dosage?: unknown[]
}

export interface FHIRObservation {
  resourceType: 'Observation'
  id: string
  status: 'final' | 'preliminary' | 'amended'
  category: CodeableConcept[]
  code: CodeableConcept
  subject: Reference
  effectiveDateTime: string
  valueQuantity?: ValueQuantity
  valueString?: string
}

// ── API Response Envelope ──────────────────────────────────────────────────

export interface APIResponse<T> {
  status: 'success' | 'error'
  request_id: string
  timestamp: string
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// ── Patient Context ────────────────────────────────────────────────────────

export interface PatientSummary {
  age: number
  sex: 'male' | 'female' | 'unknown'
  discharge_date: string | null
}

export interface WearableSummary {
  period_hours: number
  hr_mean: number
  hr_max: number
  hr_nocturnal_mean: number
  glucose_mean: number | null
  glucose_postprandial_max: number | null
  steps_daily_mean: number
  steps_14d_baseline: number
  anomaly_flags: string[]
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface PatientContext {
  patient_id: string
  patient_summary: PatientSummary
  conditions: FHIRCondition[]
  medications: FHIRMedicationStatement[]
  observations: FHIRObservation[]
  wearable_summary: WearableSummary | null
  conversation_history: ConversationTurn[]
  assembled_at: string
  data_freshness: 'live' | 'cached'
  cache_timestamp: string | null
}

// ── Alert Types ────────────────────────────────────────────────────────────

export interface AlertFlag {
  flag_id: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: 'WEARABLE_ANOMALY' | 'ADHERENCE' | 'CLINICAL_TREND'
  title: string
  detail: string
  observation_ids: string[]
  recommended_action: string | null
}

export interface AlertsResponse {
  patient_id: string
  flags: AlertFlag[]
  generated_at: string
}

// ── Scenario Types ─────────────────────────────────────────────────────────

export interface DrugInteraction {
  drug_a: string
  drug_b: string
  severity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
  description: string
  rxnorm_concept_id: string
}

export interface ProjectionDataPoint {
  week: number
  hba1c_projected: number
  weight_projected_kg: number | null
}

export interface ScenarioResponse {
  scenario_type: 'add_glp1' | 'increase_metformin'
  interaction_result: {
    checked_at: string
    interactions: DrugInteraction[]
    overall_severity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
    data_source: 'rxnorm_live' | 'rxnorm_cached'
  }
  projection: {
    weeks: number
    hba1c_delta_range: [number, number]
    weight_delta_range_kg: [number, number] | null
    chart_data: ProjectionDataPoint[]
  }
  narrative: string
  is_clinical_prediction: false
  disclaimer: string
}

// ── Check-in / Patient Types ───────────────────────────────────────────────

export interface CheckinResponse {
  reply: string
  extracted: {
    symptom_type: string | null
    severity_score: number | null
    severity_trend: 'IMPROVING' | 'STABLE' | 'WORSENING' | null
    medication_status: 'CONFIRMED' | 'PENDING' | 'REPORTED_ISSUE' | null
    flag_level: 'ROUTINE' | 'FOLLOW_UP' | 'ESCALATE'
  }
  recovery_score: number
  fhir_observations_written: string[]
}

export interface MedConfirmResponse {
  streak_days: number
  milestone_message: string | null
  fhir_observation_id: string
}

export interface RecoveryScoreResponse {
  patient_id: string
  score: number
  adherence_score: number
  symptom_trend_score: number
  engagement_score: number
  score_date: string
  components: {
    adherence_score: number
    symptom_trend_score: number
    engagement_score: number
  }
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
}

// ── SSE Citation type ──────────────────────────────────────────────────────

export interface SSECitation {
  observation_id: string
  value: string
  unit: string | null
}
