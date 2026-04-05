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
  const activeMeds = medications.filter(m => m.status === 'active')
  const score = scoreRes?.data

  const handleEscalate = async () => {
    setIsEscalating(true)
    try {
      await apiClient.escalate(patientId, 'Patient requested urgent contact via red button')
      setEscalated(true)
    } catch { setEscalated(true) }
    finally { setIsEscalating(false) }
  }

  const trendColor =
    score?.trend === 'IMPROVING' ? '#0D9E75' :
    score?.trend === 'DECLINING' ? '#E24B4A' : '#EF9F27'

  const trendLabel =
    score?.trend === 'IMPROVING' ? '↑ Improving' :
    score?.trend === 'DECLINING' ? '↘ Declining' : '→ Stable'

  const trendBg =
    score?.trend === 'IMPROVING' ? '#E1F5EE' :
    score?.trend === 'DECLINING' ? '#FEF2F2' : '#FAEEDA'

  return (
    <div style={{ minHeight:'100vh', background:'var(--pp-surface)', display:'flex', justifyContent:'center', fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes pp-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ width:'100%', maxWidth:420, background:'#fff', display:'flex', flexDirection:'column', minHeight:'100vh', boxShadow:'0 0 40px rgba(13,158,117,0.08)' }} data-testid="patient-page">

        {/* ── HEADER ── */}
        <header style={{ padding:'12px 16px', background:'#fff', borderBottom:'1px solid var(--pp-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0D9E75,#5DCAA5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Activity size={18} color="white" />
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--pp-text)', margin:0, letterSpacing:'-0.2px' }}>Pulse</p>
              <p style={{ fontSize:11, color:'var(--pp-text-muted)', margin:0 }}>Recovery Companion</p>
            </div>
          </div>
          <RecoveryScore score={score?.score ?? null} trend={score?.trend ?? null} />
        </header>

        {/* ── RECOVERY SCORE CARD ── */}
        {score && (
          <div style={{ padding:'12px 16px 0' }}>
            <div style={{ background:'var(--pp-surface)', border:'1px solid var(--pp-border)', borderRadius:14, padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>

                {/* Donut */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="var(--pp-border)" strokeWidth="6" />
                    <circle cx="36" cy="36" r="28" fill="none"
                      stroke={trendColor}
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 28 * (score.score / 100)} ${2 * Math.PI * 28}`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:18, fontWeight:700, color:'var(--pp-text)', lineHeight:1, fontFamily:"'JetBrains Mono', monospace" }}>{Math.round(score.score)}</span>
                    <span style={{ fontSize:9, color:'var(--pp-text-muted)', fontWeight:500 }}>/100</span>
                  </div>
                </div>

                {/* Right side */}
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>Recovery Score</span>
                    <span style={{ fontSize:11, fontWeight:700, color:trendColor, background:trendBg, borderRadius:20, padding:'2px 10px' }}>
                      {trendLabel}
                    </span>
                  </div>
                  {[
                    { label:'Adherence',  val: score.adherence_score },
                    { label:'Symptoms',   val: score.symptom_trend_score },
                    { label:'Engagement', val: score.engagement_score },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:11, color:'var(--pp-text-muted)', width:68, flexShrink:0 }}>{item.label}</span>
                      <div style={{ flex:1, background:'var(--pp-border)', borderRadius:99, height:5 }}>
                        <div style={{ width:`${Math.round(item.val)}%`, background:'var(--teal)', height:5, borderRadius:99, transition:'width 0.5s' }} />
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--pp-text-sec)', fontFamily:"'JetBrains Mono', monospace", width:24, textAlign:'right' }}>{Math.round(item.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TODAY'S MEDICATIONS ── */}
        {activeMeds.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <div style={{ background:'var(--pp-surface)', border:'1px solid var(--pp-border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid var(--pp-border)' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M6 2v6L3 13h10L10 8V2M6 2h4"/></svg>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>Today's Medications</span>
              </div>

              {activeMeds.map((m, i) => {
                const name = m.medicationCodeableConcept?.coding?.[0]?.display ?? 'Unknown'
                return (
                  <div key={m.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 14px',
                    borderBottom: i < activeMeds.length - 1 ? '1px solid var(--pp-border)' : 'none',
                    background: i === 0 ? 'var(--teal-light)' : '#fff',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background: i === 0 ? 'var(--teal)' : 'var(--pp-surface2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={i===0?'#fff':'var(--teal)'} strokeWidth="2"><circle cx="8" cy="8" r="5"/><path d="M5.5 8h5M8 5.5v5"/></svg>
                      </div>
                      <div>
                        <p style={{ fontSize:13, fontWeight:600, color:'var(--pp-text)', margin:0 }}>{name}</p>
                        <p style={{ fontSize:11, color:'var(--pp-text-muted)', margin:0 }}>
                          {(m.dosage as any)?.[0]?.timing?.code?.text ?? (i === 0 ? 'Morning & Evening' : 'Morning')}
                        </p>
                      </div>
                    </div>
                    <MedConfirmButton patientId={patientId} medication={m} onConfirmed={() => refetchScore()} compact />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── DAILY CHECK-IN (Chat) ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px 16px 0', minHeight:0 }}>
          <CompanionChat patientId={patientId} context={context} onCheckinComplete={() => refetchScore()} />
        </div>

        {/* ── CONTACT CARE TEAM ── */}
        <div style={{ padding:'12px 16px' }}>
          {escalated ? (
            <div style={{ width:'100%', padding:'12px 0', borderRadius:14, background:'var(--teal-light)', border:'1px solid var(--teal-border)', textAlign:'center', fontSize:13, color:'var(--teal-dark)', fontWeight:600 }}>
              ✓ Care team notified. Call 911 for emergencies.
            </div>
          ) : (
            <button onClick={handleEscalate} disabled={isEscalating} style={{
              width:'100%', padding:'14px 0', borderRadius:14,
              background: isEscalating ? '#FCA5A5' : '#E24B4A',
              border:'none', cursor: isEscalating ? 'not-allowed' : 'pointer',
              color:'#fff', fontSize:14, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'background 0.2s',
            }}>
              <Phone size={16} />
              {isEscalating ? 'Contacting…' : 'Contact Care Team'}
            </button>
          )}
        </div>

        <p style={{ textAlign:'center', fontSize:10, color:'var(--pp-text-muted)', padding:'0 16px 12px', lineHeight:1.5 }}>
          PatientPulse · Recovery Mode · Not for emergencies — call 911
        </p>
      </div>
    </div>
  )
}
