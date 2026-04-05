#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatientPulse — Pre-Flight Verification
# Run this BEFORE starting Docker to catch all issues
# ═══════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       PatientPulse Pre-Flight Verification              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Check 1: Required commands ─────────────────────────────────
echo -e "${BLUE}[CHECK 1]${NC} Required commands..."
for cmd in docker curl python3 bash; do
  if command -v "$cmd" &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} $cmd"
  else
    echo -e "  ${RED}✗${NC} $cmd — NOT FOUND"
    ((ERRORS++))
  fi
done
echo ""

# ── Check 2: Docker daemon ─────────────────────────────────────
echo -e "${BLUE}[CHECK 2]${NC} Docker daemon..."
if docker info &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker is running"
else
  echo -e "  ${RED}✗${NC} Docker daemon is not running"
  echo -e "     ${YELLOW}→${NC} Start Docker Desktop or run: sudo systemctl start docker"
  ((ERRORS++))
fi
echo ""

# ── Check 3: Port availability ────────────────────────────────
echo -e "${BLUE}[CHECK 3]${NC} Port availability (3000, 5432, 6379, 8000, 8080)..."
for port in 3000 5432 6379 8000 8080; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠${NC} Port $port is in use"
    lsof -Pi :$port -sTCP:LISTEN | grep LISTEN | awk '{print "     Process: " $1 " (PID " $2 ")"}'
    ((WARNINGS++))
  else
    echo -e "  ${GREEN}✓${NC} Port $port is free"
  fi
done
echo ""

# ── Check 4: File structure ───────────────────────────────────
echo -e "${BLUE}[CHECK 4]${NC} Codebase structure..."
REQUIRED_FILES=(
  ".env.example"
  "Dockerfile.backend"
  "setup.sh"
  "backend/requirements.txt"
  "backend/app/main.py"
  "ai/agents/diagnostic_agent.py"
  "frontend/package.json"
  "frontend/Dockerfile"
  "frontend/src/vite-env.d.ts"
  "frontend/src/App.tsx"
  "infra/docker-compose.yml"
  "infra/scripts/seed_fhir.sh"
  "fixtures/maria_static.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file — MISSING"
    ((ERRORS++))
  fi
done
echo ""

# ── Check 5: TypeScript fixes ──────────────────────────────────
echo -e "${BLUE}[CHECK 5]${NC} TypeScript fixes applied..."

# Check vite-env.d.ts exists and has correct content
if [ -f "frontend/src/vite-env.d.ts" ]; then
  if grep -q "ImportMetaEnv" frontend/src/vite-env.d.ts && \
     grep -q "VITE_API_BASE_URL" frontend/src/vite-env.d.ts; then
    echo -e "  ${GREEN}✓${NC} vite-env.d.ts exists with correct types"
  else
    echo -e "  ${RED}✗${NC} vite-env.d.ts exists but has incorrect content"
    ((ERRORS++))
  fi
else
  echo -e "  ${RED}✗${NC} vite-env.d.ts is missing"
  ((ERRORS++))
fi

# Check that React imports are removed where not needed
REACT_IMPORT_CHECK=$(grep -r "^import React from 'react'$" frontend/src/App.tsx 2>/dev/null || echo "")
if [ -z "$REACT_IMPORT_CHECK" ]; then
  echo -e "  ${GREEN}✓${NC} Unused React imports removed from App.tsx"
else
  echo -e "  ${YELLOW}⚠${NC} App.tsx still has unused React import"
  ((WARNINGS++))
fi

# Check CompanionChat has 'as const' fix
if grep -q "role: 'user' as const" frontend/src/components/patient/CompanionChat.tsx; then
  echo -e "  ${GREEN}✓${NC} CompanionChat.tsx has type narrowing fix"
else
  echo -e "  ${RED}✗${NC} CompanionChat.tsx missing 'as const' type fix"
  ((ERRORS++))
fi
echo ""

# ── Check 6: Environment setup ────────────────────────────────
echo -e "${BLUE}[CHECK 6]${NC} Environment configuration..."
if [ -f ".env" ]; then
  echo -e "  ${GREEN}✓${NC} .env file exists"
  
  # Check for API key
  ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d= -f2)
  if [ "$ANTHROPIC_KEY" = "sk-ant-your-key-here" ] || [ -z "$ANTHROPIC_KEY" ]; then
    echo -e "  ${YELLOW}⚠${NC} ANTHROPIC_API_KEY not set — AI features will not work"
    echo -e "     ${YELLOW}→${NC} Set it in .env: ANTHROPIC_API_KEY=sk-ant-..."
    ((WARNINGS++))
  else
    echo -e "  ${GREEN}✓${NC} ANTHROPIC_API_KEY is set"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} .env file does not exist"
  echo -e "     ${YELLOW}→${NC} Run: cp .env.example .env"
  ((WARNINGS++))
fi
echo ""

# ── Check 7: Docker Compose syntax ────────────────────────────
echo -e "${BLUE}[CHECK 7]${NC} Docker Compose configuration..."
cd infra
if docker compose --env-file ../.env config > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} docker-compose.yml syntax is valid"
else
  echo -e "  ${RED}✗${NC} docker-compose.yml has syntax errors"
  docker compose --env-file ../.env config 2>&1 | tail -5
  ((ERRORS++))
fi
cd ..
echo ""

# ── Final Report ───────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "║  ${GREEN}✓ PRE-FLIGHT CHECK PASSED${NC}                             ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║  Your codebase is ready for deployment!                 ║"
  echo "║                                                          ║"
  echo "║  Next steps:                                             ║"
  echo "║  1. bash setup.sh     (automated setup)                  ║"
  echo "║     OR                                                   ║"
  echo "║  2. Manual setup:                                        ║"
  echo "║     cd infra && docker compose up -d --build             ║"
  echo "║     Wait ~2min, then: ./scripts/seed_fhir.sh             ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "║  ${YELLOW}⚠ WARNINGS DETECTED${NC}                                  ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║  Found $WARNINGS warning(s) — review above                      ║"
  echo "║  You can proceed but some features may not work          ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  exit 0
else
  echo -e "║  ${RED}✗ PRE-FLIGHT CHECK FAILED${NC}                             ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║  Found $ERRORS error(s) — fix before proceeding                ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  exit 1
fi
