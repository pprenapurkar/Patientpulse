# PatientPulse 🏥

**2nd Place Winner - ScarletHacks 2026 Healthcare Track**

A multi-agent AI clinical decision support platform that creates a "living clinical profile" bridging episodic hospital visits with continuous health monitoring through FHIR R4 data, wearable streams, and intelligent AI agents.

![PatientPulse Banner](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/003/326/084/datas/gallery.jpg)

## 🎯 The Problem

Healthcare operates in silos:
- **Episodic Care**: Hospital visits capture snapshots, missing the 99% of life happening between appointments
- **Fragmented Data**: EHRs, wearables, and patient reports live in separate systems
- **Reactive Medicine**: Clinicians intervene after problems manifest, not before
- **Discharge Black Hole**: Post-discharge recovery monitoring is minimal, leading to preventable readmissions

## 💡 Our Solution

PatientPulse creates a **continuous clinical profile** that evolves in real-time by:

1. **Bridging Hospital ↔ Home**: Integrating FHIR R4 clinical data with consumer wearable streams
2. **AI Multi-Agent Architecture**: Specialized agents for diagnostics, treatment simulation, and vitals monitoring
3. **Proactive Intelligence**: Anomaly detection flags issues before they become emergencies
4. **Patient-Centered Design**: A mobile companion app that makes recovery monitoring feel natural, not clinical

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PatientPulse                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐       │
│  │   Clinician       │              │   Patient        │       │
│  │   Dashboard       │              │   Companion      │       │
│  │   (React 18)      │              │   (Mobile UI)    │       │
│  └────────┬──────────┘              └────────┬─────────┘       │
│           │                                  │                 │
│           └──────────────┬───────────────────┘                 │
│                          │                                     │
│           ┌──────────────▼──────────────┐                      │
│           │      FastAPI Backend        │                      │
│           │   ┌──────────────────────┐  │                      │
│           │   │  AI Agent Layer      │  │                      │
│           │   │  (Claude Sonnet 4)   │  │                      │
│           │   │                      │  │                      │
│           │   │  • Clinical Insights │  │                      │
│           │   │  • Treatment Impact  │  │                      │
│           │   │  • Vitals Monitor    │  │                      │
│           │   │  • Recovery Coach    │  │                      │
│           │   └──────────────────────┘  │                      │
│           └──────────────┬──────────────┘                      │
│                          │                                     │
│           ┌──────────────┼──────────────┐                      │
│           │              │              │                      │
│      ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                │
│      │  HAPI    │  │ PostgreSQL│  │  Redis   │                │
│      │  FHIR R4 │  │   (App)   │  │  Cache   │                │
│      └──────────┘  └───────────┘  └──────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Differentiator

**Not all agents use LLMs** - PatientPulse maintains a strict boundary between LLM reasoning and deterministic clinical logic:
- **LLM Agents**: Clinical insights, scenario simulation, conversational support
- **Deterministic Rules**: Vitals thresholds, medication adherence tracking, FHIR validation
- **Result**: Predictable, auditable behavior where clinical accuracy matters most

## ✨ Features

### For Clinicians

- **🔍 Clinical Insights Agent**: Natural language queries over longitudinal FHIR data with citation-backed responses
- **🔮 Treatment Impact Simulator**: "What-if" scenario modeling using RxNorm drug interaction APIs and evidence-based HbA1c projections
- **📊 Wearable Integration**: Real-time heart rate, glucose (CGM), and activity tracking with anomaly detection
- **📈 Recovery Score**: Composite metric tracking post-discharge progress

### For Patients

- **💬 Recovery Companion**: Daily check-ins with conversational AI that flags concerns for clinical review
- **💊 Medication Adherence**: One-tap confirmation with streak tracking and milestone rewards
- **🚨 Smart Escalation**: ML-based triage (FOLLOW_UP vs. ESCALATE) with direct care team contact
- **📱 Mobile-Optimized**: Designed for 390px mobile screens with touch-friendly interactions

## 🛠️ Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- Zustand (state management)
- React Query (data fetching/caching)
- Recharts (data visualization)
- Tailwind-inspired CSS with custom properties

**Backend**
- FastAPI (Python 3.11)
- Anthropic Claude Sonnet 4 (multi-agent orchestration)
- HAPI FHIR R4 (clinical data server)
- PostgreSQL (application database)
- Redis (caching layer)

**Infrastructure**
- Docker Compose (local development)
- Nginx (frontend serving)

**Clinical Standards**
- FHIR R4 (HL7 interoperability)
- LOINC (lab observations)
- SNOMED CT (clinical terminology)
- RxNorm (medication codes)
- ICD-10 (diagnosis codes)

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+ (for local frontend development)
- Anthropic API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/pprenapurkar/Patientpulse.git
cd Patientpulse
```

2. **Set up environment variables**
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Anthropic API key
ANTHROPIC_API_KEY=your_api_key_here
```

3. **Start the application**
```bash
cd infra
docker compose up -d --build
```

4. **Wait for services to initialize** (~2 minutes for HAPI FHIR)
```bash
# Check service health
docker compose ps
```

5. **Access the application**
- Clinician Dashboard: http://localhost:3000/clinician
- Patient Companion: http://localhost:3000/patient
- API Documentation: http://localhost:8000/docs

### Demo Patient

The app ships with a pre-seeded demo patient (ID: `1000`) representing a 68-year-old woman with:
- Type 2 Diabetes Mellitus
- Hypertension
- Recent hospitalization for DKA
- Active medications (Metformin, Lisinopril, Atorvastatin)
- 72 hours of simulated wearable data (heart rate, CGM, steps)

## 📁 Project Structure

```
patientpulse/
├── backend/
│   ├── app/
│   │   ├── agents/          # AI agent implementations
│   │   ├── api/             # FastAPI routes
│   │   ├── core/            # Configuration & utilities
│   │   ├── services/        # Business logic layer
│   │   └── main.py          # Application entry point
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             # API client & hooks
│   │   ├── components/      # React components
│   │   ├── pages/           # Route pages
│   │   ├── store/           # Zustand state management
│   │   └── App.tsx
│   └── Dockerfile
├── infra/
│   ├── docker-compose.yml   # Service orchestration
│   ├── scripts/             # FHIR data seeding
│   └── nginx/               # Frontend server config
└── README.md
```

## 🏥 Clinical Use Cases

### 1. Post-Discharge Monitoring (Primary Use Case)

**Scenario**: 68-year-old diabetic patient discharged after DKA hospitalization

**How PatientPulse Helps**:
- Daily check-ins catch early warning signs (fatigue, confusion, nausea)
- CGM trends alert clinician to glucose instability before readmission
- Medication adherence tracking prevents gaps in insulin coverage
- Recovery score quantifies progress objectively

**Result**: Proactive intervention when recovery score drops, preventing ER visit

### 2. Medication Reconciliation

**Scenario**: Clinician considers adding GLP-1 agonist to diabetes regimen

**How PatientPulse Helps**:
- Treatment Impact Simulator checks RxNorm drug interactions
- Projects 12-week HbA1c trajectory using evidence-based models
- Shows potential side effects and monitoring requirements

**Result**: Informed shared decision-making with quantified risk/benefit

### 3. Chronic Disease Management

**Scenario**: Monitoring long-term diabetes control between quarterly visits

**How PatientPulse Helps**:
- Continuous wearable data fills gaps between A1c checks
- Anomaly detection flags patterns (dawn phenomenon, post-meal spikes)
- Patient companion normalizes daily health engagement

**Result**: Earlier interventions, better outcomes, lower costs

## 🎓 What We Learned

1. **FHIR is Complex**: The HL7 FHIR spec is massive. We focused on core resources (Patient, Observation, MedicationRequest, Condition) and leveraged HAPI FHIR's validation.

2. **LLM + Deterministic = Best of Both**: Pure LLM approaches lack auditability for clinical use. Hybrid architecture gives us natural language UX with rule-based safety.

3. **Wearables Need Context**: Raw heart rate data is noisy. Pairing it with patient-reported symptoms (via check-ins) creates actionable intelligence.

4. **Mobile-First Matters**: Patients interact on phones. We designed the companion app for one-handed thumb use on 390px screens.

5. **Docker Complexity**: Multi-service orchestration (FastAPI, FHIR server, PostgreSQL, Redis, React) requires careful env variable management and health checks.

## 🔮 Future Enhancements

### Technical
- [ ] Real wearable integrations (Apple Health, Fitbit, Dexcom APIs)
- [ ] SMART on FHIR authentication for EHR integration
- [ ] Vector database (Pinecone) for semantic search over clinical notes
- [ ] HL7 v2 message ingestion for legacy systems

### Clinical
- [ ] Expand to post-surgical recovery (orthopedic, cardiac)
- [ ] Multi-condition support (CHF, COPD, CKD)
- [ ] Care team collaboration (physician + nurse + pharmacist dashboards)
- [ ] Integration with IMO Health's Precision Normalize for diagnosis mapping

### Product
- [ ] Family caregiver portal
- [ ] Spanish language support
- [ ] Voice-based check-ins for accessibility
- [ ] Insurance claims integration for outcomes-based reimbursement

## 🏆 Hackathon Recognition

**ScarletHacks 2026 - 2nd Place Overall**
- **Track**: Intelligent Healthcare (sponsored by Leap of Faith Technologies)
- **Judges**: Dr. Frank Naeymi-Rad (IMO Health Co-Founder, ACMI Fellow), John Trzesniak (LOF President)
- **Evaluation Criteria**: Clinical relevance, technical execution, scalability, innovation

**Judge Feedback** (paraphrased):
> "Strong use of FHIR standards and multi-agent architecture. The treatment simulator with RxNorm integration shows real clinical utility. Mobile companion app is well-designed for patient engagement."

## 👥 Team

**TwinCore**
- [Prasanna Prenapurkar](https://github.com/pprenapurkar) - Full-stack Developer, CS595 Medical Informatics @ IIT
- [Rahul Mandviya] 

Built in 48 hours at ScarletHacks 2026 (April 4-5, 2026) at Illinois Institute of Technology.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- **Leap of Faith Technologies** for sponsoring the Healthcare track and providing domain expertise
- **Anthropic** for Claude API access
- **HAPI FHIR** community for the open-source FHIR server
- **Synthea** for synthetic patient data generation methodology
- **IIT CS595 Medical Informatics** course for foundational clinical informatics knowledge

## 📞 Contact

- **Devpost**: https://devpost.com/software/patientpulse
- **GitHub**: https://github.com/pprenapurkar/Patientpulse
- **Email**: prenapurkar@hawk.illinoistech.edu

---

**Note**: This is a hackathon prototype built for demonstration purposes. Not cleared for clinical use. All patient data is synthetic (generated using Synthea-inspired methodology).
