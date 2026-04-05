// src/pages/clinician/ClinicianPage.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, Stethoscope, AlertTriangle, X } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import { EHRSnapshotPanel } from '../../components/clinician/EHRSnapshotPanel'
import { WearablePanel } from '../../components/clinician/WearablePanel'
import { AIQueryPanel } from '../../components/clinician/AIQueryPanel'
import { ScenarioPanel } from '../../components/clinician/ScenarioPanel'
import { usePatientStore } from '../../stores/patientStore'
import type { AlertFlag, PatientContext } from '../../types/api.types'

const DEFAULT_PATIENT_ID = import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid'
type Tab = 'ehr' | 'wearables' | 'ai' | 'scenario'

// Derive alerts from observation data when backend returns none
function deriveAlertsFromContext(context: PatientContext | undefined): AlertFlag[] {
  if (!context) return []
  const derived: AlertFlag[] = []

  const obs = context.observations
  const getLatestVal = (namePart: string) => {
    const match = obs.find(o =>
      (o.code?.coding?.[0]?.display ?? o.code?.text ?? '').toLowerCase().includes(namePart.toLowerCase())
      && o.valueQuantity
    )
    return match?.valueQuantity?.value ?? null
  }

  // Heart rate elevated
  const hrVals = obs
    .filter(o => (o.code?.coding?.[0]?.display ?? '').toLowerCase().includes('heart rate') && o.valueQuantity)
    .map(o => o.valueQuantity!.value)
  if (hrVals.length > 0) {
    const maxHR = Math.max(...hrVals)
    if (maxHR > 100) {
      derived.push({
        flag_id: 'derived-hr',
        severity: 'HIGH',
        category: 'WEARABLE_ANOMALY',
        title: 'Elevated heart rate detected',
        detail: `Heart rate reached ${maxHR} bpm — above 100 bpm threshold. Monitor for arrhythmia or decompensation.`,
        observation_ids: [],
        recommended_action: 'Review cardiac history and medication timing.',
      })
    }
  }

  // High glucose
  const glucoseVal = getLatestVal('glucose')
  if (glucoseVal !== null && glucoseVal > 140) {
    derived.push({
      flag_id: 'derived-glucose',
      severity: glucoseVal > 200 ? 'HIGH' : 'MEDIUM',
      category: 'CLINICAL_TREND',
      title: `Glucose elevated (${glucoseVal} mg/dL)`,
      detail: `Latest glucose reading is ${glucoseVal} mg/dL — above 140 mg/dL threshold. Consider reviewing dietary intake and medication adherence.`,
      observation_ids: [],
      recommended_action: 'Review Metformin adherence and recent dietary patterns.',
    })
  }

  // Wearable anomaly flags from summary
  const anomalies = context.wearable_summary?.anomaly_flags ?? []
  if (anomalies.length > 0 && derived.length === 0) {
    anomalies.slice(0, 2).forEach((flag, i) => {
      derived.push({
        flag_id: `derived-anomaly-${i}`,
        severity: 'MEDIUM',
        category: 'WEARABLE_ANOMALY',
        title: 'Wearable anomaly detected',
        detail: flag,
        observation_ids: [],
        recommended_action: 'Review wearables tab for details.',
      })
    })
  }

  return derived.slice(0, 2)
}

function AlertCard({ alert, onDismiss }: { alert: AlertFlag; onDismiss: () => void }) {
  const isHigh = alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
  return (
    <div style={{
      borderRadius: 10, padding: '12px 12px 10px', marginBottom: 10,
      border: `1px solid ${isHigh ? '#FCA5A5' : '#FCD34D'}`,
      background: isHigh ? '#FFF8F5' : '#FFFBF0',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:5 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
            <AlertTriangle size={11} color={isHigh ? '#E24B4A' : '#BA7517'} />
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color: isHigh ? '#E24B4A' : '#BA7517' }}>
              {alert.severity}
            </span>
          </div>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--pp-text)', lineHeight:1.3, margin:0 }}>{alert.title}</p>
        </div>
        <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pp-text-muted)', padding:0, flexShrink:0 }}>
          <X size={13} />
        </button>
      </div>
      <p style={{ fontSize:11.5, color:'var(--pp-text-sec)', lineHeight:1.5, margin:0 }}>{alert.detail}</p>
      {alert.recommended_action && (
        <p style={{ fontSize:11, color:'#085041', fontWeight:500, marginTop:6, fontStyle:'italic' }}>
          → {alert.recommended_action}
        </p>
      )}
    </div>
  )
}

function TabIcon({ id }: { id: Tab }) {
  if (id === 'ehr') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/>
    </svg>
  )
  if (id === 'wearables') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="1 8 4 4 7 10 10 6 13 8 15 7"/>
    </svg>
  )
  if (id === 'ai') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 3H3a1 1 0 00-1 1v6a1 1 0 001 1h2l2 2 2-2h4a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 2h6l3 4-6 8-6-8z"/>
    </svg>
  )
}

export function ClinicianPage() {
  const { patientId: urlPatientId } = useParams()
  const patientId = urlPatientId || DEFAULT_PATIENT_ID
  const { setContext, setAlerts } = usePatientStore()
  const [activeTab, setActiveTab] = useState<Tab>('ehr')
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const { data: contextRes, isLoading: ctxLoading, refetch } = useQuery({
    queryKey: ['patient', patientId, 'context'],
    queryFn: () => apiClient.getPatientContext(patientId),
    staleTime: 5 * 60 * 1000,
  })

  const { data: alertsRes } = useQuery({
    queryKey: ['patient', patientId, 'alerts'],
    queryFn: () => apiClient.getAlerts(patientId),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => { if (contextRes?.data) setContext(contextRes.data) }, [contextRes, setContext])
  useEffect(() => { if (alertsRes?.data?.flags) setAlerts(alertsRes.data.flags) }, [alertsRes, setAlerts])

  const context = contextRes?.data
  const allAlerts = alertsRes?.data?.flags ?? []
  const derivedAlerts = useMemo(() => deriveAlertsFromContext(context), [context])
  // Use backend alerts if available, fall back to derived from observations
  const combinedAlerts = allAlerts.length > 0 ? allAlerts : derivedAlerts
  const alerts = combinedAlerts.filter(a => !dismissedAlerts.has(a.flag_id))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ehr', label: 'EHR Snapshot' },
    { id: 'wearables', label: 'Wearables' },
    { id: 'ai', label: 'AI Query' },
    { id: 'scenario', label: 'Scenario' },
  ]

  const sidebarSection = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div style={{ border:'1px solid var(--pp-border)', borderRadius:10, padding:12, background:'var(--pp-surface)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        {icon}
        <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'1px', textTransform:'uppercase' }}>{title}</span>
      </div>
      {children}
    </div>
  )

  const dotColors = ['#0D9E75', '#F59E0B', '#E24B4A']

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--pp-surface)', fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes pp-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pp-tab:hover { color: var(--teal) !important; }
      `}</style>

      {/* NAVBAR */}
      <header style={{
        background:'#fff', borderBottom:'1px solid var(--pp-border)',
        padding:'0 20px', height:52,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#0D9E75,#5DCAA5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Activity size={16} color="white" />
          </div>
          <span style={{ fontWeight:600, fontSize:15, color:'var(--pp-text)', letterSpacing:'-0.3px' }}>PatientPulse</span>
          <span style={{ color:'var(--pp-border2)', fontWeight:300, margin:'0 4px' }}>·</span>
          <span style={{ fontSize:11, color:'var(--pp-text-muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Clinical Dashboard</span>
        </div>

        {/* Patient chip */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--pp-surface2)', border:'1px solid var(--pp-border)', borderRadius:20, padding:'4px 12px 4px 6px' }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--teal)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600 }}>MC</div>
          <span style={{ fontSize:13, fontWeight:500, color:'var(--pp-text)' }}>Maria C.</span>
          <span style={{ fontSize:11, color:'var(--pp-text-muted)' }}>58y · female</span>
          {alerts.length > 0 && (
            <div style={{ width:18, height:18, borderRadius:'50%', background:'#E24B4A', color:'#fff', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {alerts.length}
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:12, padding:'3px 10px', fontSize:11, fontWeight:600, color:'#065F46', letterSpacing:'0.3px' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', animation:'pp-pulse 2s infinite', display:'inline-block' }} />
            LIVE
          </div>
          <button onClick={() => refetch()} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pp-text-muted)', padding:4, borderRadius:6 }}>
            <RefreshCw size={14} />
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Stethoscope size={13} color="var(--teal)" />
            <span style={{ fontSize:13, color:'var(--pp-text-sec)', fontWeight:500 }}>Dr. Priya Sharma</span>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{ width:268, minWidth:268, background:'#fff', borderRight:'1px solid var(--pp-border)', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column', gap:12, padding:'16px 12px' }}>

          {/* Discharge */}
          <div style={{ padding:'0 4px' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'1px', textTransform:'uppercase', margin:'0 0 2px' }}>Discharge</p>
            <p style={{ fontSize:13, color:'var(--pp-text-sec)', fontWeight:500, margin:0 }}>
              {context?.patient_summary?.discharge_date
                ? new Date(context.patient_summary.discharge_date).toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' })
                : '—'}
            </p>
          </div>

          {/* Alert cards */}
          <div>
            {alerts.map(a => (
              <AlertCard key={a.flag_id} alert={a} onDismiss={() => setDismissedAlerts(prev => new Set([...prev, a.flag_id]))} />
            ))}
          </div>

          {/* Conditions */}
          {context?.conditions && context.conditions.length > 0 && sidebarSection(
            'Active Conditions',
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M8 14s-6-3.5-6-7a4 4 0 018 0 4 4 0 018 0c0 3.5-6 7-6 7z"/></svg>,
            <div>
              {context.conditions.map((c, i) => (
                <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'4px 0' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:dotColors[i % dotColors.length], marginTop:4, flexShrink:0 }} />
                  <div>
                    <p style={{ fontSize:12.5, fontWeight:500, color:'var(--pp-text)', margin:0 }}>{c.code?.coding?.[0]?.display ?? 'Unknown'}</p>
                    {c.code?.coding?.[0]?.code && (
                      <p style={{ fontSize:10, color:'var(--pp-text-muted)', fontFamily:"'JetBrains Mono', monospace", margin:'1px 0 0' }}>
                        SNOMED {c.code.coding[0].code}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Medications */}
          {context?.medications && context.medications.length > 0 && sidebarSection(
            'Current Medications',
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="2"><circle cx="8" cy="8" r="6"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="8" y1="10" x2="8" y2="12"/></svg>,
            <div>
              {context.medications.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0' }}>
                  <p style={{ fontSize:12.5, color:'var(--pp-text)', fontWeight:500, margin:0, flex:1, paddingRight:8 }}>
                    {m.medicationCodeableConcept?.coding?.[0]?.display ?? 'Unknown'}
                  </p>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--teal-dark)', background:'var(--teal-light)', border:'1px solid var(--teal-border)', borderRadius:4, padding:'1px 6px' }}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recent Labs & Vitals */}
          {context?.observations && context.observations.filter(o =>
            o.category?.some(c => c.coding?.some(cd => cd.code === 'laboratory' || cd.code === 'vital-signs'))
          ).length > 0 && sidebarSection(
            'Recent Labs & Vitals',
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M6 2v6L3 13h10L10 8V2M6 2h4"/></svg>,
            <div>
              {context.observations
                .filter(o => o.category?.some(c => c.coding?.some(cd => cd.code === 'laboratory' || cd.code === 'vital-signs')))
                .slice(0, 6)
                .map(obs => {
                  const name = obs.code?.coding?.[0]?.display ?? obs.code?.text ?? 'Unknown'
                  const val = obs.valueQuantity
                  const date = new Date(obs.effectiveDateTime).toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' })
                  const isAbnormal = val && (
                    (name.toLowerCase().includes('glucose') && val.value > 140) ||
                    (name.toLowerCase().includes('hba1c') && val.value > 8) ||
                    (name.toLowerCase().includes('egfr') && val.value < 60)
                  )
                  const isWarning = val && (
                    (name.toLowerCase().includes('blood pressure') && val.value > 130) ||
                    (name.toLowerCase().includes('hba1c') && val.value > 7 && val.value <= 8)
                  )
                  const valColor = isAbnormal ? '#E24B4A' : isWarning ? '#EF9F27' : 'var(--teal)'
                  return (
                    <div key={obs.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--pp-border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, color: isAbnormal ? '#E24B4A' : isWarning ? '#EF9F27' : 'var(--pp-text-muted)' }}>
                          {isAbnormal ? '↗' : isWarning ? '↗' : '—'}
                        </span>
                        <span style={{ fontSize:12, color:'var(--pp-text-sec)' }}>{name}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:valColor, fontFamily:"'JetBrains Mono', monospace" }}>
                          {val ? `${val.value} ${val.unit}` : '—'}
                        </div>
                        <div style={{ fontSize:10, color:'var(--pp-text-muted)' }}>{date}</div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Tabs */}
          <div style={{ background:'#fff', borderBottom:'1px solid var(--pp-border)', padding:'0 20px', display:'flex', alignItems:'center', flexShrink:0 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="pp-tab" style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'14px 16px 12px', fontSize:13, fontWeight:500,
                border:'none', background:'none', cursor:'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--teal)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--teal-dark)' : 'var(--pp-text-muted)',
                transition:'all 0.15s', whiteSpace:'nowrap',
              }}>
                <TabIcon id={tab.id} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {activeTab === 'ehr'      && <EHRSnapshotPanel context={context} isLoading={ctxLoading} />}
            {activeTab === 'wearables' && <WearablePanel    context={context} isLoading={ctxLoading} />}
            {activeTab === 'ai'       && <AIQueryPanel      patientId={patientId} context={context} />}
            {activeTab === 'scenario' && <ScenarioPanel     patientId={patientId} />}
          </div>
        </main>
      </div>
    </div>
  )
}
