#!/bin/bash

echo "🧪 Testing Profile Update Navigation via API..."

# Step 1: Login and get token
echo "🔐 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cuongtranhung@gmail.com",
    "password": "@Abcd6789"
  }')

echo "Login Response: $LOGIN_RESPONSE"

# Extract token from response
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token received"
  exit 1
fi

echo "✅ Login successful, token: ${TOKEN:0:20}..."

# Step 2: Get current user data
echo "📊 Step 2: Getting current user data..."
CURRENT_USER=$(curl -s -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN")

echo "Current User: $CURRENT_USER"

# Step 3: Update profile with DD/MM/YYYY format
echo "📝 Step 3: Updating profile..."
UPDATE_RESPONSE=$(curl -s -X PUT http://localhost:5000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fullName": "Trần Hùng Cường - Navigation Test",
    "dateOfBirth": "1990-12-25"
  }')

echo "Update Response: $UPDATE_RESPONSE"

# Step 4: Get updated user data to verify
echo "🔍 Step 4: Verifying updated data..."
UPDATED_USER=$(curl -s -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN")

echo "Updated User: $UPDATED_USER"

# Check if update was successful
if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Profile update successful via API"
  echo "🎯 Navigation would work if frontend calls this API correctly"
else
  echo "❌ Profile update failed"
fi

echo "🏁 API test completed"