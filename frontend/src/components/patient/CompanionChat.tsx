// src/components/patient/CompanionChat.tsx
import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Heart } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { PatientContext, ConversationTurn } from '../../types/api.types'

interface Message {
  role: 'user' | 'assistant'
  text: string
  flagLevel?: string
}

interface Props {
  patientId: string
  context: PatientContext | undefined
  onCheckinComplete: () => void
}

export function CompanionChat({ patientId, onCheckinComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "Hi! I'm Pulse, your recovery companion 👋 How are you feeling today? You can tell me about any symptoms, whether you've taken your medications, or just how your day is going.",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const history = useRef<ConversationTurn[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || isLoading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setIsLoading(true)

    try {
      const res = await apiClient.submitCheckin(patientId, msg, history.current)
      if (res.data) {
        const { reply, extracted } = res.data
        setMessages(prev => [...prev, { role: 'assistant', text: reply, flagLevel: extracted.flag_level }])
        history.current = [
          ...history.current,
          { role: 'user' as const, content: msg, timestamp: new Date().toISOString() },
          { role: 'assistant' as const, content: reply, timestamp: new Date().toISOString() },
        ].slice(-10)

        if (extracted.flag_level === 'ESCALATE') {
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: 'I noticed you may need some extra support. Please tap the button below to reach your care team right away.',
          }])
        }
        onCheckinComplete()
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "I'm having trouble connecting right now. Please try again in a moment.",
      }])
    } finally { setIsLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }} data-testid="companion-chat">

      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <Heart size={12} color="var(--teal)" />
        <span style={{ fontSize:10, fontWeight:700, color:'var(--pp-text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>Daily Check-in</span>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:10, minHeight:0 }} aria-live="polite" aria-label="Conversation">
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth:'82%',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding:'10px 14px',
              fontSize:13.5, lineHeight:1.55,
              background: msg.role === 'user' ? 'var(--teal)' : 'var(--pp-surface2)',
              color: msg.role === 'user' ? '#fff' : 'var(--pp-text)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--pp-border)',
              outline: msg.flagLevel === 'ESCALATE' ? '2px solid #E24B4A' : 'none',
            }} data-testid={`message-${msg.role}`}>
              {msg.text}
              {msg.flagLevel === 'FOLLOW_UP' && (
                <p style={{ fontSize:11, color:'#EF9F27', marginTop:4, opacity:0.9 }}>⚠ Your care team may follow up</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ background:'var(--pp-surface2)', border:'1px solid var(--pp-border)', borderRadius:'18px 18px 18px 4px', padding:'10px 14px' }} aria-busy="true">
              <Loader2 size={14} color="var(--pp-text-muted)" style={{ animation:'spin 1s linear infinite' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How are you feeling today?"
          rows={2}
          maxLength={500}
          disabled={isLoading}
          aria-label="Check-in message"
          style={{
            flex:1, background:'#fff', border:'1.5px solid var(--pp-border2)',
            borderRadius:12, padding:'10px 14px', fontSize:13, color:'var(--pp-text)',
            resize:'none', outline:'none', fontFamily:"'DM Sans', sans-serif", lineHeight:1.5,
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          aria-label="Send check-in message"
          style={{
            width:40, height:40, borderRadius:12, flexShrink:0,
            background: isLoading || !input.trim() ? 'var(--pp-surface2)' : 'var(--teal)',
            border:'none', cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s',
          }}
        >
          {isLoading
            ? <Loader2 size={15} color="var(--pp-text-muted)" style={{ animation:'spin 1s linear infinite' }} />
            : <Send size={15} color={input.trim() ? '#fff' : 'var(--pp-text-muted)'} />
          }
        </button>
      </div>
    </div>
  )
}
