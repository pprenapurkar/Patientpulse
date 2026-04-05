// src/components/clinician/ScenarioPanel.tsx
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, FlaskConical } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { ScenarioResponse } from '../../types/api.types'

interface Props {
  patientId: string
}

export function ScenarioPanel({ patientId }: Props) {
  const [result, setResult] = useState<ScenarioResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<string | null>(null)

  const runScenario = async (type: 'add_glp1' | 'increase_metformin') => {
    setIsLoading(true)
    setError(null)
    setActiveScenario(type)
    try {
      const res = await apiClient.runScenario(patientId, type)
      if (res.data) setResult(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scenario failed')
    } finally {
      setIsLoading(false)
    }
  }

  const severityColor: Record<string, string> = {
    NONE: 'text-green-400',
    MILD: 'text-yellow-400',
    MODERATE: 'text-orange-400',
    SEVERE: 'text-red-400',
  }

  return (
    <section
      className="p-4"
      aria-label="Scenario simulator panel"
      data-testid="scenario-panel"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">What-If Scenarios</p>
      </div>

      <div className="flex gap-2 mb-4">
        {/* Button labels must be exactly as specified in frontend_guidelines.mdx */}
        <button
          onClick={() => runScenario('add_glp1')}
          disabled={isLoading}
          data-scenario="add_glp1"
          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
            activeScenario === 'add_glp1'
              ? 'bg-purple-700 border-purple-600 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-purple-700 hover:text-white'
          }`}
          aria-label="Run Add GLP-1 agonist scenario"
        >
          Add GLP-1 agonist
        </button>
        <button
          onClick={() => runScenario('increase_metformin')}
          disabled={isLoading}
          data-scenario="increase_metformin"
          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
            activeScenario === 'increase_metformin'
              ? 'bg-blue-700 border-blue-600 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-blue-700 hover:text-white'
          }`}
          aria-label="Run Increase Metformin scenario"
        >
          Increase Metformin
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 justify-center py-6" aria-busy="true">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          <span className="text-xs text-gray-500">Running scenario…</span>
        </div>
      )}

      {error && (
        <div role="alert" className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded p-2">
          {error}
        </div>
      )}

      {result && !isLoading && (
        <div className="space-y-3">
          {/* Drug interaction */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1 font-semibold">Drug Interactions</p>
            <p className={`text-sm font-semibold ${severityColor[result.interaction_result.overall_severity]}`}>
              {result.interaction_result.overall_severity === 'NONE'
                ? '✓ No significant interactions'
                : `⚠ ${result.interaction_result.overall_severity} interaction risk`}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">via RxNorm · {result.interaction_result.data_source}</p>
          </div>

          {/* Projection chart */}
          <div>
            <p className="text-xs text-gray-500 mb-1 font-semibold">
              12-Week HbA1c Projection (Δ{result.projection.hba1c_delta_range[0]}% to {result.projection.hba1c_delta_range[1]}%)
            </p>
            <div
              role="img"
              aria-label={`12-week HbA1c projection chart showing projected decline from current value`}
            >
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={result.projection.chart_data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#6b7280' }} label={{ value: 'weeks', position: 'insideBottom', fontSize: 9, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 11 }} />
                  <Line type="monotone" dataKey="hba1c_projected" stroke="#a78bfa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Narrative */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <p className="text-xs text-gray-300 leading-relaxed">{result.narrative}</p>
          </div>

          {/* Mandatory disclaimer */}
          <p className="text-xs text-amber-600/80 italic border-t border-gray-800 pt-2">
            ⚠ {result.disclaimer}
          </p>
        </div>
      )}
    </section>
  )
}
