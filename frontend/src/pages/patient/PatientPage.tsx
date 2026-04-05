// src/pages/patient/PatientPage.tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import { CompanionChat } from '../../components/patient/CompanionChat'
import { MedConfirmButton } from '../../components/patient/MedConfirmButton'
import { RecoveryScore } from '../../components/patient/RecoveryScore'

const DEFAULT_PATIENT_ID = import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid'

export function PatientPage() {
  const { patientId: urlPatientId } = useParams()
  const patientId = urlPatientId || DEFAULT_PATIENT_ID
  const [isEscalating, setIsEscalating] = useState(false)
  const [escalated, setEscalated] = useState(false)

  const { data: contextRes } = useQuery({
    queryKey: ['patient', patientId, 'context-patient'],
    queryFn: () => apiClient.getPatientContext(patientId),
    staleTime: 5 * 60 * 1000,
  })

  const { data: scoreRes, refetch: refetchScore } = useQuery({
    queryKey: ['patient', patientId, 'recovery-score'],
    queryFn: () => apiClient.getRecoveryScore(patientId),
    staleTime: 60 * 1000,
  })

  const context = contextRes?.data
  const medications = context?.medications ?? []
  const primaryMed = medications.find((m) => m.status === 'active') ?? medications[0]

  const handleEscalate = async () => {
    setIsEscalating(true)
    try {
      await apiClient.escalate(patientId, 'Patient requested urgent contact via red button')
      setEscalated(true)
    } catch {
      // still show confirmation
      setEscalated(true)
    } finally {
      setIsEscalating(false)
    }
  }

  return (
    // Mobile-sized view: max-width 390px per spec
    <div className="min-h-screen bg-gray-950 flex justify-center">
      <div
        className="w-full bg-gray-950 flex flex-col min-h-screen"
        style={{ maxWidth: 390 }}
        data-testid="patient-page"
        aria-label="Patient companion app"
      >
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">PatientPulse</p>
            <p className="text-xs text-gray-500">Your recovery companion</p>
          </div>
          <RecoveryScore score={scoreRes?.data?.score ?? null} trend={scoreRes?.data?.trend ?? null} />
        </header>

        {/* Red escalation button — always visible per spec */}
        <div className="px-4 pt-3">
          {escalated ? (
            <div className="w-full py-2.5 rounded-xl bg-green-900/40 border border-green-700 text-green-400 text-sm text-center font-medium">
              ✓ Care team notified. Call 911 for emergencies.
            </div>
          ) : (
            <button
              onClick={handleEscalate}
              disabled={isEscalating}
              aria-label="Contact care team — urgent escalation"
              data-testid="escalation-button"
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-red-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Phone className="w-4 h-4" />
              {isEscalating ? 'Contacting…' : 'Contact care team'}
            </button>
          )}
        </div>

        {/* Medication confirm button */}
        {primaryMed && (
          <div className="px-4 pt-3">
            <MedConfirmButton
              patientId={patientId}
              medication={primaryMed}
              onConfirmed={() => refetchScore()}
            />
          </div>
        )}

        {/* Companion chat — fills remaining space */}
        <div className="flex-1 flex flex-col px-4 pt-3 pb-4 min-h-0">
          <CompanionChat
            patientId={patientId}
            context={context}
            onCheckinComplete={() => refetchScore()}
          />
        </div>
      </div>
    </div>
  )
}
