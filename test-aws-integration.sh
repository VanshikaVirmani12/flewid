#!/bin/bash

# 🧪 AWS Integration Test Script for Flewid
# This script tests if your application is properly connected to your AWS account

echo "🚀 Starting AWS Integration Tests for Flewid..."
echo "================================================"

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

echo -e "${BLUE}Phase 1: AWS CLI Configuration${NC}"
echo "----------------------------------------"

# Test 1: AWS CLI installed
echo -n "Testing AWS CLI installation... "
if command -v aws &> /dev/null; then
    print_result 0 "AWS CLI is installed ($(aws --version))"
else
    print_result 1 "AWS CLI is not installed"
fi

# Test 2: AWS credentials configured
echo -n "Testing AWS credentials... "
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null)
    print_result 0 "AWS credentials are valid (Account: $ACCOUNT_ID)"
    echo -e "   ${YELLOW}User:${NC} $USER_ARN"
else
    print_result 1 "AWS credentials are not configured or invalid"
    echo -e "   ${YELLOW}Fix:${NC} Run 'aws configure' to set up your credentials"
fi

# Test 3: AWS region configured
echo -n "Testing AWS region configuration... "
REGION=$(aws configure get region 2>/dev/null)
if [ ! -z "$REGION" ]; then
    print_result 0 "AWS region is configured ($REGION)"
else
    print_result 1 "AWS region is not configured"
    echo -e "   ${YELLOW}Fix:${NC} Run 'aws configure set region us-east-1'"
fi

echo ""
echo -e "${BLUE}Phase 2: AWS Permissions Test${NC}"
echo "----------------------------------------"

# Test 4: CloudWatch Logs permissions
echo -n "Testing CloudWatch Logs permissions... "
if aws logs describe-log-groups --limit 1 &> /dev/null; then
    LOG_GROUP_COUNT=$(aws logs describe-log-groups --query 'length(logGroups)' --output text 2>/dev/null)
    print_result 0 "CloudWatch Logs access granted ($LOG_GROUP_COUNT log groups found)"
else
    print_result 1 "CloudWatch Logs access denied"
fi

# Test 5: S3 permissions
echo -n "Testing S3 permissions... "
if aws s3 ls &> /dev/null; then
    BUCKET_COUNT=$(aws s3 ls | wc -l)
    print_result 0 "S3 access granted ($BUCKET_COUNT buckets found)"
else
    print_result 1 "S3 access denied"
fi

# Test 6: DynamoDB permissions
echo -n "Testing DynamoDB permissions... "
if aws dynamodb list-tables &> /dev/null; then
    TABLE_COUNT=$(aws dynamodb list-tables --query 'length(TableNames)' --output text 2>/dev/null)
    print_result 0 "DynamoDB access granted ($TABLE_COUNT tables found)"
else
    print_result 1 "DynamoDB access denied"
fi

# Test 7: Lambda permissions
echo -n "Testing Lambda permissions... "
if aws lambda list-functions --max-items 1 &> /dev/null; then
    FUNCTION_COUNT=$(aws lambda list-functions --query 'length(Functions)' --output text 2>/dev/null)
    print_result 0 "Lambda access granted ($FUNCTION_COUNT functions found)"
else
    print_result 1 "Lambda access denied"
fi

echo ""
echo -e "${BLUE}Phase 3: Application Backend Test${NC}"
echo "----------------------------------------"

# Check if backend is running
echo -n "Testing if backend is running... "
if curl -s http://localhost:5000/api/health &> /dev/null; then
    print_result 0 "Backend is running on port 5000"
    
    # Test AWS health endpoint
    echo -n "Testing AWS health endpoint... "
    if curl -s http://localhost:5000/api/aws/health &> /dev/null; then
        print_result 0 "AWS health endpoint is accessible"
    else
        print_result 1 "AWS health endpoint is not accessible"
    fi
    
else
    print_result 1 "Backend is not running on port 5000"
    echo -e "   ${YELLOW}Fix:${NC} Run 'npm run dev' to start the application"
fi

echo ""
echo -e "${BLUE}Phase 4: Frontend Test${NC}"
echo "----------------------------------------"

# Check if frontend is running
echo -n "Testing if frontend is running... "
if curl -s http://localhost:3000 &> /dev/null; then
    print_result 0 "Frontend is running on port 3000"
else
    print_result 1 "Frontend is not running on port 3000"
    echo -e "   ${YELLOW}Fix:${NC} Run 'npm run dev' to start the application"
fi

echo ""
echo -e "${BLUE}Test Summary${NC}"
echo "============"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Your AWS integration is working correctly.${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Open http://localhost:3000 in your browser"
    echo "2. Navigate to the Workflow Builder"
    echo "3. Create a workflow with CloudWatch nodes"
    echo "4. Test with your actual AWS resources"
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please fix the issues above before proceeding.${NC}"
    echo ""
    echo -e "${YELLOW}Common Fixes:${NC}"
    echo "• Run 'aws configure' to set up credentials"
    echo "• Add required IAM policies to your user"
    echo "• Run 'npm run dev' to start the application"
fi

echo ""
echo "📖 For detailed testing instructions, see: aws-integration-test-plan.md"
