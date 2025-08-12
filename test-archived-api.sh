#!/bin/bash

echo "🧪 Testing Archived Forms API"
echo "=============================="

# Get JWT Token
echo "📝 Generating JWT token..."
TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 2, email: 'cuongtranhung@gmail.com', fullName: 'Trần Hùng Cường', role: 'admin' },
  'your-super-secure-256-bit-secret-key-change-in-production-12345678901234567890',
  { expiresIn: '1h' }
);
console.log(token);
")

echo "✅ Token generated"

# Test All Forms (non-archived)
echo -e "\n🟢 Testing ALL forms (should show active forms):"
curl -s -X GET "http://localhost:5000/api/forms?status=all" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"name":"[^"]*"' | head -5

# Test Draft Forms
echo -e "\n🟠 Testing DRAFT forms:"
curl -s -X GET "http://localhost:5000/api/forms?status=draft" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"name":"[^"]*"' | head -3

# Test Published Forms  
echo -e "\n🟦 Testing PUBLISHED forms:"
curl -s -X GET "http://localhost:5000/api/forms?status=published" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"name":"[^"]*"' | head -3

# Test Archived Forms (the main fix)
echo -e "\n🗑️ Testing ARCHIVED forms (the fix):"
ARCHIVED_RESULT=$(curl -s -X GET "http://localhost:5000/api/forms?status=archived" \
  -H "Authorization: Bearer $TOKEN")

echo "$ARCHIVED_RESULT" | grep -o '"name":"[^"]*"' | head -5
echo -e "\nTotal archived forms:"
echo "$ARCHIVED_RESULT" | grep -o '"total":[0-9]*'

echo -e "\n✅ API test completed!"
echo -e "\n💡 Now test in browser: http://localhost:3000/forms"
echo "   Select 'Archived' in the status dropdown"