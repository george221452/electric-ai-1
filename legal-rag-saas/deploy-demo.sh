#!/bin/bash
# Script pentru deploy rapid pe Vercel

echo "🚀 Pregătire deploy DEMO pe Vercel..."

# 1. Copiază .env.demo
 cp .env.demo .env.local

# 2. Build local pentru test
 echo "📦 Build aplicație..."
 npm run build

# 3. Instalează Vercel CLI dacă nu există
 if ! command -v vercel &> /dev/null; then
     echo "📥 Instalare Vercel CLI..."
     npm i -g vercel
 fi

# 4. Deploy
echo "🌐 Deploy pe Vercel..."
vercel --prod

echo "✅ Gata! Aplicația e live."
