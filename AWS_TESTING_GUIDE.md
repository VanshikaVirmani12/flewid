# 🧪 AWS Integration Testing Guide

## Quick Test Steps

Follow these steps to verify Flowid can fetch data from your AWS account:

## 🚀 Step 1: Start the Application

```bash
# Make sure both frontend and backend are running
npm run dev

# Access at: http://localhost:3000
```

## 📝 Step 2: Add Your AWS Account

1. **Navigate to**: http://localhost:3000/accounts
2. **Click**: "Add AWS Account"
3. **Fill in** (Local Development Mode):
   - Account Name: `Test Account`
   - Default Region: `us-east-1` (or your region)
4. **Click**: "Add Account"
5. **Click**: "Test" button to verify connection

## 🔍 Step 3: Test AWS Service Access

### **Test 1: CloudWatch Logs**
```bash
# Test CloudWatch access via API
curl -X POST http://localhost:5000/api/aws/cloudwatch/query \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "YOUR_ACCOUNT_ID",
    "logGroupName": "/aws/lambda/",
    "query": "fields @timestamp, @message | limit 10",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-12-31T23:59:59Z"
  }'
```

### **Test 2: DynamoDB Tables**
```bash
# List DynamoDB tables
curl -X GET "http://localhost:5000/api/aws/dynamodb/tables?accountId=YOUR_ACCOUNT_ID"
```

### **Test 3: S3 Buckets**
```bash
# List S3 buckets
curl -X GET "http://localhost:5000/api/aws/s3/buckets?accountId=YOUR_ACCOUNT_ID"
```

### **Test 4: Lambda Functions**
```bash
# List Lambda functions
curl -X GET "http://localhost:5000/api/aws/lambda/functions?accountId=YOUR_ACCOUNT_ID"
```

## 🎯 Step 4: Visual Testing via UI

### **Method 1: Use the Workflow Builder**
1. **Go to**: http://localhost:3000/builder
2. **Drag** a CloudWatch node from the sidebar
3. **Configure** the node with:
   - Log Group: `/aws/lambda/` (or any log group you have)
   - Query: `fields @timestamp, @message | limit 5`
4. **Click**: "Execute" to test

### **Method 2: Test Individual Services**

#### **CloudWatch Logs Test**
1. Navigate to Workflow Builder
2. Add CloudWatch node
3. Set Log Group to one you know exists (e.g., `/aws/lambda/your-function-name`)
4. Use query: `fields @timestamp, @message | limit 10`
5. Execute and check results

#### **DynamoDB Test**
1. Add DynamoDB node
2. Set table name to an existing table
3. Use a simple query like: `{"id": {"S": "test"}}`
4. Execute to see if it connects

#### **S3 Test**
1. Add S3 node  
2. Set bucket name to an existing bucket
3. Set object key to an existing file
4. Execute to test file access

#### **Lambda Test**
1. Add Lambda node
2. Set function name to an existing function
3. Provide test payload: `{"test": "data"}`
4. Execute to test function invocation

## 🔧 Step 5: Debug Common Issues

### **Issue: "No log groups found"**
```bash
# Check if you have CloudWatch log groups
aws logs describe-log-groups --region us-east-1

# If empty, create a test log group
aws logs create-log-group --log-group-name /test/flowid --region us-east-1
```

### **Issue: "No DynamoDB tables"**
```bash
# List your DynamoDB tables
aws dynamodb list-tables --region us-east-1

# Create a test table if needed
aws dynamodb create-table \
  --table-name FlowIdTest \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### **Issue: "No S3 buckets"**
```bash
# List your S3 buckets
aws s3 ls

# Create a test bucket if needed (replace with unique name)
aws s3 mb s3://flowid-test-bucket-$(date +%s) --region us-east-1
```

### **Issue: "No Lambda functions"**
```bash
# List your Lambda functions
aws lambda list-functions --region us-east-1
```

## 📊 Step 6: Expected Results

### **Successful CloudWatch Test**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "@timestamp": "2024-01-01T12:00:00.000Z",
        "@message": "Sample log message"
      }
    ]
  }
}
```

### **Successful DynamoDB Test**
```json
{
  "success": true,
  "data": {
    "tables": [
      "YourTableName1",
      "YourTableName2"
    ]
  }
}
```

### **Successful S3 Test**
```json
{
  "success": true,
  "data": {
    "buckets": [
      "your-bucket-name-1",
      "your-bucket-name-2"
    ]
  }
}
```

### **Successful Lambda Test**
```json
{
  "success": true,
  "data": {
    "functions": [
      "your-function-name-1",
      "your-function-name-2"
    ]
  }
}
```

## ⚠️ Troubleshooting

### **Error: "Access Denied"**
- **Cause**: Your IAM user lacks required permissions
- **Fix**: Add the required policies from `AWS_CREDENTIALS_SETUP.md`

### **Error: "Region not found"**
- **Cause**: Wrong region specified
- **Fix**: Check your AWS region with `aws configure get region`

### **Error: "Credentials not found"**
- **Cause**: AWS CLI not configured
- **Fix**: Run `aws configure` and set up your credentials

### **Error: "Connection timeout"**
- **Cause**: Network or AWS service issues
- **Fix**: Check internet connection and AWS service status

## 🎯 Quick Verification Commands

```bash
# 1. Test AWS CLI access
aws sts get-caller-identity

# 2. Test backend health
curl http://localhost:5000/api/health

# 3. Test frontend access
curl http://localhost:3000

# 4. Test AWS service endpoints
curl http://localhost:5000/api/aws/health
```

## � Success Indicators

✅ **AWS CLI works**: `aws sts get-caller-identity` returns your account info  
✅ **Backend running**: Health endpoint returns `{"status": "ok", "localMode": true}`  
✅ **Frontend accessible**: Can open http://localhost:3000
✅ **Account added**: Can add AWS account without errors  
✅ **Connection test passes**: "Test" button shows success  
✅ **Service calls work**: API endpoints return data (not errors)  
✅ **Workflow execution**: Can create and run simple workflows  

## 🚀 Next Steps After Successful Testing

1. **Create your first debugging workflow**
2. **Test with real AWS resources** (Lambda functions, DynamoDB tables)
3. **Build reusable playbooks** for common debugging scenarios
4. **Explore advanced features** like conditional logic and data transformation

---

**🎉 Once all tests pass, you're ready to use Flowid for AWS debugging automation!**
