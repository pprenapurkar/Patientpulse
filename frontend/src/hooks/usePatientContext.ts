// src/hooks/usePatientContext.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/apiClient'

export function usePatientContext(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId, 'context'],
    queryFn: () => apiClient.getPatientContext(patientId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!patientId,
    select: (res) => res.data,
  })
}
