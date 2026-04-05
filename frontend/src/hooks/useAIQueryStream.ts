// src/hooks/useAIQueryStream.ts
import { useState, useCallback } from 'react'
import { streamAIQuery } from '../api/apiClient'
import type { ConversationTurn, SSECitation } from '../types/api.types'

export function useAIQueryStream() {
  const [streamText, setStreamText] = useState('')
  const [citations, setCitations] = useState<SSECitation[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitQuery = useCallback(
    async (patientId: string, query: string, history: ConversationTurn[]) => {
      setIsStreaming(true)
      setStreamText('')
      setCitations([])
      setError(null)

      await streamAIQuery(
        patientId,
        query,
        history,
        (token) => setStreamText((prev) => prev + token),
        (c) => setCitations(c as SSECitation[]),
        () => setIsStreaming(false),
        (code, message) => {
          setError(`${code}: ${message}`)
          setIsStreaming(false)
        },
      )
    },
    [],
  )

  return { streamText, citations, isStreaming, error, submitQuery }
}
