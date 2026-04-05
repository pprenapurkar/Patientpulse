// src/pages/clinician/ClinicianPage.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../api/apiClient'
import { AlertBanners } from '../../components/clinician/AlertBanners'
import { EHRSnapshotPanel } from '../../components/clinician/EHRSnapshotPanel'
import { WearablePanel } from '../../components/clinician/WearablePanel'
import { AIQueryPanel } from '../../components/clinician/AIQueryPanel'
import { ScenarioPanel } from '../../components/clinician/ScenarioPanel'
import { FHIRFallbackBanner } from '../../components/shared/FHIRFallbackBanner'
import { usePatientStore } from '../../stores/patientStore'

const DEFAULT_PATIENT_ID = import.meta.env.VITE_PATIENT_ID || 'maria-chen-uuid'

export function ClinicianPage() {
  const { patientId: urlPatientId } = useParams()
  const patientId = urlPatientId || DEFAULT_PATIENT_ID
  const { setContext, setAlerts } = usePatientStore()

  // Fetch patient context
  const { data: contextRes, isLoading: ctxLoading } = useQuery({
    queryKey: ['patient', patientId, 'context'],
    queryFn: () => apiClient.getPatientContext(patientId),
    staleTime: 5 * 60 * 1000,
  })

  // Fetch alerts on load (autonomous — no click required)
  const { data: alertsRes } = useQuery({
    queryKey: ['patient', patientId, 'alerts'],
    queryFn: () => apiClient.getAlerts(patientId),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (contextRes?.data) setContext(contextRes.data)
  }, [contextRes, setContext])

  useEffect(() => {
    if (alertsRes?.data?.flags) setAlerts(alertsRes.data.flags)
  }, [alertsRes, setAlerts])

  const context = contextRes?.data
  const isCached = context?.data_freshness === 'cached'

  return (
    <div
      className="min-h-screen bg-gray-950 text-gray-100"
      data-testid="clinician-page"
    >
      {/* Top nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 font-bold text-lg tracking-tight">PatientPulse</span>
          <span className="text-gray-500 text-sm">Clinical Dashboard</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Dr. Priya — Clinician
        </div>
      </header>

      {/* FHIR fallback banner */}
      {isCached && (
        <FHIRFallbackBanner cacheTimestamp={context?.cache_timestamp ?? null} />
      )}

      {/* Alert banners — rendered before any clinician click */}
      <AlertBanners />

      {/* 3-panel layout */}
      <main className="grid grid-cols-12 gap-0 h-[calc(100vh-112px)]">
        {/* Left — EHR Snapshot */}
        <aside
          className="col-span-3 border-r border-gray-800 overflow-y-auto"
          aria-label="EHR snapshot panel"
        >
          <EHRSnapshotPanel context={context} isLoading={ctxLoading} />
        </aside>

        {/* Center — Wearable charts */}
        <section
          className="col-span-5 border-r border-gray-800 overflow-y-auto"
          aria-label="Wearable data panel"
        >
          <WearablePanel context={context} isLoading={ctxLoading} />
          <ScenarioPanel patientId={patientId} />
        </section>

        {/* Right — AI Query */}
        <section
          className="col-span-4 flex flex-col"
          aria-label="AI query panel"
        >
          <AIQueryPanel patientId={patientId} context={context} />
        </section>
      </main>
    </div>
  )
}
