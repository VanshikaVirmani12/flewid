# 🧪 AWS Integration Testing Plan for Flewid

## Current Setup Analysis

✅ **Application Configuration:**
- Backend configured for local AWS credentials (`AWS_USE_LOCAL_CREDENTIALS=true`)
- Region set to `us-east-1`
- Uses AWS SDK credential provider chain (environment variables, AWS CLI config, IAM roles)

✅ **AWS Services Supported:**
- CloudWatch Logs (fully implemented)
- DynamoDB (mock implementation)
- S3 (mock implementation) 
- Lambda (mock implementation)

## 🎯 Step-by-Step Testing Strategy

### Phase 1: Verify AWS CLI Configuration

First, ensure your AWS credentials are properly configured:

```bash
# 1. Check AWS CLI installation
aws --version

# 2. Verify your credentials work
aws sts get-caller-identity

# 3. Check your current region
aws configure get region

# 4. List some resources to test permissions
aws logs describe-log-groups --limit 5
aws s3 ls
aws dynamodb list-tables
aws lambda list-functions --max-items 5
```

**Expected Results:**
- `get-caller-identity` should return your account ID and user ARN
- Commands should return data (not access denied errors)

### Phase 2: Start the Application

```bash
# 1. Install dependencies (if not done)
npm install

# 2. Start both frontend and backend
npm run dev
```

**Expected Results:**
- Backend starts on http://localhost:5000
- Frontend starts on http://localhost:3000
- No credential-related errors in console

### Phase 3: Test Backend API Endpoints

Test the AWS integration through direct API calls:

```bash
# 1. Test backend health
curl http://localhost:5000/api/health

# 2. Test AWS health endpoint
curl http://localhost:5000/api/aws/health

# 3. Test CloudWatch logs (replace with actual log group)
curl -X POST http://localhost:5000/api/aws/cloudwatch/query \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "dev-account-1",
    "logGroup": "/aws/lambda/your-function-name",
    "startTime": 1640995200000,
    "endTime": 1672531200000
  }'

# 4. Test other services (currently mocked)
curl "http://localhost:5000/api/aws/dynamodb/tables?accountId=dev-account-1"
curl "http://localhost:5000/api/aws/s3/buckets?accountId=dev-account-1"
curl "http://localhost:5000/api/aws/lambda/functions?accountId=dev-account-1"
```

### Phase 4: Test Through Frontend UI

1. **Open Application:** http://localhost:3000

2. **Navigate to AWS Accounts:** 
   - Look for "AWS Accounts" or "Account Management" section
   - The app should show the pre-configured "Development Account"

3. **Test Connection:**
   - Click "Test" button next to the development account
   - Should show success message

4. **Test Workflow Builder:**
   - Go to Workflow Builder
   - Drag a CloudWatch node from sidebar
   - Configure with a real log group name
   - Execute the workflow

### Phase 5: Detailed CloudWatch Testing

Since CloudWatch is the only fully implemented service, test it thoroughly:

```bash
# 1. List your log groups
aws logs describe-log-groups --query 'logGroups[*].logGroupName' --output table

# 2. Test with a real log group (replace LOG_GROUP_NAME)
curl -X POST http://localhost:5000/api/aws/cloudwatch/query \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "dev-account-1",
    "logGroup": "/aws/lambda/YOUR_ACTUAL_LOG_GROUP",
    "filterPattern": "ERROR",
    "startTime": '$(date -d "1 day ago" +%s)'000',
    "endTime": '$(date +%s)'000'
  }'
```

## 🔍 Troubleshooting Common Issues

### Issue 1: "InvalidClientTokenId" Error
**Cause:** AWS credentials not configured
**Solution:** 
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region (us-east-1), format (json)
```

### Issue 2: "Access Denied" Errors
**Cause:** IAM user lacks required permissions
**Solution:** Add these policies to your IAM user:
- `CloudWatchLogsReadOnlyAccess`
- `AmazonDynamoDBReadOnlyAccess`
- `AmazonS3ReadOnlyAccess`
- `AWSLambdaReadOnlyAccess`

### Issue 3: "No log groups found"
**Cause:** No CloudWatch log groups in your account
**Solution:** Create a test log group:
```bash
aws logs create-log-group --log-group-name /test/flewid
aws logs put-log-events --log-group-name /test/flewid --log-stream-name test-stream --log-events timestamp=$(date +%s)000,message="Test log entry"
```

### Issue 4: Backend not connecting to AWS
**Cause:** Environment variables not loaded
**Solution:** Ensure backend/.env file exists and contains:
```
AWS_USE_LOCAL_CREDENTIALS=true
AWS_REGION=us-east-1
```

## ✅ Success Indicators

### Backend Integration Success:
- [ ] `aws sts get-caller-identity` returns your account info
- [ ] Backend starts without AWS credential errors
- [ ] `/api/aws/health` endpoint responds successfully
- [ ] CloudWatch API calls return real data (not errors)

### Frontend Integration Success:
- [ ] Application loads at http://localhost:3000
- [ ] AWS account shows as "connected" or "active"
- [ ] Can create workflows with AWS nodes
- [ ] CloudWatch node executes and returns real log data

### Full Integration Success:
- [ ] Can build a workflow with CloudWatch node
- [ ] Workflow executes successfully
- [ ] Returns actual log data from your AWS account
- [ ] No authentication or permission errors

## 🚀 Next Steps After Successful Testing

1. **Test with Real Resources:**
   - Use actual Lambda function names
   - Query real DynamoDB tables
   - Access real S3 buckets

2. **Implement Missing Services:**
   - Complete DynamoDB integration (currently mocked)
   - Complete S3 integration (currently mocked)
   - Complete Lambda integration (currently mocked)

3. **Build Real Workflows:**
   - Create debugging workflows for your actual AWS resources
   - Test error handling and edge cases
   - Build reusable workflow templates

## 🔐 Security Notes

- Your AWS credentials are used locally via AWS CLI configuration
- No credentials are stored in the application code
- The app uses AWS SDK's default credential provider chain
- All API calls are made with your IAM user's permissions

---

**Ready to test? Start with Phase 1 and work through each phase systematically!**
