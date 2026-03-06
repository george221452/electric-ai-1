#!/bin/bash

echo "=========================================="
echo "TEST RAG - Întrebări reale din Normativul I7"
echo "=========================================="
echo ""

API="http://localhost:3000/api/rag/query"
WORKSPACE="550e8400-e29b-41d4-a716-446655440000"

test_query() {
    local num=$1
    local query="$2"
    
    echo "------------------------------------------"
    echo "TEST $num: $query"
    echo "------------------------------------------"
    
    start_time=$(date +%s%N)
    
    response=$(curl -s -X POST "$API" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$query\", \"workspaceId\": \"$WORKSPACE\"}" 2>&1)
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # milliseconds
    
    # Check if valid JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        has_answer=$(echo "$response" | jq -r '.data.answer // empty')
        confidence=$(echo "$response" | jq -r '.data.confidence // 0')
        citations=$(echo "$response" | jq -r '.data.citations | length // 0')
        
        if [ -n "$has_answer" ]; then
            echo "✅ RĂSPUNS GĂSIT (${duration}ms)"
            echo "   Încredere: ${confidence}%"
            echo "   Citări: $citations"
            echo ""
            echo "Răspuns:"
            echo "$response" | jq -r '.data.answer' | head -8
        else
            echo "⚠️  NECESITĂ CLARIFICARE (${duration}ms)"
            echo "   Încredere: ${confidence}%"
            echo ""
            echo "Întrebare de clarificare:"
            echo "$response" | jq -r '.data.question' | head -5
        fi
    else
        echo "❌ EROARE (${duration}ms)"
        echo "$response" | head -3
    fi
    
    echo ""
}

# Test 1
test_query 1 "Ce este un dispozitiv DDR?"

# Test 2  
test_query 2 "Ce obligații există pentru prize în băi?"

# Test 3
test_query 3 "Cum se face împământarea unei clădiri?"

# Test 4
test_query 4 "Ce înălțime trebuie montate prizele?"

# Test 5
test_query 5 "Ce este priza de pământ?"

# Test 6
test_query 6 "Când este obligatorie instalarea de protecție la trasnet?"

# Test 7
test_query 7 "Ce curent maxim poate avea un DDR pentru locuințe?"

# Test 8
test_query 8 "Cum se face conexiunea la priza de pământ?"

# Test 9 - specifică cu figura
test_query 9 "figura 6.27 conexiuni exterioare fundație"

# Test 10 - întrebare vagă
test_query 10 "ce spune normativul"

echo "=========================================="
echo "TEST COMPLET"
echo "=========================================="
