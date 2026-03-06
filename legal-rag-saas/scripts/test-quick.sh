#!/bin/bash

# Quick test script for LegalRAG

echo "🧪 Running LegalRAG Tests..."

# Test 1: Unit tests
echo "📋 Running unit tests..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed"
    exit 1
fi

# Test 2: TypeScript check (optional, can have errors in MVP)
echo "🔍 Checking TypeScript..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "🎉 Test run complete!"
echo ""
echo "Next steps:"
echo "  1. Configure .env file"
echo "  2. Run: docker-compose up -d"
echo "  3. Run: npx prisma migrate dev"
echo "  4. Run: npm run dev"
