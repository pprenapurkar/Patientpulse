// src/components/clinician/AlertBanners.tsx
import { usePatientStore } from '../../stores/patientStore'
import type { AlertFlag } from '../../types/api.types'

function AlertBanner({ flag }: { flag: AlertFlag }) {
  const colors: Record<string, string> = {
    CRITICAL: 'border-red-400 bg-red-50 text-red-700',
    HIGH: 'border-orange-400 bg-orange-50 text-orange-700',
    MEDIUM: 'border-amber-400 bg-amber-50 text-amber-700',
    LOW: 'border-blue-400 bg-blue-50 text-blue-700',
  }
  const cls = colors[flag.severity] ?? 'border-slate-300 bg-slate-50 text-slate-700'
  return (
    <div role="alert" className={`border-l-4 px-4 py-3 flex gap-3 items-start ${cls}`} data-testid="alert-banner">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{flag.title}</p>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/60 border border-current opacity-70">{flag.severity}</span>
        </div>
        <p className="text-xs mt-0.5 opacity-80">{flag.detail}</p>
        {flag.recommended_action && <p className="text-xs mt-1 italic opacity-70">→ {flag.recommended_action}</p>}
      </div>
    </div>
  )
}

export function AlertBanners() {
  const alerts = usePatientStore(s => s.alerts)
  if (!alerts.length) return null
  return (
    <div className="border-b border-slate-200" data-testid="alert-banners-container">
      {alerts.map(flag => <AlertBanner key={flag.flag_id} flag={flag} />)}
    </div>
  )
}
