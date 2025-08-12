#!/bin/bash
# GPS Module API Test Script
# Tests GPS module endpoints and admin functionality

BASE_URL="http://localhost:3000"
ADMIN_EMAIL="cuongtranhung@gmail.com"
ADMIN_PASSWORD="@Abcd6789"

echo "🧪 GPS Module API Test Suite"
echo "=============================="

# Step 1: Login as admin user
echo "📋 Step 1: Admin Login"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

echo "Login Response: $LOGIN_RESPONSE"

# Extract token from response
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get admin token. Exiting..."
  exit 1
fi

echo "✅ Admin token obtained: ${TOKEN:0:20}..."

# Step 2: Check GPS module status
echo ""
echo "📋 Step 2: Check GPS Module Status"
STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/gps-module/admin/status" \
  -H "Authorization: Bearer $TOKEN")

echo "GPS Module Status: $STATUS_RESPONSE"

# Step 3: Enable GPS module
echo ""
echo "📋 Step 3: Enable GPS Module"
ENABLE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/gps-module/admin/enable" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason":"API test enable"}')

echo "Enable Response: $ENABLE_RESPONSE"

# Step 4: Check status after enable
echo ""
echo "📋 Step 4: Check Status After Enable"
STATUS_AFTER_ENABLE=$(curl -s -X GET "${BASE_URL}/api/gps-module/admin/status" \
  -H "Authorization: Bearer $TOKEN")

echo "Status After Enable: $STATUS_AFTER_ENABLE"

# Step 5: Test GPS health endpoint
echo ""
echo "📋 Step 5: Check GPS Health"
HEALTH_RESPONSE=$(curl -s -X GET "${BASE_URL}/health/gps")

echo "GPS Health: $HEALTH_RESPONSE"

# Step 6: Test location recording (should work now)
echo ""
echo "📋 Step 6: Test Location Recording"
LOCATION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/gps-module/location/record" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 21.0285,
    "longitude": 105.8542,
    "accuracy": 10.0,
    "altitude": 15.0,
    "speed": 0,
    "heading": 180,
    "batteryLevel": 85,
    "deviceId": "test-device-123",
    "networkType": "wifi"
  }')

echo "Location Recording: $LOCATION_RESPONSE"

# Step 7: Disable GPS module
echo ""
echo "📋 Step 7: Disable GPS Module"
DISABLE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/gps-module/admin/disable" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason":"API test disable"}')

echo "Disable Response: $DISABLE_RESPONSE"

# Step 8: Test location recording after disable (should fail)
echo ""
echo "📋 Step 8: Test Location Recording After Disable (Should Fail)"
LOCATION_DISABLED_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/gps-module/location/record" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 21.0285,
    "longitude": 105.8542,
    "accuracy": 10.0
  }')

echo "Location Recording After Disable: $LOCATION_DISABLED_RESPONSE"

echo ""
echo "🎉 GPS Module API test completed!"
echo "=================================="