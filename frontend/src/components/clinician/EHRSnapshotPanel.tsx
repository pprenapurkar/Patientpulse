// src/components/clinician/EHRSnapshotPanel.tsx
import type { PatientContext, FHIRObservation } from '../../types/api.types'

interface Props { context: PatientContext | undefined; isLoading: boolean }

export function EHRSnapshotPanel({ context, isLoading }: Props) {
  if (isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ height: 44, background: 'var(--pp-surface2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  if (!context) return <div style={{ padding: 24, color: 'var(--pp-text-muted)', fontSize: 13 }}>No data available.</div>

  const labObs: FHIRObservation[] = context.observations.filter(o =>
    o.category?.some(c => c.coding?.some(cd => cd.code === 'laboratory' || cd.code === 'vital-signs'))
  ).slice(0, 15)

  // Colour-code by value type
  const getValueColor = (obs: FHIRObservation) => {
    const name = obs.code?.coding?.[0]?.display?.toLowerCase() ?? ''
    const val = obs.valueQuantity?.value ?? 0
    if (name.includes('glucose') && val > 140) return '#E24B4A'
    if (name.includes('heart rate') && val > 100) return '#E24B4A'
    if (name.includes('blood pressure') && val > 130) return '#EF9F27'
    if (name.includes('hba1c') && val > 8) return '#EF9F27'
    if (name.includes('egfr') && val < 60) return '#E24B4A'
    return 'var(--teal-dark)'
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 14 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>
          Snapshot of FHIR Digital Twin
        </span>
        <span style={{ fontSize:11, color:'var(--pp-text-muted)' }}>
          assembled {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:10 }}>
        All Observations — Last 30 Days
      </div>

      <div style={{ background:'#fff', borderRadius:10, border:'1px solid var(--pp-border)', overflow:'hidden' }}>
        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr 1.5fr 1.2fr', padding:'10px 16px', background:'var(--pp-surface2)', borderBottom:'1px solid var(--pp-border)' }}>
          {['Observation','Value','Date','ID'].map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', textAlign: h==='ID' ? 'right' : h==='Value' ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>

        {labObs.length === 0 && (
          <p style={{ padding:'24px 16px', textAlign:'center', fontSize:13, color:'var(--pp-text-muted)' }}>No recent observations</p>
        )}

        {labObs.map((obs, i) => {
          const display = obs.code?.coding?.[0]?.display ?? obs.code?.text ?? 'Unknown'
          const val = obs.valueQuantity
          const date = new Date(obs.effectiveDateTime).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'2-digit' })
          const shortId = obs.id?.slice(-8) ?? '—'
          const valColor = val ? getValueColor(obs) : 'var(--pp-text-muted)'

          return (
            <div key={obs.id} style={{
              display:'grid', gridTemplateColumns:'3fr 2fr 1.5fr 1.2fr',
              padding:'10px 16px', alignItems:'center',
              borderBottom: i < labObs.length - 1 ? '1px solid var(--pp-border)' : 'none',
              background: i % 2 === 0 ? '#fff' : 'var(--pp-surface)',
            }}>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--pp-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:12 }}>{display}</span>
              <span style={{ fontSize:13, fontWeight:700, color: valColor, fontFamily:"'JetBrains Mono', monospace", textAlign:'right' }}>
                {val ? `${val.value} ${val.unit}` : '—'}
              </span>
              <span style={{ fontSize:12, color:'var(--pp-text-muted)', textAlign:'right' }}>{date}</span>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <span style={{ fontSize:10.5, fontWeight:600, color:'var(--teal)', background:'var(--teal-light)', border:'1px solid var(--teal-border)', borderRadius:5, padding:'2px 8px', fontFamily:"'JetBrains Mono', monospace", whiteSpace:'nowrap' }}>
                  {shortId}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
