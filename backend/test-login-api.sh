#!/bin/bash

echo "=== Login API Test Suite ==="
echo "Testing user: cuongtranhung@gmail.com"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Valid login
echo "Test 1: Valid credentials"
response=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"@Abcd6789"}')

if echo "$response" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASSED${NC}: Valid login successful"
  ((PASS_COUNT++))
  
  # Extract token for further tests
  token=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo "   Token received: ${token:0:20}..."
else
  echo -e "${RED}❌ FAILED${NC}: Valid login failed"
  echo "   Response: $response"
  ((FAIL_COUNT++))
fi
echo ""

# Test 2: Invalid password
echo "Test 2: Invalid password"
response=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"wrongpass"}')

if echo "$response" | grep -q '"success":false'; then
  echo -e "${GREEN}✅ PASSED${NC}: Invalid password rejected correctly"
  ((PASS_COUNT++))
else
  echo -e "${RED}❌ FAILED${NC}: Invalid password not handled correctly"
  echo "   Response: $response"
  ((FAIL_COUNT++))
fi
echo ""

# Test 3: Invalid email
echo "Test 3: Non-existent email"
response=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"@Abcd6789"}')

if echo "$response" | grep -q '"success":false'; then
  echo -e "${GREEN}✅ PASSED${NC}: Non-existent email rejected correctly"
  ((PASS_COUNT++))
else
  echo -e "${RED}❌ FAILED${NC}: Non-existent email not handled correctly"
  echo "   Response: $response"
  ((FAIL_COUNT++))
fi
echo ""

# Test 4: Missing email
echo "Test 4: Missing email field"
response=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"@Abcd6789"}')

status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"@Abcd6789"}')

if [ "$status_code" == "400" ]; then
  echo -e "${GREEN}✅ PASSED${NC}: Missing email handled correctly (400 Bad Request)"
  ((PASS_COUNT++))
else
  echo -e "${RED}❌ FAILED${NC}: Missing email not handled correctly (Status: $status_code)"
  ((FAIL_COUNT++))
fi
echo ""

# Test 5: Missing password
echo "Test 5: Missing password field"
response=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com"}')

status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com"}')

if [ "$status_code" == "400" ]; then
  echo -e "${GREEN}✅ PASSED${NC}: Missing password handled correctly (400 Bad Request)"
  ((PASS_COUNT++))
else
  echo -e "${RED}❌ FAILED${NC}: Missing password not handled correctly (Status: $status_code)"
  ((FAIL_COUNT++))
fi
echo ""

# Test 6: Test authenticated endpoint
echo "Test 6: Authenticated endpoint /api/auth/me"
if [ ! -z "$token" ]; then
  response=$(curl -s -X GET http://localhost:5000/api/auth/me \
    -H "Authorization: Bearer $token")
  
  if echo "$response" | grep -q '"email":"cuongtranhung@gmail.com"'; then
    echo -e "${GREEN}✅ PASSED${NC}: Authenticated endpoint working"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAILED${NC}: Authenticated endpoint failed"
    echo "   Response: $response"
    ((FAIL_COUNT++))
  fi
else
  echo -e "${RED}❌ SKIPPED${NC}: No token available from Test 1"
  ((FAIL_COUNT++))
fi
echo ""

# Summary
echo "=============================="
echo "Test Summary:"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
total=$((PASS_COUNT + FAIL_COUNT))
percentage=$((PASS_COUNT * 100 / total))
echo "Success Rate: ${percentage}%"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}All tests passed! ✅${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed ❌${NC}"
  exit 1
fi