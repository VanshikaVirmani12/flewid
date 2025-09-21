# 🚀 Local Development Setup for Flowid

## Quick Start Guide

This guide helps you run Flowid locally on your laptop/desktop using your existing AWS credentials.

## ✅ Prerequisites

1. **Node.js** (v18 or higher)
2. **AWS CLI** configured with your credentials
3. **Your AWS credentials** with appropriate permissions

## 🔧 Step 1: Verify AWS CLI Setup

Check if AWS CLI is configured:

```bash
# Check if AWS CLI is installed and configured
aws sts get-caller-identity

# Should return something like:
# {
#     "UserId": "AIDACKCEVSQ6C2EXAMPLE",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/YourUsername"
# }
```

If not configured, set it up:

```bash
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region (e.g., us-east-1)
# - Output format (json)
```

## 🎯 Step 2: Configure Flowid for Local Development

Create environment file for local development:

```bash
# Create backend environment file
cat > backend/.env << EOF
# Local Development Configuration
AWS_USE_LOCAL_CREDENTIALS=true
AWS_REGION=us-east-1
NODE_ENV=development
PORT=5000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Encryption key (for development only)
ENCRYPTION_KEY=dev-key-change-in-production-32chars
EOF
```

## 🚀 Step 3: Install Dependencies & Start

```bash
# Install all dependencies
npm install

# Start both frontend and backend
npm run dev
```

This will start:
- **Backend:** http://localhost:5000
- **Frontend:** http://localhost:3000

## 🔐 Step 4: Required AWS Permissions

Your AWS user/role needs these permissions to use Flowid:

### Minimal Permissions Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:StartQuery",
        "logs:StopQuery",
        "logs:DescribeQueries",
        "logs:GetQueryResults"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions"
      ],
      "Resource": "*"
    }
  ]
}
```

### How to Add Permissions

1. Go to AWS Console → IAM → Users
2. Find your user → Permissions tab
3. Click "Add permissions" → "Attach existing policies directly"
4. Create a custom policy with the JSON above, or attach these managed policies:
   - `CloudWatchLogsReadOnlyAccess`
   - `AmazonDynamoDBReadOnlyAccess`
   - `AmazonS3ReadOnlyAccess`
   - `AWSLambdaReadOnlyAccess`

## 🧪 Step 5: Test the Setup

1. **Open Flowid:** http://localhost:3000
2. **Navigate to:** "AWS Accounts" in the top menu
3. **Add Local Account:**
   - Account Name: `Local Development`
   - Leave other fields empty (they're not needed for local development)
4. **Test Connection:** Click the "Test" button

## 🔍 Troubleshooting

### Common Issues

**"AWS credentials not found"**
```bash
# Check AWS configuration
aws configure list
aws sts get-caller-identity
```

**"Access Denied" errors**
- Check if your AWS user has the required permissions
- Verify the resource ARNs in your policies

**Port conflicts**
```bash
# Kill processes on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different ports
PORT=5001 npm run dev
```

**"Cannot connect to AWS"**
- Check internet connection
- Verify AWS region is correct
- Check if AWS services are accessible from your network

## 📊 What You Can Do

With local development setup, you can:

✅ **Query CloudWatch Logs** - Search Lambda, API Gateway logs
✅ **Access DynamoDB** - Query tables and items  
✅ **Browse S3 Objects** - Download and inspect files
✅ **Invoke Lambda Functions** - Test function calls
✅ **Create Workflows** - Build debugging automation
✅ **Real-time Execution** - See results as they happen

## 🔄 Development Workflow

1. **Create Workflow:** Use the visual builder to create debugging workflows
2. **Add AWS Nodes:** Drag CloudWatch, DynamoDB, S3, Lambda nodes
3. **Configure Nodes:** Set up queries, table names, function names
4. **Execute Workflow:** Run and see real-time results
5. **Debug Issues:** Use the execution panel to troubleshoot

## 🚀 Next Steps

Once you're comfortable with local development:

1. **Create Custom Workflows** for your specific debugging needs
2. **Save Reusable Playbooks** for common issues
3. **Consider Production Deployment** when ready
4. **Share Workflows** with your team

## 💡 Pro Tips

- **Use specific resource names** in your workflows for better performance
- **Start with simple workflows** and build complexity gradually
- **Save successful workflows** as templates for future use
- **Monitor AWS costs** when running queries on large datasets

---

**🎉 You're Ready!** Flowid is now running locally and connected to your AWS account. Start building your first debugging workflow!
