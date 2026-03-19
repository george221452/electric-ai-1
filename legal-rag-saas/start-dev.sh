#!/bin/bash

# Script de pornire completă pentru Legal RAG SaaS
# Pornește toate serviciile Docker + aplicația Next.js

echo "🚀 Pornesc sistemul Legal RAG SaaS..."
echo ""

# Culori pentru output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detectează comanda Docker Compose disponibilă
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}❌ Eroare: Docker Compose nu este instalat!${NC}"
    echo "Instalează Docker Desktop sau Docker Compose."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Verifică dacă Docker rulează
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Eroare: Docker nu rulează!${NC}"
    echo "Pornește Docker Desktop mai întâi."
    exit 1
fi

echo -e "${YELLOW}📦 Pasul 1: Pornesc serviciile Docker...${NC}"
$DOCKER_COMPOSE up -d postgres qdrant redis minio unstructured

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Eroare la pornirea serviciilor Docker${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Serviciile Docker sunt pornite!${NC}"
echo ""
echo "🔄 Aștept 5 secunde pentru ca serviciile să fie gata..."
sleep 5

# Verifică sănătatea serviciilor
echo ""
echo -e "${YELLOW}🔍 Verific starea serviciilor...${NC}"

# Qdrant
if curl -s http://localhost:6333 > /dev/null; then
    echo -e "${GREEN}  ✅ Qdrant (port 6333)${NC}"
else
    echo -e "${RED}  ⚠️  Qdrant nu răspunde încă${NC}"
fi

# PostgreSQL
if $DOCKER_COMPOSE ps | grep postgres | grep "Up" > /dev/null; then
    echo -e "${GREEN}  ✅ PostgreSQL (port 5432)${NC}"
else
    echo -e "${RED}  ⚠️  PostgreSQL nu e gata${NC}"
fi

# Redis
if $DOCKER_COMPOSE ps | grep redis | grep "Up" > /dev/null; then
    echo -e "${GREEN}  ✅ Redis (port 6380)${NC}"
else
    echo -e "${RED}  ⚠️  Redis nu e gata${NC}"
fi

# MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null; then
    echo -e "${GREEN}  ✅ MinIO (port 9000)${NC}"
else
    echo -e "${RED}  ⚠️  MinIO nu răspunde încă${NC}"
fi

echo ""
echo -e "${YELLOW}⚙️  Pasul 2: Pornesc aplicația Next.js...${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 Aplicația va fi disponibilă pe:"
echo "     http://localhost:3000"
echo ""
echo "  📊 Interfețe servicii:"
echo "     • Qdrant:     http://localhost:6333/dashboard"
echo "     • Redis:      localhost:6380"
echo "     • MinIO:      http://localhost:9001"
echo "     • PostgreSQL: localhost:5432"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🚀 Pornesc serverul de development...${NC}"
echo ""

# Pornește Next.js
npm run dev
