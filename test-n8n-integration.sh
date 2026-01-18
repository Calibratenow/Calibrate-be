#!/bin/bash

# n8n Integration Test Script
# Tests the complete flow: Backend → n8n → Response

echo "=================================="
echo "n8n Integration Test Script"
echo "=================================="
echo ""

# Configuration
N8N_WEBHOOK_URL="https://techspace.app.n8n.cloud/webhook-test/consultant-ai"
BACKEND_URL="http://localhost:5000"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="yourpassword"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Direct n8n Webhook Test
echo "Test 1: Testing n8n webhook directly..."
echo "URL: $N8N_WEBHOOK_URL"
echo ""

RESPONSE=$(curl -s -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"query": "Test prompt: I need help with customer support"}' \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ n8n webhook is accessible${NC}"
    echo "Response: $BODY"
    
    # Check if response has 'content' field
    if echo "$BODY" | grep -q "content"; then
        echo -e "${GREEN}✓ Response has 'content' field${NC}"
    else
        echo -e "${YELLOW}⚠ Response doesn't have 'content' field. Actual response:${NC}"
        echo "$BODY"
    fi
else
    echo -e "${RED}✗ n8n webhook test failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    exit 1
fi

echo ""
echo "=================================="
echo ""

# Test 2: Backend Health Check
echo "Test 2: Testing backend health check..."
echo ""

# First, login to get cookies
echo "Logging in to backend..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c /tmp/cookies.txt \
  -w "\n%{http_code}")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

if [ "$LOGIN_HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${YELLOW}⚠ Login failed. Using test without auth...${NC}"
    echo "Note: You may need to create a test user first"
fi

echo ""

# Test health check
echo "Testing /api/ai/health endpoint..."
HEALTH_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/ai/health" \
  -b /tmp/cookies.txt \
  -w "\n%{http_code}")

HEALTH_HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Backend health check passed${NC}"
    echo "Response: $HEALTH_BODY"
else
    echo -e "${RED}✗ Backend health check failed (HTTP $HEALTH_HTTP_CODE)${NC}"
    echo "Response: $HEALTH_BODY"
fi

echo ""
echo "=================================="
echo ""

# Test 3: Full Integration Test
if [ "$LOGIN_HTTP_CODE" -eq 200 ]; then
    echo "Test 3: Testing full integration (Backend → n8n → Response)..."
    echo ""
    
    AI_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai/generate-prompt" \
      -H "Content-Type: application/json" \
      -b /tmp/cookies.txt \
      -d '{"prompt": "I need a prompt for automated email responses"}' \
      -w "\n%{http_code}")
    
    AI_HTTP_CODE=$(echo "$AI_RESPONSE" | tail -n1)
    AI_BODY=$(echo "$AI_RESPONSE" | sed '$d')
    
    if [ "$AI_HTTP_CODE" -eq 201 ]; then
        echo -e "${GREEN}✓ AI prompt generation successful${NC}"
        echo "Response: $AI_BODY"
        
        # Check if conversationId exists
        if echo "$AI_BODY" | grep -q "conversationId"; then
            echo -e "${GREEN}✓ Conversation saved to Firebase${NC}"
        else
            echo -e "${YELLOW}⚠ Response doesn't include conversationId${NC}"
        fi
    else
        echo -e "${RED}✗ AI prompt generation failed (HTTP $AI_HTTP_CODE)${NC}"
        echo "Response: $AI_BODY"
    fi
    
    echo ""
    echo "=================================="
    echo ""
    
    # Test 4: Get History
    echo "Test 4: Testing conversation history retrieval..."
    echo ""
    
    HISTORY_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/ai/history?limit=5" \
      -b /tmp/cookies.txt \
      -w "\n%{http_code}")
    
    HISTORY_HTTP_CODE=$(echo "$HISTORY_RESPONSE" | tail -n1)
    HISTORY_BODY=$(echo "$HISTORY_RESPONSE" | sed '$d')
    
    if [ "$HISTORY_HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ History retrieval successful${NC}"
        echo "Response: $HISTORY_BODY"
    else
        echo -e "${RED}✗ History retrieval failed (HTTP $HISTORY_HTTP_CODE)${NC}"
        echo "Response: $HISTORY_BODY"
    fi
else
    echo -e "${YELLOW}⚠ Skipping full integration test (not logged in)${NC}"
fi

echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ n8n webhook: PASS${NC}"
else
    echo -e "${RED}✗ n8n webhook: FAIL${NC}"
fi

if [ "$HEALTH_HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Backend health: PASS${NC}"
else
    echo -e "${RED}✗ Backend health: FAIL${NC}"
fi

if [ "$LOGIN_HTTP_CODE" -eq 200 ]; then
    if [ "$AI_HTTP_CODE" -eq 201 ]; then
        echo -e "${GREEN}✓ Full integration: PASS${NC}"
    else
        echo -e "${RED}✗ Full integration: FAIL${NC}"
    fi
    
    if [ "$HISTORY_HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ History retrieval: PASS${NC}"
    else
        echo -e "${RED}✗ History retrieval: FAIL${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Full integration: SKIPPED (auth required)${NC}"
fi

echo ""
echo "=================================="
echo ""

# Cleanup
rm -f /tmp/cookies.txt

echo "Test completed!"
echo ""
echo "Next steps:"
echo "1. If n8n test passed: n8n webhook is working correctly ✓"
echo "2. If backend health passed: Backend can connect to n8n ✓"
echo "3. If full integration passed: Complete flow is working ✓"
echo "4. Check Firebase Console to verify data was saved"
echo ""

