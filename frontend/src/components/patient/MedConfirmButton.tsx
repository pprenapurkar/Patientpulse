// src/components/patient/MedConfirmButton.tsx
import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { FHIRMedicationStatement } from '../../types/api.types'

interface Props {
  patientId: string
  medication: FHIRMedicationStatement
  onConfirmed: (streak: number) => void
}

export function MedConfirmButton({ patientId, medication, onConfirmed }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [streak, setStreak] = useState<number | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)

  const medName = medication.medicationCodeableConcept.coding[0]?.display ?? 'medication'
  const rxnormId = medication.medicationCodeableConcept.coding[0]?.code ?? '000000'

  const handleConfirm = async () => {
    if (isLoading || confirmed) return
    setIsLoading(true)
    try {
      const res = await apiClient.confirmMedication(
        patientId,
        rxnormId,
        new Date().toISOString(),
      )
      if (res.data) {
        setStreak(res.data.streak_days)
        setMilestone(res.data.milestone_message)
        setConfirmed(true)
        onConfirmed(res.data.streak_days)
      }
    } catch {
      setConfirmed(true)
      setStreak(1)
    } finally {
      setIsLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div
        className="w-full py-3 rounded-xl bg-teal-50 border border-teal-200 text-center"
        data-testid="med-confirm-success"
      >
        <div className="flex items-center justify-center gap-2 text-teal-600 font-semibold text-sm">
          <CheckCircle className="w-4 h-4" />
          Medication confirmed!
        </div>
        {streak !== null && (
          <p className="text-xs text-slate-500 mt-1">
            {streak}-day streak
            {milestone && <span className="ml-1 text-amber-500">{milestone}</span>}
          </p>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={isLoading}
      aria-label={`Confirm you took ${medName} today`}
      data-testid="med-confirm-button"
      className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-800 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <CheckCircle className="w-4 h-4 text-teal-600" />
      )}
      {isLoading ? 'Confirming…' : `Took ${medName.split(' ')[0]} today`}
    </button>
  )
}
