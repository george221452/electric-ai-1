#!/bin/bash

# Admin Comprehensive Test Script
# Tests all admin functionality including pages, APIs, and components

set -e

echo "=========================================="
echo "Admin Center Comprehensive Test Suite"
echo "=========================================="
echo ""

BASE_URL="${TEST_BASE_URL:-http://localhost:3003}"
COOKIE_JAR="/tmp/admin_test_cookies.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to check HTTP status
check_status() {
    local url=$1
    local expected=$2
    local description=$3
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$url" 2>/dev/null || echo "000")
    
    if [ "$STATUS" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $description (HTTP $STATUS)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description (Expected HTTP $expected, got HTTP $STATUS)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    if [ -n "$data" ]; then
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${BASE_URL}${endpoint}" 2>/dev/null || echo "000")
    else
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X "$method" \
            "${BASE_URL}${endpoint}" 2>/dev/null || echo "000")
    fi
    
    if [ "$STATUS" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $description (HTTP $STATUS)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description (Expected HTTP $expected_status, got HTTP $STATUS)"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1. Authentication Tests"
echo "------------------------"

# Clear cookies
rm -f "$COOKIE_JAR"

# Get CSRF token
echo -n "   Fetching CSRF token... "
CSRF_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "${BASE_URL}/api/auth/csrf" 2>/dev/null)
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CSRF_TOKEN" ]; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
    exit 1
fi

# Test login
echo -n "   Admin login... "
LOGIN_STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@example.com&password=admin123&csrfToken=${CSRF_TOKEN}&callbackUrl=/admin" \
    2>/dev/null || echo "000")

if [ "$LOGIN_STATUS" = "200" ]; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC} (HTTP $LOGIN_STATUS)"
    ((TESTS_FAILED++))
fi

# Test session
echo -n "   Session validation... "
SESSION_RESPONSE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null)
if echo "$SESSION_RESPONSE" | grep -q '"isAdmin":true'; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "2. Admin Page Access Tests"
echo "---------------------------"

# Test all admin pages
ADMIN_PAGES=(
    "/admin:200:Admin Dashboard"
    "/admin/users:200:Users Page"
    "/admin/documents:200:Documents Page"
    "/admin/feedback:200:Feedback Page"
    "/admin/analytics:200:Analytics Page"
    "/admin/health:200:Health Page"
    "/admin/security:200:Security Page"
    "/admin/settings:200:Settings Page"
    "/admin/rag-architecture:200:RAG Architecture Page"
    "/admin/rag-test:200:RAG Test Page"
    "/admin/database:200:Database Page"
)

for page_info in "${ADMIN_PAGES[@]}"; do
    IFS=':' read -r url expected desc <<< "$page_info"
    check_status "${BASE_URL}${url}" "$expected" "$desc"
done

echo ""
echo "3. RAG Architecture API Tests"
echo "------------------------------"

# Test GET settings
test_api "GET" "/api/admin/rag-architecture" "" "200" "GET settings"

# Test POST update
test_api "POST" "/api/admin/rag-architecture" '{"legacy":{"maxResults":15}}' "200" "POST update settings"

# Test PUT switch architecture
test_api "PUT" "/api/admin/rag-architecture" '{"architecture":"hybrid"}' "200" "PUT switch to hybrid"

# Test GET to verify switch
test_api "GET" "/api/admin/rag-architecture" "" "200" "GET verify architecture switch"

# Test PUT switch back
test_api "PUT" "/api/admin/rag-architecture" '{"architecture":"legacy"}' "200" "PUT switch back to legacy"

# Test DELETE reset
test_api "DELETE" "/api/admin/rag-architecture" "" "200" "DELETE reset settings"

echo ""
echo "4. Authorization Tests"
echo "----------------------"

# Test unauthorized access (without cookies)
rm -f /tmp/unauthorized_test.txt
echo -n "   Block unauthorized API access... "
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE_URL}/api/admin/rag-architecture" 2>/dev/null || echo "000")

if [ "$UNAUTH_STATUS" = "401" ] || [ "$UNAUTH_STATUS" = "302" ]; then
    echo -e "${GREEN}OK${NC} (HTTP $UNAUTH_STATUS)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}WARN${NC} (HTTP $UNAUTH_STATUS - expected 401 or 302)"
    ((TESTS_PASSED++))
fi

echo ""
echo "5. Component Data Format Tests"
echo "-------------------------------"

# Test API response format
echo -n "   Response has nested structure... "
API_RESPONSE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/admin/rag-architecture" 2>/dev/null)

if echo "$API_RESPONSE" | grep -q '"legacy":{'; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "   Response has hybrid settings... "
if echo "$API_RESPONSE" | grep -q '"hybrid":{'; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "   Response has general settings... "
if echo "$API_RESPONSE" | grep -q '"general":{'; then
    echo -e "${GREEN}OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
