// src/components/patient/RecoveryScore.tsx
import { TrendingUp, Minus, TrendingDown } from 'lucide-react'

interface Props { score: number | null; trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | null }

export function RecoveryScore({ score, trend }: Props) {
  if (score === null) return null
  const color =
    score >= 70 ? 'var(--teal)' :
    score >= 50 ? '#EF9F27' : '#E24B4A'
  const TrendIcon = trend === 'IMPROVING' ? TrendingUp : trend === 'DECLINING' ? TrendingDown : Minus
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--pp-surface2)', border:'1px solid var(--pp-border)', borderRadius:20, padding:'4px 12px' }} data-testid="recovery-score" aria-label={`Recovery score: ${score}`}>
      <TrendIcon size={13} color={color} />
      <span style={{ fontSize:14, fontWeight:700, color, fontFamily:"'JetBrains Mono', monospace" }}>{Math.round(score)}</span>
      <span style={{ fontSize:11, color:'var(--pp-text-muted)' }}>/ 100</span>
    </div>
  )
}
