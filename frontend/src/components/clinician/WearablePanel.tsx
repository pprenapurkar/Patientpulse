// src/components/clinician/WearablePanel.tsx
import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { PatientContext, FHIRObservation } from '../../types/api.types'

function extractSeries(observations: FHIRObservation[], loincCode: string) {
  return observations
    .filter(o => o.category?.some(c => c.coding?.some(cd => cd.code === 'wearable')))
    .filter(o => o.code?.coding?.some(c => c.code === loincCode))
    .map(o => ({
      time: new Date(o.effectiveDateTime).getTime(),
      value: o.valueQuantity?.value ?? 0,
      label: new Date(o.effectiveDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }))
    .sort((a, b) => a.time - b.time)
}

function StatCard({ label, value, unit, alert }: { label: string; value: string | number; unit: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-teal-700'}`}>
        {value} <span className="text-sm font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}

function WearableChart({ data, color, unit, label, refVal }: {
  data: { time: number; value: number; label: string }[]
  color: string; unit: string; label: string; refVal?: number
}) {
  if (!data.length) return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-8">
      No {label} data
    </div>
  )
  const displayed = data.slice(-48)
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{unit} · 72h</p>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={displayed} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={11} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }} />
          {refVal && <ReferenceLine y={refVal} stroke="#f87171" strokeDasharray="4 2" />}
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props { context: PatientContext | undefined; isLoading: boolean }

export function WearablePanel({ context, isLoading }: Props) {
  const hrData = useMemo(() => extractSeries(context?.observations ?? [], '8867-4'), [context])
  const glucoseData = useMemo(() => extractSeries(context?.observations ?? [], '15074-8'), [context])
  const stepsData = useMemo(() => extractSeries(context?.observations ?? [], '55423-8'), [context])
  const anomalies = context?.wearable_summary?.anomaly_flags ?? []

  const nocturnalHR = context?.wearable_summary?.hr_nocturnal_mean
  const dailySteps = context?.wearable_summary?.steps_daily_mean
  const meanGlucose = context?.wearable_summary?.glucose_mean

  if (isLoading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-4" data-testid="wearable-panel">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Nocturnal HR" value={nocturnalHR ? Math.round(nocturnalHR) : '—'} unit="bpm" alert={!!nocturnalHR && nocturnalHR > 100} />
        <StatCard label="Daily Steps" value={dailySteps ? Math.round(dailySteps) : '—'} unit="steps" />
        <StatCard label="Mean Glucose" value={meanGlucose ? Math.round(meanGlucose) : '—'} unit="mg/dL" />
      </div>

      {/* Anomaly banners */}
      {anomalies.map((flag, i) => (
        <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-amber-500 mt-0.5">⚠</span>
          <p className="text-sm text-amber-800">{flag}</p>
        </div>
      ))}

      {/* Charts */}
      <WearableChart data={hrData} color="#0d9488" unit="bpm" label="Heart Rate — 72H" refVal={100} />
      <WearableChart data={glucoseData} color="#f59e0b" unit="mg/dL" label="Glucose — 72H" refVal={180} />
      <WearableChart data={stepsData} color="#6366f1" unit="steps" label="Daily Steps vs Baseline" />
    </div>
  )
}
