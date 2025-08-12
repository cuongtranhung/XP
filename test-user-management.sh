#!/bin/bash

# Login and get token
echo "Logging in..."
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"@Abcd6789"}' \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

echo "Token obtained"

# Test User Management endpoints
echo -e "\n=== Testing User Management API ==="

echo -e "\n1. GET /api/user-management/users"
curl -X GET http://localhost:5000/api/user-management/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -s | python3 -m json.tool | head -30

echo -e "\n2. GET /api/user-management/groups"
curl -X GET http://localhost:5000/api/user-management/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -s | python3 -m json.tool | head -30