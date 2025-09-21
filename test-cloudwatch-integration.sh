#!/bin/bash

# 🧪 CloudWatch Integration Test Script
# This script tests the enhanced CloudWatch functionality

echo "🔍 Testing CloudWatch Integration..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo -e "${BLUE}Step 1: Check if backend is running${NC}"
echo "----------------------------------------"

# Test backend health
echo -n "Testing backend health... "
if curl -s http://localhost:5000/api/health &> /dev/null; then
    print_result 0 "Backend is running"
else
    print_result 1 "Backend is not running (run 'npm run dev' first)"
    exit 1
fi

# Test AWS health endpoint
echo -n "Testing AWS health endpoint... "
if curl -s http://localhost:5000/api/aws/health &> /dev/null; then
    AWS_HEALTH=$(curl -s http://localhost:5000/api/aws/health)
    print_result 0 "AWS health endpoint accessible"
    echo -e "   ${YELLOW}Response:${NC} $AWS_HEALTH"
else
    print_result 1 "AWS health endpoint not accessible"
fi

echo ""
echo -e "${BLUE}Step 2: Test CloudWatch API Endpoint${NC}"
echo "----------------------------------------"

# Test CloudWatch query endpoint with a test log group
echo -n "Testing CloudWatch query endpoint... "

# Create test payload (using macOS compatible date commands)
START_TIME=$(($(date +%s) - 3600))  # 1 hour ago
END_TIME=$(date +%s)

TEST_PAYLOAD='{
  "accountId": "dev-account-1",
  "logGroup": "/test/nonexistent",
  "filterPattern": "ERROR",
  "startTime": '${START_TIME}'000,
  "endTime": '${END_TIME}'000
}'

# Test the endpoint
RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:5000/api/aws/cloudwatch/query \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

HTTP_CODE="${RESPONSE: -3}"
RESPONSE_BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    print_result 0 "CloudWatch endpoint responds correctly (HTTP $HTTP_CODE)"
    echo -e "   ${YELLOW}Response:${NC} ${RESPONSE_BODY:0:100}..."
else
    print_result 1 "CloudWatch endpoint error (HTTP $HTTP_CODE)"
    echo -e "   ${YELLOW}Response:${NC} $RESPONSE_BODY"
fi

echo ""
echo -e "${BLUE}Step 3: Test with Real Log Group (if available)${NC}"
echo "----------------------------------------"

# Try to find a real log group
echo -n "Looking for available log groups... "
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    LOG_GROUPS=$(aws logs describe-log-groups --limit 3 --query 'logGroups[*].logGroupName' --output text 2>/dev/null)
    
    if [ ! -z "$LOG_GROUPS" ]; then
        print_result 0 "Found log groups"
        echo -e "   ${YELLOW}Available:${NC} $LOG_GROUPS"
        
        # Test with first available log group
        FIRST_LOG_GROUP=$(echo $LOG_GROUPS | awk '{print $1}')
        echo -n "Testing with real log group ($FIRST_LOG_GROUP)... "
        
        # Calculate timestamps for macOS compatibility
        REAL_START_TIME=$(($(date +%s) - 86400))  # 24 hours ago
        REAL_END_TIME=$(date +%s)
        
        REAL_PAYLOAD='{
          "accountId": "dev-account-1",
          "logGroup": "'$FIRST_LOG_GROUP'",
          "filterPattern": "INFO",
          "startTime": '${REAL_START_TIME}'000,
          "endTime": '${REAL_END_TIME}'000
        }'
        
        REAL_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:5000/api/aws/cloudwatch/query \
          -H "Content-Type: application/json" \
          -d "$REAL_PAYLOAD")
        
        REAL_HTTP_CODE="${REAL_RESPONSE: -3}"
        REAL_RESPONSE_BODY="${REAL_RESPONSE%???}"
        
        if [ "$REAL_HTTP_CODE" = "200" ]; then
            print_result 0 "Real CloudWatch query successful"
            
            # Parse and display results
            EVENTS_COUNT=$(echo "$REAL_RESPONSE_BODY" | grep -o '"events":\[.*\]' | grep -o '\[.*\]' | grep -o ',' | wc -l)
            EVENTS_COUNT=$((EVENTS_COUNT + 1))
            echo -e "   ${YELLOW}Events found:${NC} $EVENTS_COUNT"
        else
            print_result 1 "Real CloudWatch query failed (HTTP $REAL_HTTP_CODE)"
            echo -e "   ${YELLOW}Error:${NC} ${REAL_RESPONSE_BODY:0:100}..."
        fi
    else
        print_result 1 "No log groups found in AWS account"
    fi
else
    print_result 1 "AWS CLI not configured or credentials invalid"
fi

echo ""
echo -e "${BLUE}Step 4: Frontend Integration Test${NC}"
echo "----------------------------------------"

# Test if frontend is running
echo -n "Testing if frontend is accessible... "
if curl -s http://localhost:3000 &> /dev/null; then
    print_result 0 "Frontend is accessible at http://localhost:3000"
    echo -e "   ${YELLOW}Next:${NC} Open http://localhost:3000 and test CloudWatch node manually"
else
    print_result 1 "Frontend is not accessible (run 'npm run dev' first)"
fi

echo ""
echo -e "${BLUE}Test Summary${NC}"
echo "============"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! CloudWatch integration is working.${NC}"
    echo ""
    echo -e "${YELLOW}Manual Testing Steps:${NC}"
    echo "1. Open http://localhost:3000 in your browser"
    echo "2. Go to Workflow Builder"
    echo "3. Drag a CloudWatch node to the canvas"
    echo "4. Click the settings icon on the CloudWatch node"
    echo "5. Configure:"
    echo "   - Log Group: /aws/lambda/your-function (or any existing log group)"
    echo "   - Keyword: ERROR (or any search term)"
    echo "   - Time Range: Select a recent time range"
    echo "6. Click 'Execute Query' button on the node"
    echo "7. Check the Execution Results panel for output"
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please fix the issues above.${NC}"
fi

echo ""
echo "📖 For more details, see: aws-integration-test-plan.md"
