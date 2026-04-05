// src/components/clinician/AIQueryPanel.tsx
import { useState, useEffect } from 'react'
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

const SUGGESTED = [
  'What are the main clinical concerns right now?',
  'Summarise the HbA1c trend over time',
  'What do the wearable anomalies suggest clinically?',
  'Is there anything in her labs I should act on?',
]

function ObsTag({ id }: { id: string }) {
  return (
    <span style={{ fontSize:10, fontWeight:600, color:'var(--teal)', background:'var(--teal-light)', border:'1px solid var(--teal-border)', borderRadius:4, padding:'1px 6px', fontFamily:"'JetBrains Mono', monospace", margin:'0 2px', display:'inline' }}>
      #{id.slice(0,6)}
    </span>
  )
}

function parseCitations(text: string) {
  const parts = text.split(/(Obs:[a-zA-Z0-9_\-]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('Obs:')) {
      return <ObsTag key={i} id={part.replace('Obs:', '')} />
    }
    return <span key={i}>{part}</span>
  })
}

function RiskBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    HIGH:   { bg: '#E24B4A', color: '#fff' },
    MEDIUM: { bg: '#EF9F27', color: '#fff' },
    LOW:    { bg: '#378ADD', color: '#fff' },
  }
  const s = styles[severity] ?? styles.LOW
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.5px', padding:'2px 7px', borderRadius:4, background:s.bg, color:s.color, whiteSpace:'nowrap', flexShrink:0 }}>
      {severity}
    </span>
  )
}

function RiskRowBg({ severity }: { severity: string }) {
  if (severity === 'HIGH')   return 'var(--pp-danger-bg)'
  if (severity === 'MEDIUM') return 'var(--pp-warning-bg)'
  return '#E6F1FB'
}

function StructuredResponse({ parsed, citations }: { parsed: ParsedResponse; citations: { observation_id?: string }[] }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontSize:13 }}>
      {/* Agent label */}
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'var(--teal)', letterSpacing:'0.8px', textTransform:'uppercase' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M13 3H3a1 1 0 00-1 1v6a1 1 0 001 1h2l2 2 2-2h4a1 1 0 001-1V4a1 1 0 00-1-1z"/></svg>
        DiagnosticAgent
        {citations.length > 0 && <span style={{ marginLeft:4, color:'var(--pp-text-muted)', fontWeight:400 }}>· {citations.length} citations</span>}
      </div>

      {parsed.trend_analysis && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <TrendingUp size={13} color="var(--teal)" />
            <p style={{ fontSize:12, fontWeight:700, color:'var(--teal-dark)', margin:0, letterSpacing:'0.5px', textTransform:'uppercase' }}>Trend Analysis</p>
          </div>
          <p style={{ color:'var(--pp-text-sec)', lineHeight:1.65, margin:0 }}>{parseCitations(parsed.trend_analysis)}</p>
        </div>
      )}

      {parsed.risk_flags && parsed.risk_flags.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <AlertTriangle size={13} color="#EF9F27" />
            <p style={{ fontSize:12, fontWeight:700, color:'var(--teal-dark)', margin:0, letterSpacing:'0.5px', textTransform:'uppercase' }}>Risk Flags</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {parsed.risk_flags.map((flag, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', background:RiskRowBg(flag.severity), borderRadius:7, padding:'8px 10px' }}>
                <RiskBadge severity={flag.severity} />
                <p style={{ color:'var(--pp-text-sec)', lineHeight:1.55, flex:1, margin:0 }}>
                  {parseCitations(flag.flag)}
                  {flag.citation && <ObsTag id={flag.citation.replace('Obs:', '')} />}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.suggested_labs && parsed.suggested_labs.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <FlaskConical size={13} color="#6366f1" />
            <p style={{ fontSize:12, fontWeight:700, color:'var(--teal-dark)', margin:0, letterSpacing:'0.5px', textTransform:'uppercase' }}>Suggested Follow-up</p>
          </div>
          <ol style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
            {parsed.suggested_labs.map((lab, i) => (
              <li key={i} style={{ display:'flex', gap:8, color:'var(--pp-text-sec)' }}>
                <span style={{ color:'var(--pp-text-muted)', fontFamily:"'JetBrains Mono', monospace", fontSize:11, flexShrink:0, marginTop:1 }}>{i+1}.</span>
                <span style={{ lineHeight:1.55 }}>{parseCitations(lab)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {parsed.medication_notes && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <Pill size={13} color="#0D9E75" />
            <p style={{ fontSize:12, fontWeight:700, color:'var(--teal-dark)', margin:0, letterSpacing:'0.5px', textTransform:'uppercase' }}>Medication Notes</p>
          </div>
          <p style={{ color:'var(--pp-text-sec)', lineHeight:1.65, margin:0 }}>{parseCitations(parsed.medication_notes)}</p>
        </div>
      )}

      {citations.length > 0 && (
        <div style={{ borderTop:'1px solid var(--pp-border)', paddingTop:10 }}>
          <p style={{ fontSize:11, color:'var(--pp-text-muted)', fontWeight:600, margin:'0 0 6px' }}>Citations</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {citations.map((c, i) => (
              <span key={i} style={{ fontSize:10, fontFamily:"'JetBrains Mono', monospace", background:'var(--teal-light)', color:'var(--teal)', border:'1px solid var(--teal-border)', borderRadius:4, padding:'1px 6px' }}>
                #{c.observation_id?.slice(0,6)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize:11, color:'var(--pp-text-muted)', fontStyle:'italic', borderTop:'1px solid var(--pp-border)', paddingTop:10, margin:0 }}>
        ⚠ Clinical decision support only — not a clinical prediction or diagnosis.
      </p>
    </div>
  )
}

function tryParseJSON(text: string): ParsedResponse | null {
  const doneIdx = text.indexOf('__DONE__:')
  const source = doneIdx !== -1 ? text.slice(doneIdx + 9) : text
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(source.slice(start, end + 1)) as ParsedResponse } catch { return null }
}

export function AIQueryPanel({ patientId, context: _context }: Props) {
  const [query, setQuery] = useState('')
  const [history] = useState<ConversationTurn[]>([])
  const [parsed, setParsed] = useState<ParsedResponse | null>(null)
  const { streamText, citations, isStreaming, error, submitQuery } = useAIQueryStream()

  useEffect(() => {
    if (!streamText) { setParsed(null); return }
    if (streamText.includes('__DONE__:')) {
      const result = tryParseJSON(streamText)
      if (result) setParsed(result)
    }
  }, [streamText])

  const handleSubmit = async (q?: string) => {
    const text = q ?? query
    if (!text.trim() || isStreaming) return
    setQuery('')
    setParsed(null)
    await submitQuery(patientId, text.trim(), history)
  }

  const streamingDisplay = streamText?.split('__DONE__:')[0] ?? ''

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }} data-testid="ai-query-panel">

      {/* Suggested queries */}
      <div style={{ padding:'16px 24px 14px', borderBottom:'1px solid var(--pp-border)', background:'#fff' }}>
        <p style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', margin:'0 0 8px' }}>Suggested Queries</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => handleSubmit(s)} style={{
              fontSize:12, color:'var(--pp-text-sec)', fontWeight:500,
              background:'#fff', border:'1px solid var(--pp-border2)',
              borderRadius:20, padding:'6px 14px', cursor:'pointer', transition:'all 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background='var(--teal-light)'; (e.target as HTMLElement).style.borderColor='var(--teal-border)'; (e.target as HTMLElement).style.color='var(--teal-dark)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background='#fff'; (e.target as HTMLElement).style.borderColor='var(--pp-border2)'; (e.target as HTMLElement).style.color='var(--pp-text-sec)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Result area */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {!streamText && !isStreaming && !error && !parsed && (
          <p style={{ textAlign:'center', marginTop:40, fontSize:13, color:'var(--pp-text-muted)', fontStyle:'italic' }}>
            Ask a clinical question to get started.
          </p>
        )}

        {isStreaming && !parsed && (
          <div>
            {!streamingDisplay && (
              <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginTop:40 }}>
                <Loader2 size={16} color="var(--teal)" style={{ animation:'spin 1s linear infinite' }} />
                <span style={{ fontSize:13, color:'var(--pp-text-muted)' }}>Analyzing patient data…</span>
              </div>
            )}
            {streamingDisplay && (
              <pre style={{ fontSize:12, color:'var(--pp-text-muted)', fontFamily:"'JetBrains Mono', monospace", whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                {streamingDisplay}
              </pre>
            )}
          </div>
        )}

        {parsed && (
          <div style={{ background:'#fff', border:'1px solid var(--pp-border)', borderRadius:10, padding:18 }}>
            <StructuredResponse parsed={parsed} citations={citations} />
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop:16, fontSize:12, color:'var(--pp-danger)', background:'var(--pp-danger-bg)', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px' }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding:'12px 24px 16px', borderTop:'1px solid var(--pp-border)', background:'#fff' }}>
        <p style={{ fontSize:10, fontWeight:600, color:'var(--pp-text-muted)', letterSpacing:'0.5px', textTransform:'uppercase', textAlign:'center', margin:'0 0 10px' }}>
          For clinical decision support only — not a clinical prediction
        </p>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="Ask a clinical question about this patient…"
            rows={2}
            maxLength={500}
            disabled={isStreaming}
            style={{
              flex:1, border:'1.5px solid var(--pp-border2)', borderRadius:10,
              padding:'10px 14px', fontSize:13.5, color:'var(--pp-text)',
              background:'#fff', resize:'none', outline:'none',
              fontFamily:"'DM Sans', sans-serif", lineHeight:1.5,
            }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isStreaming || !query.trim()}
            style={{
              width:40, height:40, borderRadius:10, flexShrink:0,
              background: isStreaming || !query.trim() ? 'var(--pp-surface2)' : 'var(--teal)',
              border:'none', cursor: isStreaming || !query.trim() ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s',
            }}
          >
            {isStreaming
              ? <Loader2 size={15} color="var(--pp-text-muted)" style={{ animation:'spin 1s linear infinite' }} />
              : <Send size={15} color={query.trim() ? '#fff' : 'var(--pp-text-muted)'} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
