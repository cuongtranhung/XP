#!/bin/bash

echo "========================================"
echo "        FINAL FORM SAVE TEST"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="http://localhost:5000/api"

echo -e "${BLUE}1. Login to get authentication token${NC}"
echo "----------------------------------------"

# Login first
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"test123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

echo -e "${BLUE}2. Get list of forms${NC}"
echo "----------------------------------------"

FORMS_RESPONSE=$(curl -s -X GET "$API_URL/forms" \
  -H "Authorization: Bearer $TOKEN")

echo "Forms response (first 200 chars):"
echo "${FORMS_RESPONSE:0:200}..."
echo ""

# Extract first form ID using a more robust method
FORM_ID=$(echo $FORMS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FORM_ID" ]; then
  echo -e "${YELLOW}⚠️  No existing forms found. Creating a test form...${NC}"
  
  CREATE_RESPONSE=$(curl -s -X POST "$API_URL/forms" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Form for Save",
      "description": "Testing form save functionality",
      "category": "test",
      "tags": ["test"],
      "fields": [
        {
          "fieldKey": "test_field",
          "fieldType": "text",
          "label": "Test Field",
          "position": 0,
          "required": false
        }
      ]
    }')
  
  FORM_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$FORM_ID" ]; then
    echo -e "${RED}❌ Failed to create test form!${NC}"
    echo "Response: $CREATE_RESPONSE"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Test form created!${NC}"
  echo "Form ID: $FORM_ID"
fi

echo ""
echo -e "${BLUE}3. Testing UPDATE form (the problematic 400 error)${NC}"
echo "----------------------------------------"

# Update the form
UPDATE_PAYLOAD='{
  "name": "Updated Test Form",
  "description": "Updated description at '"$(date +%H:%M:%S)"'",
  "fields": [
    {
      "fieldKey": "field1",
      "fieldType": "text",
      "label": "Updated Field 1",
      "position": 0,
      "required": false
    },
    {
      "fieldKey": "field2",
      "fieldType": "number",
      "label": "New Field 2",
      "position": 1,
      "required": true
    }
  ]
}'

echo "Sending UPDATE request to: $API_URL/forms/$FORM_ID"
echo "Payload:"
echo "$UPDATE_PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_PAYLOAD"
echo ""

# Make the update request with verbose output
UPDATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "$API_URL/forms/$FORM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD")

# Extract HTTP status code
HTTP_STATUS=$(echo "$UPDATE_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
RESPONSE_BODY=$(echo "$UPDATE_RESPONSE" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response body:"
echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ FORM UPDATE SUCCESSFUL!${NC}"
  echo ""
  echo -e "${GREEN}The 400 Bad Request error has been FIXED!${NC}"
  echo ""
  
  # Verify the update
  echo -e "${BLUE}4. Verifying the update${NC}"
  echo "----------------------------------------"
  
  GET_RESPONSE=$(curl -s -X GET "$API_URL/forms/$FORM_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Updated form details:"
  echo "$GET_RESPONSE" | python3 -m json.tool 2>/dev/null | head -30
  
elif [ "$HTTP_STATUS" = "400" ]; then
  echo -e "${RED}❌ STILL GETTING 400 BAD REQUEST ERROR!${NC}"
  echo ""
  echo "Error details:"
  echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
  echo ""
  echo -e "${YELLOW}Check backend logs for more details:${NC}"
  echo "tail -50 /mnt/c/Users/Admin/source/repos/XP/backend/backend.log"
  
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${RED}❌ Authentication failed!${NC}"
  echo "Token might be invalid or expired."
  
elif [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${RED}❌ Permission denied!${NC}"
  echo "You don't have permission to update this form."
  
elif [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${RED}❌ Form not found!${NC}"
  echo "Form ID: $FORM_ID does not exist."
  
else
  echo -e "${RED}❌ Unexpected error!${NC}"
  echo "HTTP Status: $HTTP_STATUS"
  echo "Response: $RESPONSE_BODY"
fi

echo ""
echo "========================================"
echo "        TEST COMPLETED"
echo "========================================"