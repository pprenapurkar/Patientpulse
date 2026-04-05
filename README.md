# PatientPulse — AI Clinical Decision Support

> A dual-user healthtech platform that creates a **living digital twin** for each patient — a real-time clinical profile assembled from EHR data, wearable streams, and daily patient check-ins.

---

## Quick Start (< 5 minutes)

### Prerequisites
- Docker & Docker Compose v2
- `curl` (for seed script)
- An Anthropic API key

### 1. Clone & configure

```bash
git clone <repo>
cd patientpulse
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
```

### 2. Start all services

```bash
cd infra
docker-compose up -d
```

Wait ~60 seconds for HAPI FHIR to initialise, then verify:

```bash
./scripts/health_check.sh
```

### 3. Seed Maria's FHIR data

```bash
./scripts/seed_fhir.sh
# Updates .env with PATIENT_ID automatically
```

### 4. Seed wearable data (72h stream)

```bash
curl -X POST http://localhost:8000/api/v1/dev/seed-wearables/$(grep PATIENT_ID .env | cut -d= -f2) \
  -H "Authorization: Bearer $(grep CLINICIAN_TOKEN .env | cut -d= -f2)"
```

### 5. Open the application

| Interface | URL |
|---|---|
| **Clinician Dashboard** | http://localhost:3000/clinician |
| **Patient Companion** | http://localhost:3000/patient |
| **API Docs** | http://localhost:8000/docs |
| **HAPI FHIR** | http://localhost:8080/fhir |

---

## Architecture

```
Frontend (React 18)  ←→  Backend (FastAPI)  ←→  HAPI FHIR R4
                              ↓
                      AI Agents (Claude)
                              ↓
                         Redis  |  PostgreSQL
```

### Services

| Service | Port | Purpose |
|---|---|---|
| HAPI FHIR Server | 8080 | FHIR R4 digital twin store |
| PostgreSQL | 5432 | HAPI FHIR persistence + app state |
| Redis | 6379 | Context cache (5min) + conversation history (24h) |
| FastAPI Backend | 8000 | API gateway + AI orchestration |
| React Frontend | 3000 | Clinician dashboard + patient companion |

---

## Key Features

### Clinician Dashboard (`/clinician`)
- **Alert Banners** — 2 proactive flags surfaced before any click (rule-based: nocturnal HR, step decline, HbA1c, BP)
- **EHR Snapshot** — Conditions (SNOMED CT), Medications (RxNorm), 5 most recent labs (LOINC)
- **Wearable Charts** — 72h Heart Rate, CGM Glucose, Steps (Recharts)
- **AI Query** — NL → DiagnosticAgent → SSE-streamed response with FHIR Observation citations
- **Scenario Simulator** — "Add GLP-1 agonist" / "Increase Metformin" → RxNorm check + deterministic projection + LLM narrative

### Patient Companion (`/patient`, 390px mobile view)
- **Companion Chat** — Daily NL check-in, AdherenceAgent extracts symptom/severity/medication
- **Med Confirm** — One-tap medication confirmation → streak counter → FHIR write
- **Recovery Score** — Weighted formula: adherence×40% + symptom_trend×40% + engagement×20%
- **Red Button** — Always-visible escalation → FHIR write → care team notification

### Living Digital Twin
Every patient action writes a FHIR Observation to HAPI FHIR. When Dr. Priya opens the dashboard, she sees Maria's 3 weeks of recovery before Maria says a word.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `CLINICIAN_TOKEN` | Yes | Demo clinician JWT (from `.env.example`) |
| `PATIENT_TOKEN` | Yes | Demo patient JWT (from `.env.example`) |
| `PATIENT_ID` | Yes | Set by `seed_fhir.sh` |
| `HAPI_FHIR_BASE_URL` | Yes | Default: `http://localhost:8080/fhir` |
| `REDIS_URL` | Yes | Default: `redis://:redispassword@localhost:6379/0` |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic key |

---

## Development

### Backend only
```bash
cd patientpulse   # monorepo root (contains backend/ ai/ as packages)
pip install -r backend/requirements.txt
PYTHONPATH=. uvicorn backend.app.main:app --reload --port 8000
```

### Frontend only
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### Run tests
```bash
# Backend
pytest backend/tests/ -v

# Frontend
cd frontend && npm test
```

---

## AI Agents

| Agent | LLM? | Trigger | Purpose |
|---|---|---|---|
| `OrchestratorAgent` | No (routing) | Every AI query | Routes to DiagnosticAgent |
| `DiagnosticAgent` | ✅ Claude Sonnet | Clinician NL query | Grounded trend analysis with FHIR citations |
| `WearableAgent` | ❌ Rule-based | Page load | Threshold anomaly detection |
| `AlertAgent` | ❌ Rule-based | Page load | Top-2 proactive flags |
| `ScenarioAgent` | ✅ Narrative only | Scenario button | RxNorm + projection + LLM narrative |
| `AdherenceAgent` | ✅ Claude Sonnet | Patient check-in | NL extraction + deterministic escalation |

**Key rule:** LLM is NEVER used for numeric projection, drug interactions, anomaly detection, or escalation decisions.

---

## FHIR Resources Used

| Resource | Code System | Purpose |
|---|---|---|
| `Patient` | — | Demographics (PHI-stripped in AI context) |
| `Condition` | SNOMED CT | Active diagnoses |
| `MedicationStatement` | RxNorm | Current medications |
| `Observation` | LOINC | Labs, vitals, wearables, check-in extractions |
| `AllergyIntolerance` | SNOMED CT | Drug allergies |
| `Encounter` | — | Admission/discharge dates |
| `CarePlan` | — | Recovery milestones |

---

## Security Notes (Demo Build)

- **Auth is stubbed** — Two hardcoded JWT tokens in `.env.example`. Production uses SMART on FHIR.
- **PHI minimization** — `PHIRedactionValidator` strips name, DOB, address before every Claude API call.
- **No secrets in repo** — `.env` is gitignored. Only `.env.example` is committed.
- **HIPAA AuditEvents** — Fully designed; wired in production build. Stubbed in this demo.

---

## Honest Demo Lines (per spec)

| Skipped | Say |
|---|---|
| Real JWT auth | "Auth stubbed with hardcoded tokens; production uses SMART on FHIR" |
| HIPAA AuditEvent wiring | "Audit trail is fully designed; wired in production build" |
| Parallel agent fan-out | "Orchestrator runs serial for demo simplicity; parallel fan-out is architected" |
| WCAG automated testing | "Accessibility audit planned; not enforced in this build" |
