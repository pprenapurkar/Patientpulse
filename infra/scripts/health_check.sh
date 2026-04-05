#!/usr/bin/env bash
set -euo pipefail
echo "🔍 PatientPulse Health Check"
echo ""
check() { local name=$1 url=$2
  if curl -sf "$url" > /dev/null 2>&1; then echo "  ✅ $name"; else echo "  ❌ $name ($url)"; fi
}
check "HAPI FHIR"   "http://localhost:8080/fhir/metadata"
check "Backend API" "http://localhost:8000/health"
check "Frontend"    "http://localhost:3000"
check "PostgreSQL"  "$(docker-compose -f infra/docker-compose.yml exec -T postgres pg_isready -U hapi && echo 'ok' || echo 'fail')" 2>/dev/null || echo "  ⚠  PostgreSQL (run from project root)"
echo ""
