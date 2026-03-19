#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Pornesc serverul..."
npm run dev > /tmp/server.log 2>&1 &
SERVER_PID=$!

sleep 8

echo ""
echo "=== Pas 1: Întrebare inițială ==="
curl -s http://localhost:3000/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"cum se face selectivitatea?","sessionId":"demo123"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('Răspuns:', d['response'][:200]); print('Cere clarificări:', d.get('isAskingForClarifications', False))"

echo ""
echo "=== Pas 2: Clarificări ==="
RESPONSE=$(curl -s http://localhost:3000/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"instalatii interioare cupru","sessionId":"demo123"}')

echo "$RESPONSE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Răspuns complet:')
print(d['response'])
print()
print('=== Analiză ===')
text = d['response'].lower()
has_selectiv = 'selectiv' in text
has_protect = any(w in text for w in ['protect', 'disjunctor', 'siguran'])
print(f'Conține SELECTIVITATE: {has_selectiv}')
print(f'Conține PROTECȚIE: {has_protect}')
if has_selectiv:
    print('✅ Corect! Răspunde despre selectivitate.')
else:
    print('❌ Greșit! NU răspunde despre selectivitate.')
"

kill $SERVER_PID 2>/dev/null || true
echo ""
echo "Gata!"
