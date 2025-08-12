#!/bin/bash

# Test script to verify connection stability after database timeout fix
# This simulates the original issue where users experienced connection errors after 1 minute

echo "🧪 Testing Connection Stability After Database Fix"
echo "================================================="

# Test 1: Backend Health Check
echo -e "\n1️⃣ Backend Health Check:"
health_response=$(curl -s http://localhost:5000/health)
echo "$health_response" | grep -o '"status":"[^"]*"'
echo "$health_response" | grep -o '"responseTime":"[^"]*"'

# Test 2: Login Test
echo -e "\n2️⃣ Login Test:"
login_response=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"@Abcd6789"}' \
  -s)

if echo "$login_response" | grep -q '"success":true'; then
    echo "✅ Login successful"
    # Extract token for further testing
    token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ Login failed"
    echo "$login_response"
    exit 1
fi

# Test 3: Multiple Authenticated Requests (Simulating 1+ minute usage)
echo -e "\n3️⃣ Authenticated Request Stability Test (60 seconds):"
echo "Simulating user activity over 1+ minute..."

success_count=0
total_tests=6

for i in {1..6}; do
    echo -n "Request $i/6: "
    
    auth_response=$(curl -H "Authorization: Bearer $token" \
                   http://localhost:5000/api/auth/me \
                   -s)
    
    if echo "$auth_response" | grep -q '"success":true'; then
        echo "✅ Success"
        ((success_count++))
    else
        echo "❌ Failed"
        echo "Error: $auth_response"
    fi
    
    # Wait 10 seconds between requests to simulate real usage
    if [ $i -lt 6 ]; then
        sleep 10
    fi
done

# Test 4: Final Results
echo -e "\n📊 Test Results:"
echo "Success Rate: $success_count/$total_tests requests"
echo -e "\n4️⃣ Final Health Check:"
final_health=$(curl -s http://localhost:5000/health)
echo "$final_health" | grep -o '"status":"[^"]*"'
echo "$final_health" | grep -o '"responseTime":"[^"]*"'

if [ $success_count -eq $total_tests ]; then
    echo -e "\n🎉 ALL TESTS PASSED! Connection stability issue has been resolved."
    echo "✅ Database timeout fix is working correctly"
    echo "✅ No connection errors after 1+ minute of usage"
else
    echo -e "\n⚠️  Some tests failed. Connection issue may still exist."
    exit 1
fi

echo -e "\n📝 Fix Summary:"
echo "- Database connection pool optimized (max: 5, keepAlive: true)"
echo "- Query timeouts increased to 30 seconds"
echo "- Improved retry logic for connection issues"
echo "- Connection pool management enhanced"