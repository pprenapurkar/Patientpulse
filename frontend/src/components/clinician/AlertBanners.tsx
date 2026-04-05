// src/components/clinician/AlertBanners.tsx
import { AlertTriangle } from 'lucide-react'
import { usePatientStore } from '../../stores/patientStore'
import type { AlertFlag } from '../../types/api.types'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'border-red-500 bg-red-950/40',
  HIGH: 'border-orange-500 bg-orange-950/40',
  MEDIUM: 'border-amber-500 bg-amber-950/30',
  LOW: 'border-blue-500 bg-blue-950/30',
}

const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-blue-400',
}

function AlertBanner({ flag }: { flag: AlertFlag }) {
  return (
    <div
      role="alert"
      aria-label={`Alert: ${flag.title}`}
      className={`border-l-4 px-4 py-3 flex gap-3 items-start ${SEVERITY_COLORS[flag.severity] ?? 'border-gray-600 bg-gray-900'}`}
      data-testid="alert-banner"
    >
      <AlertTriangle
        className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_TEXT[flag.severity] ?? 'text-gray-400'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${SEVERITY_TEXT[flag.severity]}`}>{flag.title}</p>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{flag.detail}</p>
        {flag.recommended_action && (
          <p className="text-xs text-gray-500 mt-1 italic">{flag.recommended_action}</p>
        )}
      </div>
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${SEVERITY_TEXT[flag.severity]} border-current opacity-70`}>
        {flag.severity}
      </span>
    </div>
  )
}

export function AlertBanners() {
  const alerts = usePatientStore((s) => s.alerts)
  if (!alerts.length) return null

  return (
    <div className="border-b border-gray-800" data-testid="alert-banners-container" aria-label="Proactive alerts">
      {alerts.map((flag) => (
        <AlertBanner key={flag.flag_id} flag={flag} />
      ))}
    </div>
  )
}
