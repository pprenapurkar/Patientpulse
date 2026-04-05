// src/components/patient/MedConfirmButton.tsx
import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { FHIRMedicationStatement } from '../../types/api.types'

interface Props {
  patientId: string
  medication: FHIRMedicationStatement
  onConfirmed: (streak: number) => void
  compact?: boolean
}

export function MedConfirmButton({ patientId, medication, onConfirmed, compact = false }: Props) {
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
      const res = await apiClient.confirmMedication(patientId, rxnormId, new Date().toISOString())
      if (res.data) {
        setStreak(res.data.streak_days)
        setMilestone(res.data.milestone_message)
        setConfirmed(true)
        onConfirmed(res.data.streak_days)
      }
    } catch {
      setConfirmed(true)
      setStreak(1)
    } finally { setIsLoading(false) }
  }

  // Compact mode: inline streak badge used in medication list rows
  if (compact) {
    if (confirmed) {
      return (
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <CheckCircle size={14} color="var(--teal)" />
          {streak !== null && (
            <span style={{ fontSize:11, fontWeight:700, color:'var(--pp-text-muted)' }}>
              🔥 {streak}d
            </span>
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
        style={{
          display:'flex', alignItems:'center', gap:5,
          background:'var(--teal-light)', border:'1px solid var(--teal-border)',
          borderRadius:20, padding:'4px 10px', cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize:11, fontWeight:600, color:'var(--teal-dark)',
        }}
      >
        {isLoading ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} /> : null}
        Tap to confirm
      </button>
    )
  }

  // Full mode (standalone card)
  if (confirmed) {
    return (
      <div style={{ width:'100%', padding:'12px 0', borderRadius:14, background:'var(--teal-light)', border:'1px solid var(--teal-border)', textAlign:'center' }} data-testid="med-confirm-success">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'var(--teal-dark)', fontWeight:600, fontSize:13 }}>
          <CheckCircle size={16} color="var(--teal)" />
          Medication confirmed!
        </div>
        {streak !== null && (
          <p style={{ fontSize:11, color:'var(--pp-text-muted)', margin:'4px 0 0' }}>
            {streak}-day streak {milestone && <span style={{ color:'#EF9F27', marginLeft:4 }}>{milestone}</span>}
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
      style={{
        width:'100%', padding:'12px 0', borderRadius:14,
        background:'var(--pp-surface2)', border:'1px solid var(--pp-border)',
        color:'var(--pp-text)', fontSize:13, fontWeight:500,
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        cursor: isLoading ? 'not-allowed' : 'pointer', transition:'background 0.15s',
      }}
    >
      {isLoading ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> : <CheckCircle size={15} color="var(--teal)" />}
      {isLoading ? 'Confirming…' : `Took ${medName.split(' ')[0]} today`}
    </button>
  )
}
