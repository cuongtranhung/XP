#!/bin/bash
# Simple GPS Session Linking Test
# Tests if locations are properly linked to user sessions

BASE_URL="http://localhost:3000"
ADMIN_EMAIL="cuongtranhung@gmail.com"
ADMIN_PASSWORD="@Abcd6789"

echo "🧪 GPS Session Linking Test"
echo "============================"

# Login and get token/session
echo "📋 Step 1: Login and Get Session"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

echo "Login Response: $LOGIN_RESPONSE"
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_SESSION_ID=$(echo $LOGIN_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

echo "✅ Token: ${TOKEN:0:20}..."
echo "✅ User Session ID: $USER_SESSION_ID"

# Enable GPS module
echo ""
echo "📋 Step 2: Enable GPS Module"
curl -s -X POST "${BASE_URL}/api/gps-module/admin/enable" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason":"Session link test"}'

# Start GPS session
echo ""
echo "📋 Step 3: Start GPS Tracking Session"
SESSION_START=$(curl -s -X POST "${BASE_URL}/api/gps-module/location/session/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "deviceInfo": {
      "deviceId": "test-device-session-link",
      "platform": "Test"
    }
  }')

echo "Session Start Response: $SESSION_START"
GPS_SESSION_ID=$(echo $SESSION_START | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "✅ GPS Session ID: $GPS_SESSION_ID"

# Record location
echo ""
echo "📋 Step 4: Record Location"
LOCATION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/gps-module/location/record" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"sessionId\": \"$GPS_SESSION_ID\",
    \"latitude\": 21.0285,
    \"longitude\": 105.8542,
    \"accuracy\": 5.0,
    \"deviceId\": \"test-device-session-link\",
    \"networkType\": \"wifi\"
  }")

echo "Location Recording Response: $LOCATION_RESPONSE"

echo ""
echo "📋 Step 5: Database Verification"
echo "Expected User Session ID: $USER_SESSION_ID"
echo "Expected GPS Session ID: $GPS_SESSION_ID"
echo ""
echo "🎉 Test completed! Check database to verify session linkage."