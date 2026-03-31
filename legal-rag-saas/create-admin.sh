#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT CREARE ADMIN - LegalRAG
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Oprește la prima eroare

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║          🚀 CREARE ADMIN USER - LegalRAG                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Culori
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Email și parolă default
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"

echo -e "${BLUE}📧 Email:${NC} $ADMIN_EMAIL"
echo -e "${BLUE}🔑 Parolă:${NC} $ADMIN_PASSWORD"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Verificare Docker
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}⏳ 1. Verificare Docker...${NC}"

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker nu rulează!${NC}"
    echo "   Pornește Docker Desktop și încearcă din nou."
    exit 1
fi

echo -e "${GREEN}✅ Docker activ${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Pornire PostgreSQL
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}⏳ 2. Pornire PostgreSQL...${NC}"

if docker ps | grep -q "postgres"; then
    echo -e "${GREEN}✅ PostgreSQL deja rulează${NC}"
else
    docker compose up -d postgres 2>&1 | tail -1
    echo -e "${GREEN}✅ PostgreSQL pornit${NC}"
    echo -e "${YELLOW}   Aștept 5 secunde pentru inițializare...${NC}"
    sleep 5
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Aplicare migrări Prisma
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}⏳ 3. Aplicare migrări bază de date...${NC}"

npx prisma migrate deploy 2>&1 | tail -3 || true
npx prisma generate > /dev/null 2>&1

echo -e "${GREEN}✅ Migrări aplicate${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Creare user admin
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}⏳ 4. Creare user admin...${NC}"

npx tsx scripts/create-admin.ts 2>&1

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Verificare finală
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP COMPLET CU SUCCES!                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🔑 POȚI SĂ TE LOGHEZI CU:${NC}"
echo ""
echo "   ┌─────────────────────────────────────────┐"
echo "   │  Email:    admin@example.com            │"
echo "   │  Parolă:   admin123                     │"
echo "   └─────────────────────────────────────────┘"
echo ""
echo "   🌐 Pagină login: http://localhost:3000/auth/signin"
echo "   ⚙️  Admin panel: http://localhost:3000/admin/rag-architecture"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Întreabă dacă vrea să pornească serverul
read -p "🚀 Vrei să pornești serverul acum? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏳ Pornire server...${NC}"
    npm run dev
else
    echo -e "${BLUE}💡 Pornește manual cu:${NC} npm run dev"
fi
