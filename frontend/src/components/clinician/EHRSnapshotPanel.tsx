// src/components/clinician/EHRSnapshotPanel.tsx

import { Pill, FlaskConical, Heart } from 'lucide-react'
import type { PatientContext, FHIRObservation } from '../../types/api.types'

function TrendArrow({ value, reference }: { value: number; reference: number }) {
  if (value > reference * 1.05)
    return <span className="text-red-400 font-bold" aria-label="elevated">↑</span>
  if (value < reference * 0.95)
    return <span className="text-green-400 font-bold" aria-label="decreased">↓</span>
  return <span className="text-gray-400" aria-label="stable">→</span>
}

function LabRow({ obs }: { obs: FHIRObservation }) {
  const display = obs.code.coding[0]?.display ?? obs.code.text ?? 'Unknown'
  const val = obs.valueQuantity
  const shortName = display.length > 28 ? display.slice(0, 28) + '…' : display
  const date = new Date(obs.effectiveDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60 last:border-0" data-testid="lab-row">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 truncate">{shortName}</p>
        <p className="text-xs text-gray-600">{date}</p>
      </div>
      {val && (
        <div className="flex items-center gap-1 text-right">
          <span className="text-sm font-mono text-white">{val.value}</span>
          <span className="text-xs text-gray-500">{val.unit}</span>
          <TrendArrow value={val.value} reference={val.value} />
        </div>
      )}
    </div>
  )
}

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-3 ${w} bg-gray-800 rounded animate-pulse mb-2`} />
}

interface Props {
  context: PatientContext | undefined
  isLoading: boolean
}

export function EHRSnapshotPanel({ context, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-4" aria-busy="true" aria-label="Loading EHR snapshot">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <SkeletonLine w="w-1/3" />
            <SkeletonLine />
            <SkeletonLine />
          </div>
        ))}
      </div>
    )
  }

  if (!context) return null

  const labObs = context.observations.filter((o) =>
    o.category.some((c) => c.coding.some((cd) => cd.code === 'laboratory' || cd.code === 'vital-signs')),
  ).slice(0, 5)

  const conditions = context.conditions
  const medications = context.medications

  return (
    <div className="p-4" data-testid="ehr-snapshot-panel">
      {/* Patient summary */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Patient</p>
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <p className="text-gray-300 text-sm">
            {context.patient_summary.sex === 'female' ? '♀' : '♂'}{' '}
            <span className="font-semibold text-white">{context.patient_summary.age}y</span>
          </p>
          {context.patient_summary.discharge_date && (
            <p className="text-xs text-gray-500 mt-1">
              Discharged{' '}
              {new Date(context.patient_summary.discharge_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Heart className="w-3.5 h-3.5 text-red-400" />
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Conditions</p>
        </div>
        <div className="space-y-1">
          {conditions.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1" data-testid="condition-row">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-xs text-gray-300">
                {c.code.coding[0]?.display ?? c.code.text ?? 'Unknown'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Pill className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Medications</p>
        </div>
        <div className="space-y-1">
          {medications.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1" data-testid="medication-row">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs text-gray-300">
                {m.medicationCodeableConcept.coding[0]?.display ?? 'Unknown'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Labs */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Recent Labs</p>
        </div>
        {labObs.length > 0 ? (
          labObs.map((obs) => <LabRow key={obs.id} obs={obs} />)
        ) : (
          <p className="text-xs text-gray-600">No recent labs</p>
        )}
      </div>
    </div>
  )
}
