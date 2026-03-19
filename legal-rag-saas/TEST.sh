#!/bin/bash
cd "$(dirname "$0")"

# Oprire server existent
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Curățare cache
rm -rf .next node_modules/.cache 2>/dev/null

echo "=== PORNIRE SERVER ==="
npm run dev > server.log 2>&1 &
PID=$!
sleep 12

echo ""
echo "=== TEST SELECTIVITATE ==="
curl -s http://localhost:3000/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"cum se face selectivitatea","sessionId":"test"}' \
  -o response.json

if [ -f response.json ]; then
    echo "Răspuns primit:"
    cat response.json | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print('isUniversalConcept:', d.get('isUniversalConcept'))
    print('Subiect:', d.get('subject'))
    print()
    print('Răspuns (primele 600 caractere):')
    print(d['response'][:600])
except Exception as e:
    print('Eroare JSON:', e)
    print('Conținut:', sys.stdin.read()[:300])
"
    rm -f response.json
else
    echo "Nu s-a primit răspuns"
    tail -20 server.log
fi

# Oprire server
kill $PID 2>/dev/null || true
echo ""
echo "=== TERMINAT ==="
