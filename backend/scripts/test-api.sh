#!/bin/bash

# Test script for Bastion API
# Usage: ./scripts/test-api.sh

API_URL="http://localhost:3000"
API_KEY="${BASTION_API_KEY:-bst_demo_test123}"

echo "🧪 Testing Bastion API"
echo "API URL: $API_URL"
echo "API Key: $API_KEY"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Health check
echo "Test 1: Health Check"
response=$(curl -s -w "\n%{http_code}" "$API_URL/health")
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Health check failed (HTTP $status_code)${NC}"
fi
echo ""

# Test 2: Authorize - Allowed action
echo "Test 2: Authorization - Allowed Action"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/authorize" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "type": "http_request",
      "details": {
        "method": "GET",
        "url": "https://api.example.com/users"
      }
    }
  }')

status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ Authorization endpoint working${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Authorization failed (HTTP $status_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 3: Authorize - High spending (should be blocked if policy exists)
echo "Test 3: Authorization - High Spending"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/authorize" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "type": "http_request",
      "details": {
        "method": "POST",
        "url": "https://api.stripe.com/v1/charges",
        "body": {
          "amount": 100000,
          "currency": "usd"
        }
      }
    }
  }')

status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ High spending check complete${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Request failed (HTTP $status_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 4: Get Policies
echo "Test 4: Get Policies"
response=$(curl -s -w "\n%{http_code}" "$API_URL/v1/policies" \
  -H "X-API-Key: $API_KEY")

status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ Policies endpoint working${NC}"
    echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Policies request failed (HTTP $status_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 5: Get Logs
echo "Test 5: Get Action Logs"
response=$(curl -s -w "\n%{http_code}" "$API_URL/v1/logs?limit=5" \
  -H "X-API-Key: $API_KEY")

status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ Logs endpoint working${NC}"
    echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Logs request failed (HTTP $status_code)${NC}"
    echo "Response: $body"
fi
echo ""

echo "🏁 Tests complete!"
