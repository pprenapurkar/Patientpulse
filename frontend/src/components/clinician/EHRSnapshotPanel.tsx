// src/components/clinician/EHRSnapshotPanel.tsx
import type { PatientContext, FHIRObservation } from '../../types/api.types'

function TrendArrow({ value, reference }: { value: number; reference: number }) {
  if (value > reference * 1.05) return <span className="text-red-500 font-bold text-xs">↑</span>
  if (value < reference * 0.95) return <span className="text-teal-600 font-bold text-xs">↓</span>
  return <span className="text-slate-400 text-xs">→</span>
}

interface Props { context: PatientContext | undefined; isLoading: boolean }

export function EHRSnapshotPanel({ context, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!context) return <div className="p-6 text-slate-400 text-sm">No data available.</div>

  const labObs: FHIRObservation[] = context.observations.filter(o =>
    o.category?.some(c => c.coding?.some(cd => cd.code === 'laboratory' || cd.code === 'vital-signs'))
  ).slice(0, 10)

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
          Snapshot of FHIR digital twin
        </p>
        <p className="text-xs text-slate-400">assembled {new Date().toLocaleTimeString()}</p>
      </div>

      {/* Observations table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-4 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-400 uppercase font-semibold">
          <span>Observation</span>
          <span className="text-right">Value</span>
          <span className="text-right">Date</span>
          <span className="text-right">ID</span>
        </div>
        {labObs.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No recent observations</p>
        )}
        {labObs.map((obs, i) => {
          const display = obs.code?.coding?.[0]?.display ?? obs.code?.text ?? 'Unknown'
          const val = obs.valueQuantity
          const date = new Date(obs.effectiveDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
          return (
            <div key={obs.id} className={`grid grid-cols-4 px-4 py-3 items-center text-sm border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
              <span className="text-slate-700 font-medium truncate pr-2">{display}</span>
              <span className="text-right font-mono font-semibold text-teal-700">
                {val ? `${val.value} ${val.unit}` : '—'}
                {val && <TrendArrow value={val.value} reference={val.value} />}
              </span>
              <span className="text-right text-slate-400 text-xs">{date}</span>
              <span className="text-right">
                <span className="text-xs font-mono bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100">
                  {obs.id?.slice(-8) ?? '—'}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
