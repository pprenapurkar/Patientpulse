// src/components/clinician/WearablePanel.tsx
import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { PatientContext, FHIRObservation } from '../../types/api.types'

function extractWearableSeries(observations: FHIRObservation[], loincCode: string) {
  return observations
    .filter((o) => o.category.some((c) => c.coding.some((cd) => cd.code === 'wearable')))
    .filter((o) => o.code.coding.some((c) => c.code === loincCode))
    .map((o) => ({
      time: new Date(o.effectiveDateTime).getTime(),
      value: o.valueQuantity?.value ?? 0,
      label: new Date(o.effectiveDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }))
    .sort((a, b) => a.time - b.time)
}

function WearableChart({
  data,
  color,
  unit,
  label,
  referenceValue,
  referenceLabel,
}: {
  data: { time: number; value: number; label: string }[]
  color: string
  unit: string
  label: string
  referenceValue?: number
  referenceLabel?: string
}) {
  if (!data.length) return <p className="text-xs text-gray-600 italic py-4 text-center">No {label} data</p>

  const displayed = data.slice(-48)

  return (
    <div
      role="img"
      aria-label={`${label} chart showing ${data.length} data points over 72 hours`}
      data-testid={`chart-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-300">{label}</p>
        <p className="text-xs text-gray-500">{unit} · 72h</p>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={displayed} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} interval={11} />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
          />
          {referenceValue && (
            <ReferenceLine
              y={referenceValue}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: referenceLabel, position: 'right', fontSize: 9, fill: '#ef4444' }}
            />
          )}
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props {
  context: PatientContext | undefined
  isLoading: boolean
}

export function WearablePanel({ context, isLoading }: Props) {
  const hrData = useMemo(
    () => extractWearableSeries(context?.observations ?? [], '8867-4'),
    [context],
  )
  const glucoseData = useMemo(
    () => extractWearableSeries(context?.observations ?? [], '15074-8'),
    [context],
  )
  const stepsData = useMemo(
    () => extractWearableSeries(context?.observations ?? [], '55423-8'),
    [context],
  )

  const anomalies = context?.wearable_summary?.anomaly_flags ?? []

  if (isLoading) {
    return (
      <div className="p-4 space-y-4" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <section
      className="p-4 border-b border-gray-800"
      aria-label="Wearable data panel"
      data-testid="wearable-panel"
    >
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4">
        Wearable Data · 72h
      </p>

      {anomalies.length > 0 && (
        <div className="mb-3 space-y-1">
          {anomalies.map((flag, i) => (
            <p key={i} className="text-xs text-amber-400 bg-amber-950/20 border border-amber-800/40 rounded px-2 py-1">
              ⚠ {flag}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-5">
        <WearableChart
          data={hrData}
          color="#f97316"
          unit="bpm"
          label="Heart Rate"
          referenceValue={100}
          referenceLabel="100"
        />
        <WearableChart
          data={glucoseData}
          color="#8b5cf6"
          unit="mg/dL"
          label="Glucose (CGM)"
          referenceValue={180}
          referenceLabel="180"
        />
        <WearableChart data={stepsData} color="#22d3ee" unit="steps" label="Steps" />
      </div>
    </section>
  )
}
