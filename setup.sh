#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatientPulse — One-Command Setup
# Usage: bash setup.sh
# ═══════════════════════════════════════════════════════════════
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       PatientPulse Setup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Create .env ────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
else
  echo "ℹ️  .env already exists — skipping copy"
fi

# ── Step 2: Prompt for API key ─────────────────────────────────
CURRENT_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d= -f2)
if [ "$CURRENT_KEY" = "sk-ant-your-key-here" ] || [ -z "$CURRENT_KEY" ]; then
  echo ""
  echo "📍 Get your Anthropic API key from: https://console.anthropic.com"
  read -p "   Paste your ANTHROPIC_API_KEY (or press Enter to skip): " API_KEY
  if [ -n "$API_KEY" ]; then
    sed -i.bak "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${API_KEY}|" .env && rm -f .env.bak
    echo "✅ API key saved to .env"
  else
    echo "⚠️  Skipped — AI features will not work without an API key"
  fi
else
  echo "✅ ANTHROPIC_API_KEY already set"
fi

# ── Step 3: Start Docker services ─────────────────────────────
echo ""
echo "🐳 Starting Docker services..."
cd infra
docker compose --env-file ../.env up -d --build
cd ..

echo ""
echo "⏳ Waiting for HAPI FHIR to be ready (this takes ~60-90 seconds)..."
until curl -sf http://localhost:8080/fhir/metadata > /dev/null 2>&1; do
  printf "."
  sleep 5
done
echo ""
echo "✅ HAPI FHIR is ready!"

# ── Step 4: Seed FHIR data ─────────────────────────────────────
echo ""
echo "🏥 Seeding Maria Chen's clinical data into HAPI FHIR..."
bash infra/scripts/seed_fhir.sh
# seed_fhir.sh updates .env with PATIENT_ID automatically

# ── Step 5: Reload PATIENT_ID from .env ───────────────────────
source .env 2>/dev/null || true
PATIENT_ID=$(grep "^PATIENT_ID=" .env | cut -d= -f2)
CLINICIAN_TOKEN=$(grep "^CLINICIAN_TOKEN=" .env | cut -d= -f2)

# ── Step 6: Seed wearable data ─────────────────────────────────
echo ""
echo "📡 Seeding 72h wearable data (HR, Glucose, Steps)..."
curl -sf -X POST "http://localhost:8000/api/v1/dev/seed-wearables/${PATIENT_ID}" \
  -H "Authorization: Bearer ${CLINICIAN_TOKEN}" > /dev/null && \
  echo "✅ Wearable data seeded" || \
  echo "⚠️  Wearable seed failed — backend may still be starting, retry manually"

# ── Done ───────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        🎉 PatientPulse is ready!         ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Clinician:  http://localhost:3000       ║"
echo "║  Patient:    http://localhost:3000/patient║"
echo "║  API Docs:   http://localhost:8000/docs  ║"
echo "║  HAPI FHIR:  http://localhost:8080/fhir  ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
