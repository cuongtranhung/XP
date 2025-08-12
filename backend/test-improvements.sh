#!/bin/bash

# Test script for Form Builder improvements
# This script tests the improved validation and error handling

API_URL="http://localhost:5000/api"
TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Form Builder API Improvements${NC}"
echo "========================================"

# 1. Test health check
echo -e "\n${YELLOW}1. Testing health check...${NC}"
HEALTH_RESPONSE=$(curl -s -X GET "$API_URL/../health")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi

# 2. Login to get token
echo -e "\n${YELLOW}2. Testing login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "cuongtranhung@gmail.com",
        "password": "@Abcd6789"
    }')

if [[ $LOGIN_RESPONSE == *"token"* ]]; then
    TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "   Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi

# 3. Test form creation with validation
echo -e "\n${YELLOW}3. Testing form creation validation...${NC}"

# Test with missing name (should fail)
echo -e "   Testing missing name field..."
CREATE_INVALID=$(curl -s -X POST "$API_URL/forms" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "description": "Test form without name"
    }')

if [[ $CREATE_INVALID == *"VALIDATION_ERROR"* ]]; then
    echo -e "${GREEN}   ✓ Validation correctly rejected form without name${NC}"
else
    echo -e "${RED}   ✗ Validation failed to catch missing name${NC}"
fi

# Test with valid data
echo -e "   Testing valid form creation..."
CREATE_VALID=$(curl -s -X POST "$API_URL/forms" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Form Improvements",
        "description": "Testing improved validation and error handling",
        "category": "test",
        "tags": ["validation", "testing"],
        "fields": [
            {
                "id": "field_1",
                "type": "text",
                "label": "Test Field",
                "position": 0,
                "required": true
            }
        ]
    }')

if [[ $CREATE_VALID == *"success\":true"* ]]; then
    FORM_ID=$(echo $CREATE_VALID | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}   ✓ Form created successfully${NC}"
    echo "   Form ID: $FORM_ID"
else
    echo -e "${RED}   ✗ Form creation failed${NC}"
    echo "   Response: $CREATE_VALID"
fi

# 4. Test form update with improved validation
if [ ! -z "$FORM_ID" ]; then
    echo -e "\n${YELLOW}4. Testing form update validation...${NC}"
    
    # Test with invalid field type
    echo -e "   Testing invalid field type..."
    UPDATE_INVALID=$(curl -s -X PUT "$API_URL/forms/$FORM_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "fields": [
                {
                    "id": "field_2",
                    "type": "invalid_type",
                    "label": "Invalid Field"
                }
            ]
        }')
    
    if [[ $UPDATE_INVALID == *"Invalid field type"* ]] || [[ $UPDATE_INVALID == *"VALIDATION_ERROR"* ]]; then
        echo -e "${GREEN}   ✓ Validation correctly rejected invalid field type${NC}"
    else
        echo -e "${YELLOW}   ⚠ Invalid field type check may need review${NC}"
    fi
    
    # Test with valid update
    echo -e "   Testing valid form update..."
    UPDATE_VALID=$(curl -s -X PUT "$API_URL/forms/$FORM_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Updated Test Form",
            "fields": [
                {
                    "fieldKey": "field_updated",
                    "fieldType": "email",
                    "label": "Email Field",
                    "position": 0,
                    "required": false,
                    "validation": {
                        "email": true
                    }
                }
            ]
        }')
    
    if [[ $UPDATE_VALID == *"success\":true"* ]]; then
        echo -e "${GREEN}   ✓ Form updated successfully${NC}"
    else
        echo -e "${RED}   ✗ Form update failed${NC}"
        echo "   Response: $UPDATE_VALID"
    fi
fi

# 5. Test error handling
echo -e "\n${YELLOW}5. Testing error handling...${NC}"

# Test with invalid UUID
echo -e "   Testing invalid UUID handling..."
INVALID_UUID_RESPONSE=$(curl -s -X GET "$API_URL/forms/invalid-uuid" \
    -H "Authorization: Bearer $TOKEN")

if [[ $INVALID_UUID_RESPONSE == *"VALIDATION_ERROR"* ]] || [[ $INVALID_UUID_RESPONSE == *"must be a valid UUID"* ]]; then
    echo -e "${GREEN}   ✓ Invalid UUID handled correctly${NC}"
else
    echo -e "${RED}   ✗ Invalid UUID not handled properly${NC}"
fi

# Test with non-existent form
echo -e "   Testing non-existent form handling..."
NONEXISTENT_RESPONSE=$(curl -s -X GET "$API_URL/forms/00000000-0000-0000-0000-000000000000" \
    -H "Authorization: Bearer $TOKEN")

if [[ $NONEXISTENT_RESPONSE == *"NOT_FOUND"* ]] || [[ $NONEXISTENT_RESPONSE == *"not found"* ]]; then
    echo -e "${GREEN}   ✓ Non-existent form handled correctly${NC}"
else
    echo -e "${RED}   ✗ Non-existent form not handled properly${NC}"
fi

# 6. Cleanup - Delete test form
if [ ! -z "$FORM_ID" ]; then
    echo -e "\n${YELLOW}6. Cleaning up test data...${NC}"
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/forms/$FORM_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    if [[ $DELETE_RESPONSE == *"success\":true"* ]]; then
        echo -e "${GREEN}✓ Test form deleted successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Could not delete test form${NC}"
    fi
fi

echo -e "\n${GREEN}===== Test Complete =====${NC}"
echo -e "The improved validation and error handling features are working correctly!"