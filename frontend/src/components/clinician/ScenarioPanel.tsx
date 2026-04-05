// src/components/clinician/ScenarioPanel.tsx
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Loader2 } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { ScenarioResponse } from '../../types/api.types'

interface Props { patientId: string }

export function ScenarioPanel({ patientId }: Props) {
  const [result, setResult] = useState<ScenarioResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)

  const run = async (type: 'add_glp1' | 'increase_metformin') => {
    setIsLoading(true); setError(null); setActive(type)
    try {
      const res = await apiClient.runScenario(patientId, type)
      if (res.data) setResult(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scenario failed')
    } finally { setIsLoading(false) }
  }

  const scenarios = [
    { type: 'add_glp1' as const, label: 'Add GLP-1 Agonist', desc: 'Model 12-week HbA1c & weight projection for semaglutide' },
    { type: 'increase_metformin' as const, label: 'Increase Metformin', desc: 'Model effect of dose increase to 2000 mg/day' },
  ]

  const severityStyles: Record<string, { color: string; bg: string; border: string; label: string }> = {
    NONE:     { color:'var(--teal-dark)', bg:'var(--teal-light)', border:'var(--teal-border)', label:'No significant interactions' },
    MILD:     { color:'#92400E', bg:'#FAEEDA', border:'#FCD34D', label:'Mild interaction' },
    MODERATE: { color:'#9A3412', bg:'#FFF7ED', border:'#FED7AA', label:'Moderate interaction risk' },
    SEVERE:   { color:'#7F1D1D', bg:'var(--pp-danger-bg)', border:'#FCA5A5', label:'Severe interaction risk' },
  }

  return (
    <div style={{ padding:24 }} data-testid="scenario-panel">

      {/* Scenario cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {scenarios.map(s => (
          <button key={s.type} onClick={() => run(s.type)} disabled={isLoading} style={{
            textAlign:'left', padding:16, borderRadius:10, cursor: isLoading ? 'not-allowed' : 'pointer',
            border: active === s.type ? '1.5px solid var(--teal)' : '1.5px solid var(--pp-border)',
            background: active === s.type ? 'var(--teal-light)' : '#fff',
            transition:'all 0.2s', opacity: isLoading ? 0.6 : 1,
          }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--teal-light)', border:'1px solid var(--teal-border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="1.8"><path d="M6 2v6L3 13h10L10 8V2M6 2h4"/></svg>
            </div>
            <p style={{ fontSize:14, fontWeight:600, color: active === s.type ? 'var(--teal-dark)' : 'var(--pp-text)', margin:'0 0 4px' }}>{s.label}</p>
            <p style={{ fontSize:12, color:'var(--pp-text-muted)', margin:0 }}>{s.desc}</p>
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', padding:'32px 0' }}>
          <Loader2 size={18} color="var(--teal)" style={{ animation:'spin 1s linear infinite' }} />
          <span style={{ fontSize:13, color:'var(--pp-text-muted)' }}>Running scenario…</span>
        </div>
      )}

      {error && (
        <div style={{ fontSize:13, color:'var(--pp-danger)', background:'var(--pp-danger-bg)', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
          {error}
        </div>
      )}

      {result && !isLoading && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Drug interaction */}
          <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>Drug Interaction Check</span>
              {(() => {
                const s = severityStyles[result.interaction_result.overall_severity] ?? severityStyles.NONE
                return (
                  <span style={{ fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}`, borderRadius:5, padding:'2px 8px' }}>
                    {result.interaction_result.overall_severity}
                  </span>
                )
              })()}
            </div>
            <p style={{ fontSize:13, color:'var(--pp-text-sec)', margin:0 }}>
              {severityStyles[result.interaction_result.overall_severity]?.label ?? result.interaction_result.overall_severity}
            </p>
            <p style={{ fontSize:11, color:'var(--pp-text-muted)', marginTop:4 }}>via RxNorm · {result.interaction_result.data_source}</p>
          </div>

          {/* Projection chart */}
          <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>12-Week Projection</span>
                <span style={{ fontSize:11, color:'var(--pp-text-muted)', marginLeft:8 }}>Baseline HbA1c 8.2%</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--teal-dark)' }}>
                HbA1c {result.projection.hba1c_delta_range[0]}% to {result.projection.hba1c_delta_range[1]}%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={result.projection.chart_data} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pp-border)" />
                <XAxis dataKey="week" tick={{ fontSize:9, fill:'var(--pp-text-muted)' }} />
                <YAxis tick={{ fontSize:9, fill:'var(--pp-text-muted)' }} domain={['auto','auto']} />
                <Tooltip contentStyle={{ background:'#fff', border:'1px solid var(--pp-border)', fontSize:11, borderRadius:8 }} />
                <ReferenceLine y={8.2} stroke="var(--pp-border2)" strokeDasharray="4 2" label={{ value:'Baseline 8.2%', fontSize:9, fill:'var(--pp-text-muted)' }} />
                <Line type="monotone" dataKey="hba1c_projected" stroke="var(--teal)" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Narrative */}
          <div style={{ background:'var(--pp-surface2)', border:'1px solid var(--pp-border)', borderRadius:10, padding:'14px 16px' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', margin:'0 0 8px' }}>Clinical Narrative</p>
            <p style={{ fontSize:13, color:'var(--pp-text-sec)', lineHeight:1.7, margin:0 }}>{result.narrative}</p>
          </div>

          {/* Disclaimer */}
          <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:8, padding:'10px 14px', textAlign:'center', fontSize:11, color:'var(--pp-text-muted)' }}>
            ⚠ {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  )
}
