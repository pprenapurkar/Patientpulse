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

  const severityColor: Record<string, string> = {
    NONE: 'text-teal-600 bg-teal-50 border-teal-200',
    MILD: 'text-amber-600 bg-amber-50 border-amber-200',
    MODERATE: 'text-orange-600 bg-orange-50 border-orange-200',
    SEVERE: 'text-red-600 bg-red-50 border-red-200',
  }

  return (
    <div className="p-6" data-testid="scenario-panel">
      <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-4">What-If Scenarios</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { type: 'add_glp1' as const, label: 'Add GLP-1 Agonist', desc: 'Model 12-week HbA1c & weight projection for semaglutide' },
          { type: 'increase_metformin' as const, label: 'Increase Metformin', desc: 'Model effect of dose increase to 2000 mg/day' },
        ].map(s => (
          <button key={s.type} onClick={() => run(s.type)} disabled={isLoading}
            className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
              active === s.type ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
            }`}>
            <p className={`font-semibold text-sm mb-1 ${active === s.type ? 'text-teal-700' : 'text-slate-700'}`}>🔬 {s.label}</p>
            <p className="text-xs text-slate-400">{s.desc}</p>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          <span className="text-sm text-slate-500">Running scenario…</span>
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {result && !isLoading && (
        <div className="space-y-4">
          {/* Drug interaction */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold mb-2 tracking-wider">Drug Interaction Check</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${severityColor[result.interaction_result.overall_severity]}`}>
              {result.interaction_result.overall_severity === 'NONE' ? '✓ No significant interactions' : `⚠ ${result.interaction_result.overall_severity} interaction risk`}
            </div>
            <p className="text-xs text-slate-400 mt-2">via RxNorm · {result.interaction_result.data_source}</p>
          </div>

          {/* Projection chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">12-Week HbA1c Projection</p>
              <span className="text-sm font-bold text-teal-700">
                Δ{result.projection.hba1c_delta_range[0]}% to {result.projection.hba1c_delta_range[1]}%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={result.projection.chart_data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }} />
                <ReferenceLine y={8.2} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Baseline 8.2%', fontSize: 9, fill: '#94a3b8' }} />
                <Line type="monotone" dataKey="hba1c_projected" stroke="#0d9488" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Narrative */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold mb-2 tracking-wider">Clinical Narrative</p>
            <p className="text-sm text-slate-700 leading-relaxed">{result.narrative}</p>
          </div>

          <p className="text-xs text-amber-600 italic flex items-center gap-1">
            ⚠ {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}
