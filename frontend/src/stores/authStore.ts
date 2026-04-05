// src/stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  token: string
  role: 'CLINICIAN' | 'PATIENT' | null
  userId: string
  patientId: string | null
  setAuth: (token: string, role: 'CLINICIAN' | 'PATIENT', userId: string, patientId?: string) => void
  clearAuth: () => void
}

// Default tokens match the demo values in .env.example
// CLINICIAN_TOKEN=demo-clinician-token  PATIENT_TOKEN=demo-patient-token
const CLINICIAN_TOKEN = import.meta.env.VITE_CLINICIAN_TOKEN || 'demo-clinician-token'
const PATIENT_TOKEN   = import.meta.env.VITE_PATIENT_TOKEN   || 'demo-patient-token'

export const useAuthStore = create<AuthState>((set) => ({
  token: CLINICIAN_TOKEN,
  role: 'CLINICIAN',
  userId: 'dr_priya_uuid',
  patientId: null,
  setAuth: (token, role, userId, patientId) =>
    set({ token, role, userId, patientId: patientId ?? null }),
  clearAuth: () => set({ token: '', role: null, userId: '', patientId: null }),
}))

// Helper: get patient-role store (used by PatientPage)
export const patientAuthStore = create<AuthState>((set) => ({
  token: PATIENT_TOKEN,
  role: 'PATIENT',
  userId: import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid',
  patientId: import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid',
  setAuth: (token, role, userId, patientId) =>
    set({ token, role, userId, patientId: patientId ?? null }),
  clearAuth: () => set({ token: '', role: null, userId: '', patientId: null }),
}))
