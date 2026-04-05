// src/stores/patientStore.ts
import { create } from 'zustand'
import type { PatientContext, AlertFlag } from '../types/api.types'

interface PatientState {
  context: PatientContext | null
  alerts: AlertFlag[]
  isLoading: boolean
  error: string | null
  setContext: (ctx: PatientContext) => void
  setAlerts: (alerts: AlertFlag[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const usePatientStore = create<PatientState>((set) => ({
  context: null,
  alerts: [],
  isLoading: false,
  error: null,
  setContext: (context) => set({ context }),
  setAlerts: (alerts) => set({ alerts }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ context: null, alerts: [], isLoading: false, error: null }),
}))
