#!/bin/bash
set -e

echo "🚀 Setting up LegalRAG..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please edit .env"
fi

npm install
npx prisma generate
docker-compose up -d
sleep 5
npx prisma migrate dev --name init

echo "✅ Setup complete!"
echo "🌐 http://localhost:3000"
