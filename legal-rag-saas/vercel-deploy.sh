#!/bin/bash
set -e

echo "🚀 Deploy LegalRAG pe Vercel..."

# Citeste cheia din .env.local
OPENAI_KEY=$(grep OPENAI_API_KEY .env.local | cut -d'=' -f2)

echo ""
echo "⚠️  ATENȚIE: Vei deploya cu cheia OpenAI actuală."
echo "📊 Consumul de tokens va fi pe contul tău."
echo ""
read -p "Continui? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ Anulat."
    exit 1
fi

# Login Vercel dacă nu e deja
if ! vercel whoami &>/dev/null; then
    echo "🔐 Login Vercel..."
    vercel login
fi

# Setează variabilele de mediu
vercel env add OPENAI_API_KEY production <<< "$OPENAI_KEY"
vercel env add NEXTAUTH_SECRET production <<< "legal-rag-secret-$(date +%s)"
vercel env add DATABASE_URL production <<< "file:./prisma/dev.db"
vercel env add QDRANT_URL production <<< "http://localhost:6333"
vercel env add REDIS_URL production <<< "redis://localhost:6379"

# Build și deploy
echo "📦 Building..."
npm run build

echo "🌐 Deploying..."
vercel --prod

echo "✅ Deploy complet!"
