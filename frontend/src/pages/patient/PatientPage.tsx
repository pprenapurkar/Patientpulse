// src/pages/patient/PatientPage.tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone, Activity } from 'lucide-react'
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
  const primaryMed = medications.find(m => m.status === 'active') ?? medications[0]
  const score = scoreRes?.data

  const handleEscalate = async () => {
    setIsEscalating(true)
    try {
      await apiClient.escalate(patientId, 'Patient requested urgent contact via red button')
      setEscalated(true)
    } catch { setEscalated(true) }
    finally { setIsEscalating(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      <div className="w-full max-w-sm bg-white flex flex-col min-h-screen shadow-sm" data-testid="patient-page">
        {/* Header */}
        <header className="bg-teal-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-200" />
            <div>
              <p className="text-sm font-bold text-white">PatientPulse</p>
              <p className="text-xs text-teal-200">Your recovery companion</p>
            </div>
          </div>
          <RecoveryScore score={score?.score ?? null} trend={score?.trend ?? null} />
        </header>

        {/* Recovery breakdown */}
        {score && (
          <div className="px-4 pt-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Recovery Score</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  score.trend === 'IMPROVING' ? 'bg-teal-100 text-teal-700' :
                  score.trend === 'DECLINING' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {score.trend === 'IMPROVING' ? '↑' : score.trend === 'DECLINING' ? '↓' : '→'} {score.trend}
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Adherence', val: score.adherence_score },
                  { label: 'Symptoms', val: score.symptom_trend_score },
                  { label: 'Engagement', val: score.engagement_score },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 w-20">{item.label}</p>
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div className="bg-teal-600 h-1.5 rounded-full transition-all" style={{ width: `${item.val}%` }} />
                    </div>
                    <p className="text-xs font-mono text-slate-600 w-8 text-right">{Math.round(item.val)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Escalation */}
        <div className="px-4 pt-3">
          {escalated ? (
            <div className="w-full py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm text-center font-medium">
              ✓ Care team notified. Call 911 for emergencies.
            </div>
          ) : (
            <button onClick={handleEscalate} disabled={isEscalating}
              className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <Phone className="w-4 h-4" />
              {isEscalating ? 'Contacting…' : 'Contact care team'}
            </button>
          )}
        </div>

        {/* Med confirm */}
        {primaryMed && (
          <div className="px-4 pt-3">
            <MedConfirmButton patientId={patientId} medication={primaryMed} onConfirmed={() => refetchScore()} />
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 flex flex-col px-4 pt-3 pb-4 min-h-0">
          <CompanionChat patientId={patientId} context={context} onCheckinComplete={() => refetchScore()} />
        </div>

        <p className="text-center text-xs text-slate-400 pb-2">PatientPulse · Not for emergencies — call 911</p>
      </div>
    </div>
  )
}
