#\!/bin/bash

# Get form list to find a form with fields
echo "Testing form fields loading..."

# First login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xpapp.local","password":"Admin@123456"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to login"
  exit 1
fi

echo "✓ Logged in successfully"

# Get form list
echo ""
echo "Getting forms list..."
FORMS=$(curl -s -X GET http://localhost:5000/api/forms \
  -H "Authorization: Bearer $TOKEN")

# Extract first form ID
FORM_ID=$(echo $FORMS | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FORM_ID" ]; then
  echo "No forms found"
  exit 1
fi

echo "Found form ID: $FORM_ID"

# Get specific form details
echo ""
echo "Getting form details with fields..."
FORM_DETAILS=$(curl -s -X GET "http://localhost:5000/api/forms/$FORM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Form response:"
echo "$FORM_DETAILS" | python3 -m json.tool | head -100

# Check if fields exist
if echo "$FORM_DETAILS" | grep -q '"fields"'; then
  FIELD_COUNT=$(echo "$FORM_DETAILS" | grep -o '"fieldKey"' | wc -l)
  echo ""
  echo "✓ Form has $FIELD_COUNT fields"
else
  echo ""
  echo "✗ No fields found in form response"
fi
