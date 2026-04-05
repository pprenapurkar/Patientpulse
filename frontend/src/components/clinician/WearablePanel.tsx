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
    <div style={{
      background: alert ? '#FFF8F5' : '#fff',
      border: `1px solid ${alert ? '#FCA5A5' : 'var(--pp-border)'}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <p style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', margin:'0 0 6px' }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:600, color: alert ? '#E24B4A' : 'var(--teal-dark)', fontFamily:"'JetBrains Mono', monospace", margin:0, lineHeight:1.1 }}>
        {value}<span style={{ fontSize:14, fontWeight:400, color:'var(--pp-text-muted)', marginLeft:4 }}>{unit}</span>
      </p>
    </div>
  )
}

function WearableChart({ data, color, unit, label, refVal, refColor }: {
  data: { time: number; value: number; label: string }[]
  color: string; unit: string; label: string; refVal?: number; refColor?: string
}) {
  if (!data.length) return (
    <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:10, padding:'24px 16px', textAlign:'center', color:'var(--pp-text-muted)', fontSize:13 }}>
      No {label} data
    </div>
  )
  const displayed = data.slice(-48)
  return (
    <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:10, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>{label}</span>
        </div>
        {refVal && (
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#E24B4A' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#E24B4A', display:'inline-block' }} />
            Alert threshold ({refVal} {unit})
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={displayed} margin={{ top:5, right:5, left:-20, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pp-border)" />
          <XAxis dataKey="label" tick={{ fontSize:9, fill:'var(--pp-text-muted)' }} interval={11} />
          <YAxis tick={{ fontSize:9, fill:'var(--pp-text-muted)' }} />
          <Tooltip contentStyle={{ background:'#fff', border:'1px solid var(--pp-border)', fontSize:11, borderRadius:8, fontFamily:"'DM Sans', sans-serif" }} />
          {refVal && <ReferenceLine y={refVal} stroke={refColor ?? '#E24B4A'} strokeDasharray="4 2" />}
          <Line type="monotone" dataKey="value" stroke={color} dot={color === '#EF9F27'} strokeWidth={2} dotRadius={4} />
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
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:12 }}>
      {[1,2,3].map(i => <div key={i} style={{ height:128, background:'var(--pp-surface2)', borderRadius:10 }} />)}
    </div>
  )

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }} data-testid="wearable-panel">
      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        <StatCard label="Nocturnal HR"  value={nocturnalHR  ? Math.round(nocturnalHR)  : '—'} unit="bpm"   alert={!!nocturnalHR && nocturnalHR > 100} />
        <StatCard label="Daily Steps"   value={dailySteps   ? Math.round(dailySteps)   : '—'} unit="steps" />
        <StatCard label="Mean Glucose"  value={meanGlucose  ? Math.round(meanGlucose)  : '—'} unit="mg/dL" />
      </div>

      {/* Anomaly banners */}
      {anomalies.map((flag, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--pp-warning-bg)', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--pp-warning)', fontWeight:500 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 13H2L8 2Z" stroke="var(--pp-warning)" strokeWidth="1.5"/><path d="M8 6V9M8 11V11.5" stroke="var(--pp-warning)" strokeWidth="1.5" strokeLinecap="round"/></svg>
          {flag}
        </div>
      ))}

      {/* Charts */}
      <WearableChart data={hrData}      color="var(--teal)"  unit="bpm"   label="Heart Rate — 72H"           refVal={100} />
      <WearableChart data={glucoseData} color="#EF9F27"       unit="mg/dL" label="Glucose — 72H"              refVal={180} />
      <WearableChart data={stepsData}   color="#6366f1"       unit="steps" label="Daily Steps vs Baseline" />
    </div>
  )
}
