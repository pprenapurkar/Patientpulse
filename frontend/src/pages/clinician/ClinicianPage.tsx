// src/pages/clinician/ClinicianPage.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, Stethoscope } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import { EHRSnapshotPanel } from '../../components/clinician/EHRSnapshotPanel'
import { WearablePanel } from '../../components/clinician/WearablePanel'
import { AIQueryPanel } from '../../components/clinician/AIQueryPanel'
import { ScenarioPanel } from '../../components/clinician/ScenarioPanel'
import { usePatientStore } from '../../stores/patientStore'

const DEFAULT_PATIENT_ID = import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid'
type Tab = 'ehr' | 'wearables' | 'ai' | 'scenario'

export function ClinicianPage() {
  const { patientId: urlPatientId } = useParams()
  const patientId = urlPatientId || DEFAULT_PATIENT_ID
  const { setContext, setAlerts } = usePatientStore()
  const [activeTab, setActiveTab] = useState<Tab>('ehr')

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
  const alerts = alertsRes?.data?.flags ?? []

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ehr', label: 'EHR Snapshot' },
    { id: 'wearables', label: 'Wearables' },
    { id: 'ai', label: 'AI Query' },
    { id: 'scenario', label: 'Scenario' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Top nav */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#0d9488', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} color="white" />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f766e', letterSpacing: '-0.5px' }}>PatientPulse</span>
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>Clinical Dashboard</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 6 }}>
            <RefreshCw size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={14} color="#0d9488" />
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Dr. Priya</span>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} title="Live" />
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: 280, background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Patient */}
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0f766e', fontSize: 15 }}>M</div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', margin: 0 }}>Maria C.</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>58y · female · ID {patientId}</p>
              </div>
            </div>
            {context?.patient_summary?.discharge_date && (
              <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 6, padding: '4px 8px' }}>
                Discharged {new Date(context.patient_summary.discharge_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>Active Alerts</p>
              {alerts.map(a => (
                <div key={a.flag_id} style={{ borderLeft: `3px solid ${a.severity === 'HIGH' || a.severity === 'CRITICAL' ? '#f87171' : '#fbbf24'}`, background: a.severity === 'HIGH' || a.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb', borderRadius: '0 8px 8px 0', padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', margin: 0 }}>{a.title}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: a.severity === 'HIGH' || a.severity === 'CRITICAL' ? '#dc2626' : '#d97706' }}>{a.severity}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>{a.detail}</p>
                  {a.recommended_action && <p style={{ fontSize: 11, color: '#0d9488', margin: '4px 0 0', fontStyle: 'italic' }}>→ {a.recommended_action}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Conditions */}
          {context?.conditions && context.conditions.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>Active Conditions</p>
              {context.conditions.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>{c.code?.coding?.[0]?.display ?? 'Unknown'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Medications */}
          {context?.medications && context.medications.length > 0 && (
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>Current Medications</p>
              {context.medications.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#334155', margin: 0, flex: 1 }}>{m.medicationCodeableConcept?.coding?.[0]?.display ?? 'Unknown'}</p>
                  <span style={{ fontSize: 10, background: '#f0fdfa', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '14px 16px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #0d9488' : '2px solid transparent',
                color: activeTab === tab.id ? '#0f766e' : '#64748b',
                transition: 'all 0.15s',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'ehr' && <EHRSnapshotPanel context={context} isLoading={ctxLoading} />}
            {activeTab === 'wearables' && <WearablePanel context={context} isLoading={ctxLoading} />}
            {activeTab === 'ai' && <AIQueryPanel patientId={patientId} context={context} />}
            {activeTab === 'scenario' && <ScenarioPanel patientId={patientId} />}
          </div>
        </main>
      </div>
    </div>
  )
}