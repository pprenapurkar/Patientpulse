// src/components/patient/RecoveryScore.tsx

import { TrendingUp, Minus, TrendingDown } from 'lucide-react'

interface Props {
  score: number | null
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | null
}

export function RecoveryScore({ score, trend }: Props) {
  if (score === null) return null

  const color =
    score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'

  const TrendIcon =
    trend === 'IMPROVING' ? TrendingUp : trend === 'DECLINING' ? TrendingDown : Minus

  return (
    <div className="flex items-center gap-1.5" data-testid="recovery-score" aria-label={`Recovery score: ${score}`}>
      <TrendIcon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-sm font-bold ${color}`}>{Math.round(score)}</span>
      <span className="text-xs text-gray-600">/ 100</span>
    </div>
  )
}
