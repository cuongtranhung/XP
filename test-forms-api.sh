#!/bin/bash

echo "🧪 Testing Forms API with authentication..."
echo ""

# Test login first
echo "1. Testing login API..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cuongtranhung@gmail.com",
    "password": "123456"
  }')

echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  exit 1
fi

echo "✅ Got authentication token"
echo ""

# Test Forms API with token
echo "2. Testing Forms API with authentication..."
FORMS_RESPONSE=$(curl -s -X GET "http://localhost:5000/api/forms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Forms API Response:"
echo "$FORMS_RESPONSE"
echo ""

# Check if response contains success
if echo "$FORMS_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Forms API working correctly"
else
  echo "❌ Forms API returned error"
fi

echo ""
echo "🔍 Backend server status:"
curl -s "http://localhost:5000/health" | head -10