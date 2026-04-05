import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useAIQueryStream } from '../../hooks/useAIQueryStream'
import type { PatientContext, ConversationTurn } from '../../types/api.types'

interface Props { patientId: string; context: PatientContext | undefined }

const SUGGESTED = [
  'What are the main clinical concerns right now?',
  'Summarise the HbA1c trend over time',
  'What do the wearable anomalies suggest clinically?',
  'Is there anything in her labs I should act on?',
]

function renderStream(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return <pre className="text-xs text-slate-500 whitespace-pre-wrap">{text}</pre>
  let data: any = null
  try { data = JSON.parse(text.slice(start, end + 1)) } catch {
    return <pre className="text-xs text-slate-500 whitespace-pre-wrap">{text.slice(0, text.indexOf('__DONE__') > 0 ? text.indexOf('__DONE__') : undefined)}</pre>
  }

  return (
    <div className="space-y-5 text-sm">
      {data.trend_analysis && (
        <div>
          <p className="text-xs text-teal-700 uppercase font-bold mb-2 tracking-wider">Trend Analysis</p>
          <p className="text-slate-700 leading-relaxed">{data.trend_analysis}</p>
        </div>
      )}
      {data.risk_flags?.length > 0 && (
        <div>
          <p className="text-xs text-teal-700 uppercase font-bold mb-2 tracking-wider">Risk Flags</p>
          <div className="space-y-2">
            {data.risk_flags.map((f: any, i: number) => (
              <div key={i} className={`flex gap-2 rounded-lg p-3 border ${f.severity==='HIGH'?'border-red-200 bg-red-50':f.severity==='MEDIUM'?'border-amber-200 bg-amber-50':'border-blue-200 bg-blue-50'}`}>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${f.severity==='HIGH'?'text-red-700 bg-red-100':f.severity==='MEDIUM'?'text-amber-700 bg-amber-100':'text-blue-700 bg-blue-100'}`}>{f.severity}</span>
                <p className="text-slate-700 text-xs leading-relaxed">{f.flag} {f.citation && <span className="font-mono text-teal-600 text-xs">#{f.citation.slice(-6)}</span>}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.suggested_labs?.length > 0 && (
        <div>
          <p className="text-xs text-teal-700 uppercase font-bold mb-2 tracking-wider">Suggested Follow-up</p>
          <ol className="space-y-1.5">
            {data.suggested_labs.map((l: string, i: number) => (
              <li key={i} className="flex gap-2 text-slate-700 text-xs">
                <span className="text-slate-400 font-mono shrink-0">{i+1}.</span>
                <span className="leading-relaxed">{l}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.medication_notes && (
        <div>
          <p className="text-xs text-teal-700 uppercase font-bold mb-2 tracking-wider">Medication Notes</p>
          <p className="text-slate-700 text-xs leading-relaxed">{data.medication_notes}</p>
        </div>
      )}
      <p className="text-xs text-slate-400 italic border-t border-slate-200 pt-3">
        For clinical decision support only — not a clinical prediction.
      </p>
    </div>
  )
}

export function AIQueryPanel({ patientId }: Props) {
  const [query, setQuery] = useState('')
  const [history] = useState<ConversationTurn[]>([])
  const { streamText, isStreaming, error, submitQuery } = useAIQueryStream()

  const handleSubmit = async (q?: string) => {
    const text = q ?? query
    if (!text.trim() || isStreaming) return
    setQuery('')
    await submitQuery(patientId, text.trim(), history)
  }

  const hasCompleteJSON = streamText && streamText.includes('}')

  return (
    <div className="flex flex-col h-full" data-testid="ai-query-panel">
      <div className="p-6 border-b border-slate-200 bg-white">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-3">Suggested Queries</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => handleSubmit(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!streamText && !isStreaming && !error && (
          <div className="text-center mt-12 text-slate-400">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-sm">Ask a clinical question about this patient</p>
            <p className="text-xs mt-1">Grounded in live FHIR data</p>
          </div>
        )}
        {isStreaming && !hasCompleteJSON && (
          <div className="flex items-center gap-2 justify-center mt-12">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span className="text-sm text-slate-500">Analyzing patient data…</span>
          </div>
        )}
        {streamText && hasCompleteJSON && renderStream(streamText)}
        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <p className="text-xs text-slate-400 text-center mb-2 uppercase tracking-wider">For clinical decision support only — not a clinical prediction</p>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="Ask a clinical question about this patient…"
            disabled={isStreaming}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          />
          <button onClick={() => handleSubmit()} disabled={isStreaming || !query.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white rounded-lg transition-colors">
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
