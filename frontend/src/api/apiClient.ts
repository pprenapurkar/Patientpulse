// src/api/apiClient.ts — all API calls go through here, never raw fetch in components
import { useAuthStore, patientAuthStore } from '../stores/authStore'
import type {
  APIResponse,
  AlertsResponse,
  CheckinResponse,
  ConversationTurn,
  MedConfirmResponse,
  PatientContext,
  RecoveryScoreResponse,
  ScenarioResponse,
} from '../types/api.types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class APIError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

// Get the right token based on which store is active
function getToken(usePatientRole = false): string {
  return usePatientRole
    ? patientAuthStore.getState().token
    : useAuthStore.getState().token
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  usePatientRole = false,
): Promise<APIResponse<T>> {
  const token = getToken(usePatientRole)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  // Backend now returns data directly without wrapper
  const data = await res.json()

  if (!res.ok) {
    // Handle error responses
    throw new APIError(
      data.error || 'UNKNOWN',
      data.message || 'An unexpected error occurred',
    )
  }

  // Wrap the direct response in the expected APIResponse format
  return {
    status: 'success',
    data: data as T,
    error: undefined,
    request_id: 'client-generated',
    timestamp: new Date().toISOString(),
  }
}

export const apiClient = {
  // ── FHIR (clinician) ──────────────────────────────────────────────────────
  getPatientContext: (patientId: string) =>
    request<PatientContext>(`/api/v1/fhir/Patient/${patientId}/context`),

  // ── AI (clinician) ────────────────────────────────────────────────────────
  getAlerts: (patientId: string) =>
    request<AlertsResponse>(`/api/v1/ai/alerts/${patientId}`),

  runScenario: (patientId: string, scenarioType: 'add_glp1' | 'increase_metformin') =>
    request<ScenarioResponse>('/api/v1/ai/scenario', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, scenario_type: scenarioType }),
    }),

  // ── Patient routes (use PATIENT token) ───────────────────────────────────
  submitCheckin: (patientId: string, message: string, history: ConversationTurn[]) =>
    request<CheckinResponse>(
      '/api/v1/patient/checkin',
      { method: 'POST', body: JSON.stringify({ patient_id: patientId, message, conversation_history: history }) },
      true, // usePatientRole
    ),

  confirmMedication: (patientId: string, medicationRxnormId: string, confirmedAt: string) =>
    request<MedConfirmResponse>(
      '/api/v1/patient/med-confirm',
      { method: 'POST', body: JSON.stringify({ patient_id: patientId, medication_rxnorm_id: medicationRxnormId, confirmed_at: confirmedAt }) },
      true,
    ),

  escalate: (patientId: string, reason: string) =>
    request(
      '/api/v1/patient/escalate',
      { method: 'POST', body: JSON.stringify({ patient_id: patientId, reason, severity: 'HIGH' }) },
      true,
    ),

  getRecoveryScore: (patientId: string) =>
    request<RecoveryScoreResponse>(`/api/v1/patient/recovery-score/${patientId}`, {}, true),

  // Recovery score via clinician token (clinician view)
  getRecoveryScoreClinician: (patientId: string) =>
    request<RecoveryScoreResponse>(`/api/v1/patient/recovery-score/${patientId}`),
}

// ── SSE streaming for AI query ─────────────────────────────────────────────

export async function streamAIQuery(
  patientId: string,
  query: string,
  history: ConversationTurn[],
  onToken: (token: string) => void,
  onCitations: (citations: unknown[]) => void,
  onComplete: (meta: unknown) => void,
  onError: (code: string, message: string) => void,
): Promise<void> {
  const token = getToken(false) // clinician role
  const BASE = import.meta.env.VITE_API_BASE_URL || ''

  const res = await fetch(`${BASE}/api/v1/ai/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ patient_id: patientId, query, conversation_history: history }),
  })

  if (!res.body) {
    onError('STREAM_ERROR', 'No response body')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (eventType === 'token') onToken(data.token)
          else if (eventType === 'citations') onCitations(data.citations)
          else if (eventType === 'complete') onComplete(data)
          else if (eventType === 'error') onError(data.code, data.message)
        } catch {
          // ignore malformed SSE line
        }
      }
    }
  }
}
