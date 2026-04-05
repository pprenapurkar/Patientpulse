// src/components/shared/FHIRFallbackBanner.tsx

import { AlertTriangle } from 'lucide-react'

interface Props {
  cacheTimestamp: string | null
}

export function FHIRFallbackBanner({ cacheTimestamp }: Props) {
  const formattedTime = cacheTimestamp
    ? new Date(cacheTimestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'unknown time'

  return (
    <div
      role="alert"
      aria-label="FHIR connection unavailable — showing cached data"
      data-testid="fhir-fallback-banner"
      className="bg-amber-950/40 border-b border-amber-700/60 px-4 py-2 flex items-center gap-2"
    >
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-xs text-amber-300">
        ⚠ Data as of {formattedTime} — live FHIR connection unavailable
      </p>
    </div>
  )
}
