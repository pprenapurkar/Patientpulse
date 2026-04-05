#!/usr/bin/env bash
# seed_fhir.sh — Load Maria Chen's Synthea FHIR bundle into HAPI FHIR
# Usage: ./infra/scripts/seed_fhir.sh [HAPI_BASE_URL]
set -euo pipefail

HAPI_BASE="${1:-http://localhost:8080/fhir}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$(cd "${SCRIPT_DIR}/../../fixtures" && pwd)"

echo "🏥 PatientPulse FHIR Seed Script"
echo "   HAPI FHIR: ${HAPI_BASE}"
echo ""

# ── Wait for HAPI FHIR to be ready ───────────────────────────────────────────
echo "⏳ Waiting for HAPI FHIR to be ready..."
until curl -sf "${HAPI_BASE}/metadata" > /dev/null; do
    echo "   HAPI not ready yet — retrying in 5s..."
    sleep 5
done
echo "✅ HAPI FHIR is ready"
echo ""

# ── Check if Maria already seeded ────────────────────────────────────────────
EXISTING=$(curl -sf "${HAPI_BASE}/Patient?identifier=maria-chen-001" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo "0")
if [ "$EXISTING" -gt 0 ]; then
    echo "ℹ️  Maria Chen already exists in FHIR — skipping seed"
    PATIENT_ID=$(curl -sf "${HAPI_BASE}/Patient?identifier=maria-chen-001" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['entry'][0]['resource']['id'])")
    echo "   Patient ID: ${PATIENT_ID}"
    echo "PATIENT_ID=${PATIENT_ID}" >> "${SCRIPT_DIR}/../../.env" 2>/dev/null || true
    exit 0
fi

# ── Create Patient — Maria Chen ───────────────────────────────────────────────
echo "👤 Creating Patient: Maria Chen, 58F..."
PATIENT_RESPONSE=$(curl -sf -X POST "${HAPI_BASE}/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "identifier": [{"system": "http://patientpulse.io/patients", "value": "maria-chen-001"}],
    "name": [{"use": "official", "family": "Chen", "given": ["Maria"]}],
    "gender": "female",
    "birthDate": "1966-03-15",
    "address": [{"city": "Chicago", "state": "IL", "postalCode": "60601"}]
  }')

PATIENT_ID=$(echo "$PATIENT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   ✅ Patient created: ID = ${PATIENT_ID}"

# ── Create Conditions ─────────────────────────────────────────────────────────
echo "🩺 Creating Conditions (T2D + HTN)..."

# Type 2 Diabetes
curl -sf -X POST "${HAPI_BASE}/Condition" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Condition\",
    \"clinicalStatus\": {\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/condition-clinical\", \"code\": \"active\"}]},
    \"code\": {\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"44054006\", \"display\": \"Type 2 Diabetes Mellitus\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"onsetDateTime\": \"2018-06-01\"
  }" > /dev/null
echo "   ✅ T2D (SNOMED 44054006)"

# Hypertension
curl -sf -X POST "${HAPI_BASE}/Condition" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Condition\",
    \"clinicalStatus\": {\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/condition-clinical\", \"code\": \"active\"}]},
    \"code\": {\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"38341003\", \"display\": \"Hypertension\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"onsetDateTime\": \"2017-02-10\"
  }" > /dev/null
echo "   ✅ Hypertension (SNOMED 38341003)"

# ── Create MedicationStatements ───────────────────────────────────────────────
echo "💊 Creating MedicationStatements..."

# Metformin
curl -sf -X POST "${HAPI_BASE}/MedicationStatement" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"MedicationStatement\",
    \"status\": \"active\",
    \"medicationCodeableConcept\": {\"coding\": [{\"system\": \"http://www.nlm.nih.gov/research/umls/rxnorm\", \"code\": \"860975\", \"display\": \"Metformin 500 MG Oral Tablet\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"dosage\": [{\"text\": \"500mg twice daily with meals\"}]
  }" > /dev/null
echo "   ✅ Metformin (RxNorm 860975)"

# Lisinopril
curl -sf -X POST "${HAPI_BASE}/MedicationStatement" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"MedicationStatement\",
    \"status\": \"active\",
    \"medicationCodeableConcept\": {\"coding\": [{\"system\": \"http://www.nlm.nih.gov/research/umls/rxnorm\", \"code\": \"314076\", \"display\": \"Lisinopril 10 MG Oral Tablet\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"dosage\": [{\"text\": \"10mg once daily\"}]
  }" > /dev/null
echo "   ✅ Lisinopril (RxNorm 314076)"

# Amlodipine
curl -sf -X POST "${HAPI_BASE}/MedicationStatement" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"MedicationStatement\",
    \"status\": \"active\",
    \"medicationCodeableConcept\": {\"coding\": [{\"system\": \"http://www.nlm.nih.gov/research/umls/rxnorm\", \"code\": \"197361\", \"display\": \"Amlodipine 5 MG Oral Tablet\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"dosage\": [{\"text\": \"5mg once daily\"}]
  }" > /dev/null
echo "   ✅ Amlodipine (RxNorm 197361)"

# ── Create Lab Observations ───────────────────────────────────────────────────
echo "🧪 Creating Lab Observations..."

NOW=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()-timedelta(days=14)).strftime('%Y-%m-%dT%H:%M:%SZ'))")

# HbA1c
HBA1C_ID=$(curl -sf -X POST "${HAPI_BASE}/Observation" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Observation\",
    \"status\": \"final\",
    \"category\": [{\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/observation-category\", \"code\": \"laboratory\"}]}],
    \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"4548-4\", \"display\": \"Hemoglobin A1c/Hemoglobin.total in Blood\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"effectiveDateTime\": \"${NOW}\",
    \"valueQuantity\": {\"value\": 8.2, \"unit\": \"%\", \"system\": \"http://unitsofmeasure.org\", \"code\": \"%\"}
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   ✅ HbA1c 8.2% (LOINC 4548-4) — ID: ${HBA1C_ID}"

# Systolic BP
curl -sf -X POST "${HAPI_BASE}/Observation" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Observation\",
    \"status\": \"final\",
    \"category\": [{\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/observation-category\", \"code\": \"vital-signs\"}]}],
    \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"8480-6\", \"display\": \"Systolic blood pressure\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"effectiveDateTime\": \"${NOW}\",
    \"valueQuantity\": {\"value\": 142, \"unit\": \"mmHg\", \"system\": \"http://unitsofmeasure.org\", \"code\": \"mm[Hg]\"}
  }" > /dev/null
echo "   ✅ Systolic BP 142 mmHg (LOINC 8480-6)"

# BMI
curl -sf -X POST "${HAPI_BASE}/Observation" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Observation\",
    \"status\": \"final\",
    \"category\": [{\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/observation-category\", \"code\": \"vital-signs\"}]}],
    \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"39156-5\", \"display\": \"Body mass index (BMI) [Ratio]\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"effectiveDateTime\": \"${NOW}\",
    \"valueQuantity\": {\"value\": 31.4, \"unit\": \"kg/m2\", \"system\": \"http://unitsofmeasure.org\", \"code\": \"kg/m2\"}
  }" > /dev/null
echo "   ✅ BMI 31.4 kg/m2 (LOINC 39156-5)"

# Cholesterol Total
curl -sf -X POST "${HAPI_BASE}/Observation" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Observation\",
    \"status\": \"final\",
    \"category\": [{\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/observation-category\", \"code\": \"laboratory\"}]}],
    \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"2093-3\", \"display\": \"Cholesterol [Mass/volume] in Serum or Plasma\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"effectiveDateTime\": \"${NOW}\",
    \"valueQuantity\": {\"value\": 218, \"unit\": \"mg/dL\", \"system\": \"http://unitsofmeasure.org\", \"code\": \"mg/dL\"}
  }" > /dev/null
echo "   ✅ Cholesterol 218 mg/dL (LOINC 2093-3)"

# eGFR
curl -sf -X POST "${HAPI_BASE}/Observation" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Observation\",
    \"status\": \"final\",
    \"category\": [{\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/observation-category\", \"code\": \"laboratory\"}]}],
    \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"33914-3\", \"display\": \"Glomerular filtration rate/1.73 sq M.predicted\"}]},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"effectiveDateTime\": \"${NOW}\",
    \"valueQuantity\": {\"value\": 68, \"unit\": \"mL/min/1.73m2\", \"system\": \"http://unitsofmeasure.org\", \"code\": \"mL/min/{1.73_m2}\"}
  }" > /dev/null
echo "   ✅ eGFR 68 (LOINC 33914-3)"

# ── Create Encounter ──────────────────────────────────────────────────────────
echo "🏥 Creating Encounter (recent discharge)..."
DISCHARGE_DATE=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()-timedelta(days=21)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
ADMIT_DATE=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()-timedelta(days=25)).strftime('%Y-%m-%dT%H:%M:%SZ'))")

curl -sf -X POST "${HAPI_BASE}/Encounter" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"Encounter\",
    \"status\": \"finished\",
    \"class\": {\"system\": \"http://terminology.hl7.org/CodeSystem/v3-ActCode\", \"code\": \"IMP\", \"display\": \"inpatient encounter\"},
    \"subject\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"period\": {\"start\": \"${ADMIT_DATE}\", \"end\": \"${DISCHARGE_DATE}\"},
    \"reasonCode\": [{\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"44054006\", \"display\": \"Diabetes management\"}]}]
  }" > /dev/null
echo "   ✅ Encounter (admitted ${ADMIT_DATE}, discharged ${DISCHARGE_DATE})"

# ── AllergyIntolerance ────────────────────────────────────────────────────────
echo "⚠️  Creating AllergyIntolerance..."
curl -sf -X POST "${HAPI_BASE}/AllergyIntolerance" \
  -H "Content-Type: application/fhir+json" \
  -d "{
    \"resourceType\": \"AllergyIntolerance\",
    \"clinicalStatus\": {\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical\", \"code\": \"active\"}]},
    \"code\": {\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"372687004\", \"display\": \"Penicillin\"}]},
    \"patient\": {\"reference\": \"Patient/${PATIENT_ID}\"},
    \"criticality\": \"high\",
    \"reaction\": [{\"manifestation\": [{\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"271807003\", \"display\": \"Skin rash\"}]}]}]
  }" > /dev/null
echo "   ✅ Penicillin allergy (high criticality)"

# ── Write PATIENT_ID to .env ──────────────────────────────────────────────────
echo ""
echo "✅ FHIR seed complete!"
echo "   Patient ID: ${PATIENT_ID}"
echo ""
echo "📝 Add this to your .env:"
echo "   PATIENT_ID=${PATIENT_ID}"
echo ""

# Auto-write to .env if it exists
if [ -f "${SCRIPT_DIR}/../../.env" ]; then
    if grep -q "^PATIENT_ID=" "${SCRIPT_DIR}/../../.env"; then
        sed -i.bak "s/^PATIENT_ID=.*/PATIENT_ID=${PATIENT_ID}/" "${SCRIPT_DIR}/../../.env"
    else
        echo "PATIENT_ID=${PATIENT_ID}" >> "${SCRIPT_DIR}/../../.env"
    fi
    echo "   Updated .env with PATIENT_ID"
fi
