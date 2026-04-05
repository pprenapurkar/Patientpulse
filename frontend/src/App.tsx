// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClinicianPage } from './pages/clinician/ClinicianPage'
import { PatientPage } from './pages/patient/PatientPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5 * 60 * 1000 } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/clinician" replace />} />
          <Route path="/clinician" element={<ClinicianPage />} />
          <Route path="/clinician/:patientId" element={<ClinicianPage />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/patient/:patientId" element={<PatientPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
