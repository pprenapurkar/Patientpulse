// src/components/patient/CompanionChat.tsx
import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
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
      text: "Hi! I'm your recovery companion. How are you feeling today? You can tell me about any symptoms, how you slept, or whether you've taken your medications.",
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

    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setIsLoading(true)

    try {
      const res = await apiClient.submitCheckin(patientId, msg, history.current)
      if (res.data) {
        const { reply, extracted } = res.data
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: reply, flagLevel: extracted.flag_level },
        ])
        history.current = [
          ...history.current,
          { role: 'user' as const, content: msg, timestamp: new Date().toISOString() },
          { role: 'assistant' as const, content: reply, timestamp: new Date().toISOString() },
        ].slice(-10)

        if (extracted.flag_level === 'ESCALATE') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: "I noticed you may need some extra support. Please tap the red button above to reach your care team right away.",
            },
          ])
        }
        onCheckinComplete()
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: "I'm having trouble connecting right now. Please try again in a moment." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="companion-chat">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Daily Check-in</p>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0" aria-live="polite" aria-label="Conversation">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-200 rounded-bl-sm'
              } ${msg.flagLevel === 'ESCALATE' ? 'border border-red-500' : ''}`}
              data-testid={`message-${msg.role}`}
            >
              {msg.text}
              {msg.flagLevel === 'FOLLOW_UP' && (
                <p className="text-xs text-amber-400 mt-1 opacity-80">⚠ Your care team may follow up</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2" aria-busy="true">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How are you feeling today?"
          rows={2}
          maxLength={500}
          disabled={isLoading}
          aria-label="Check-in message"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          aria-label="Send check-in message"
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white transition-colors shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
