// src/components/clinician/AIQueryPanel.tsx
import { useState } from 'react'
import { Send, Loader2, AlertTriangle, FlaskConical, Pill, TrendingUp } from 'lucide-react'
import { useAIQueryStream } from '../../hooks/useAIQueryStream'
import type { PatientContext, ConversationTurn } from '../../types/api.types'

interface Props {
  patientId: string
  context: PatientContext | undefined
}

interface RiskFlag {
  flag: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  citation: string
}

interface ParsedResponse {
  trend_analysis?: string
  risk_flags?: RiskFlag[]
  suggested_labs?: string[]
  medication_notes?: string
  disclaimer?: string
}

function parseCitations(text: string) {
  // Replace Obs:XXXX with inline badge spans
  const parts = text.split(/(Obs:[a-zA-Z0-9\-]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('Obs:')) {
      const id = part.replace('Obs:', '')
      return (
        <span
          key={i}
          className="inline-flex items-center font-mono text-xs bg-blue-950/50 text-blue-400 border border-blue-900/60 rounded px-1.5 py-0.5 mx-0.5"
          title={`FHIR Observation ${id}`}
        >
          #{id.slice(0, 6)}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-red-950/50 text-red-400 border-red-900/60',
    MEDIUM: 'bg-amber-950/50 text-amber-400 border-amber-900/60',
    LOW: 'bg-blue-950/50 text-blue-400 border-blue-900/60',
  }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${styles[severity] ?? styles.LOW}`}>
      {severity}
    </span>
  )
}

function StructuredResponse({ parsed, rawText }: { parsed: ParsedResponse | null; rawText: string }) {
  if (!parsed) {
    // Fallback: render raw with citation highlighting
    return (
      <div className="text-sm text-gray-300 leading-relaxed">
        {parseCitations(rawText)}
      </div>
    )
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Trend Analysis */}
      {parsed.trend_analysis && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Trend Analysis</p>
          </div>
          <p className="text-gray-300 leading-relaxed">{parseCitations(parsed.trend_analysis)}</p>
        </div>
      )}

      {/* Risk Flags */}
      {parsed.risk_flags && parsed.risk_flags.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Risk Flags</p>
          </div>
          <div className="space-y-2">
            {parsed.risk_flags.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 bg-gray-900/60 rounded-lg p-2.5 border border-gray-800"
              >
                <SeverityBadge severity={flag.severity} />
                <p className="text-gray-300 leading-relaxed flex-1">
                  {parseCitations(flag.flag)}
                  {flag.citation && (
                    <span className="inline-flex items-center font-mono text-xs bg-blue-950/50 text-blue-400 border border-blue-900/60 rounded px-1.5 py-0.5 mx-0.5">
                      #{flag.citation.replace('Obs:', '').slice(0, 6)}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Labs */}
      {parsed.suggested_labs && parsed.suggested_labs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Suggested Follow-up</p>
          </div>
          <ol className="space-y-1.5">
            {parsed.suggested_labs.map((lab, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-300">
                <span className="text-gray-600 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{parseCitations(lab)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Medication Notes */}
      {parsed.medication_notes && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Pill className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Medication Notes</p>
          </div>
          <p className="text-gray-300 leading-relaxed">{parseCitations(parsed.medication_notes)}</p>
        </div>
      )}
    </div>
  )
}

function tryParseJSON(text: string): ParsedResponse | null {
  // Strip __DONE__: prefix if present
  const cleaned = text.replace(/^__DONE__:/, '').trim()
  // Find the first { and last } to extract JSON even if there's surrounding text
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as ParsedResponse
  } catch {
    return null
  }
}

export function AIQueryPanel({ patientId }: Props) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const { streamText, citations, isStreaming, error, submitQuery } = useAIQueryStream()

  const handleSubmit = async () => {
    if (!query.trim() || isStreaming) return
    const q = query.trim()
    setQuery('')
    await submitQuery(patientId, q, history)
    if (streamText) {
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: q, timestamp: new Date().toISOString() },
        { role: 'assistant', content: streamText, timestamp: new Date().toISOString() },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Try to parse structured JSON once streaming is done
  const parsed = !isStreaming && streamText ? tryParseJSON(streamText) : null
  // While streaming, show raw text; once done, show structured view
  const displayRaw = isStreaming ? streamText : null

  return (
    <div
      className="flex flex-col h-full bg-gray-950"
      data-testid="ai-query-panel"
      aria-label="AI query panel"
    >
      <div className="px-4 pt-4 pb-2 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">AI Analysis</p>
        <p className="text-xs text-gray-600 mt-0.5">Ask about this patient's data</p>
      </div>

      {/* Response area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!streamText && !isStreaming && !error && (
          <p className="text-xs text-gray-600 italic text-center mt-8">
            Ask a clinical question to get started.
          </p>
        )}

        {/* Streaming: show raw text as it comes in */}
        {displayRaw && (
          <div
            role="log"
            aria-live="polite"
            aria-label="AI analysis response"
            data-testid="ai-response-stream"
            className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-mono"
          >
            {displayRaw}
          </div>
        )}

        {/* Done streaming: show structured view */}
        {!isStreaming && streamText && (
          <div>
            <StructuredResponse parsed={parsed} rawText={streamText} />

            {citations.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-1.5 font-semibold">All Citations</p>
                <div className="flex flex-wrap gap-1">
                  {citations.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs font-mono bg-blue-950/40 text-blue-400 border border-blue-900/60 rounded px-1.5 py-0.5"
                    >
                      #{c.observation_id?.slice(0, 6)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600 italic mt-4 border-t border-gray-800 pt-3">
              ⚠ This analysis is for clinical decision support only and is not a clinical prediction or diagnosis.
            </p>
          </div>
        )}

        {isStreaming && !streamText && (
          <div className="flex items-center gap-2 mt-8 justify-center" aria-busy="true">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span className="text-xs text-gray-500">Analyzing patient data…</span>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded p-3">
            {error}
          </div>
        )}
      </div>

      {/* Query input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this patient's data…"
            rows={2}
            maxLength={500}
            disabled={isStreaming}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 disabled:opacity-50"
            aria-label="Clinical query input"
          />
          <button
            onClick={handleSubmit}
            disabled={isStreaming || !query.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white transition-colors"
            aria-label="Submit query"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
