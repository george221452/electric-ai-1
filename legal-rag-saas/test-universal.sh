#!/bin/bash
cd "$(dirname "$0")"

echo "=== TEST CONCEPT UNIVERSAL ==="
echo ""

# Oprește serverul vechi
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "Pornesc serverul..."
npm run dev > /tmp/server.log 2>&1 &
PID=$!

sleep 10

echo "Testez selectivitatea (ar trebui să răspundă DIRECT)..."
RESPONSE=$(curl -s http://localhost:3000/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"cum se face selectivitatea","sessionId":"test-u"}')

echo "$RESPONSE" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print('✅ Răspuns primit')
    print('Subiect:', d.get('subject'))
    print('isUniversalConcept:', d.get('isUniversalConcept', False))
    print('Cere clarificări:', d.get('isAskingForClarifications', False))
    print()
    print('--- Răspuns ---')
    print(d['response'][:500])
except Exception as e:
    print('❌ Eroare:', e)
    print('Răspuns brut:', sys.stdin.read()[:200])
"

echo ""
echo "Oprire server..."
kill $PID 2>/dev/null || true
echo "Gata!"
