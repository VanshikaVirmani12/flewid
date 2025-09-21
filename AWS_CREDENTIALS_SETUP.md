# 🔐 AWS Credentials Setup Guide

## Issue: "InvalidClientTokenId" Error

The error you're seeing means your AWS credentials are not configured or are invalid. Let's fix this step by step.

## 🎯 Step 1: Check Current AWS Configuration

```bash
# Check if AWS CLI is installed
aws --version

# Check current configuration (will show if credentials are set)
aws configure list

# Check if any credentials exist
ls ~/.aws/
```

## 🔧 Step 2: Get Your AWS Access Keys

You need to create AWS access keys from your AWS Console:

### **Option A: Create New IAM User (Recommended for Development)**

1. **Go to AWS Console** → Search "IAM" → Click "IAM"
2. **Click "Users"** in left sidebar → **"Create user"**
3. **User name:** `flowid-dev-user`
4. **Permissions:** Attach these policies directly:
   - `CloudWatchLogsReadOnlyAccess`
   - `AmazonDynamoDBReadOnlyAccess`
   - `AmazonS3ReadOnlyAccess`
   - `AWSLambdaReadOnlyAccess`
5. **Create user** → Click on the user → **"Security credentials"** tab
6. **Click "Create access key"** → Choose "Local code" → **Create**
7. **⚠️ IMPORTANT:** Copy the Access Key ID and Secret Access Key immediately!

### **Option B: Use Existing IAM User**

If you already have an IAM user:
1. Go to IAM → Users → Your user → Security credentials
2. Create new access key or use existing ones
3. Make sure the user has the required permissions listed above

## 🚀 Step 3: Configure AWS CLI

```bash
# Configure AWS CLI with your credentials
aws configure

# You'll be prompted for:
# AWS Access Key ID: [Enter your Access Key ID]
# AWS Secret Access Key: [Enter your Secret Access Key]
# Default region name: us-east-1 (or your preferred region)
# Default output format: json
```

## ✅ Step 4: Verify Setup

```bash
# Test your credentials
aws sts get-caller-identity

# Should return something like:
# {
#     "UserId": "AIDACKCEVSQ6C2EXAMPLE",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/flowid-dev-user"
# }
```

## 🔍 Troubleshooting Common Issues

### **"AWS CLI not found"**
```bash
# Install AWS CLI (macOS)
brew install awscli

# Install AWS CLI (Linux/Windows)
# Download from: https://aws.amazon.com/cli/
```

### **"Access Denied" after setup**
Your IAM user needs these minimum permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "s3:ListAllMyBuckets",
        "lambda:ListFunctions"
      ],
      "Resource": "*"
    }
  ]
}
```

### **"Credentials file not found"**
```bash
# Create AWS credentials directory
mkdir -p ~/.aws

# Manually create credentials file
cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
EOF

# Create config file
cat > ~/.aws/config << EOF
[default]
region = us-east-1
output = json
EOF
```

### **"Invalid security token"**
- Check if your access keys are correct
- Verify the IAM user exists and is active
- Make sure you copied the keys correctly (no extra spaces)
- Try creating new access keys

## 🔄 Alternative: Use AWS SSO (If Your Organization Uses It)

If your company uses AWS SSO:
```bash
# Configure SSO
aws configure sso

# Follow the prompts to set up SSO login
# Then use:
aws sso login
```

## 🚀 Once Credentials Are Working

After `aws sts get-caller-identity` works successfully:

1. **Start Flowid:**
   ```bash
   npm run dev
   ```

2. **Open:** http://localhost:3000

3. **Navigate to:** "AWS Accounts" → Add account with name "Local Development"

4. **Test connection** - should work now!

## 🔐 Security Best Practices

- **Never commit AWS credentials** to version control
- **Use least privilege** - only grant necessary permissions
- **Rotate access keys** regularly (every 90 days)
- **Delete unused access keys**
- **Monitor usage** in AWS CloudTrail

## 📞 Need Help?

If you're still having issues:
1. **Check AWS Console** - verify your account is active
2. **Contact AWS Support** - for account-specific issues
3. **Check company policies** - some organizations restrict API access

---

**Next:** Once your credentials work, come back and we'll test Flowid with your AWS account!
