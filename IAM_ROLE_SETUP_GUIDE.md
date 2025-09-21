# 🚀 Step-by-Step IAM Role Setup for Flowid

## Overview
This guide walks you through creating an IAM role in your AWS account that Flowid can securely assume to access your AWS resources.

## 📋 Prerequisites
- AWS Console access with IAM permissions
- Your AWS Account ID (12-digit number)
- Basic understanding of IAM roles and policies

## 🎯 Step 1: Generate Your External ID
First, generate a unique External ID for security:

```bash
# Generate a secure random External ID (save this!)
openssl rand -hex 16
# Example output: a1b2c3d4e5f6789012345678901234ab
```

**⚠️ Important:** Save this External ID - you'll need it in Flowid later!

## 🔧 Step 2: Create the IAM Role via AWS Console

### 2.1 Navigate to IAM
1. Open AWS Console → Search "IAM" → Click "IAM"
2. In left sidebar, click "Roles"
3. Click "Create role"

### 2.2 Configure Trust Relationship
1. **Select trusted entity type:** "AWS account"
2. **Account ID:** Enter `123456789012` (This will be Flowid's account - replace with actual Flowid account ID)
3. **Options:** Check "Require external ID"
4. **External ID:** Enter the External ID you generated in Step 1
5. Click "Next"

### 2.3 Attach Permissions Policies
For initial setup, attach these managed policies:
- `CloudWatchLogsReadOnlyAccess`
- `AmazonDynamoDBReadOnlyAccess` 
- `AmazonS3ReadOnlyAccess`
- `AWSLambdaReadOnlyAccess`

**Note:** You can create more restrictive custom policies later.

### 2.4 Name and Create Role
1. **Role name:** `FlowIdCrossAccountRole`
2. **Description:** "Cross-account role for Flowid AWS debugging automation"
3. Click "Create role"

## 🔒 Step 3: Create Custom Trust Policy (Advanced)

For production use, replace the trust policy with this more secure version:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::FLOWID-ACCOUNT-ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR-EXTERNAL-ID-HERE"
        },
        "IpAddress": {
          "aws:SourceIp": ["FLOWID-SERVER-IP/32"]
        }
      }
    }
  ]
}
```

### To update the trust policy:
1. Go to your role → "Trust relationships" tab
2. Click "Edit trust policy"
3. Replace with the JSON above (update the placeholders)
4. Click "Update policy"

## 🎯 Step 4: Create Minimal Custom Permissions (Recommended)

Instead of broad read-only access, create specific policies:

### 4.1 CloudWatch Logs Policy
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
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/*",
        "arn:aws:logs:*:*:log-group:/aws/apigateway/*",
        "arn:aws:logs:*:*:log-group:YOUR-APP-LOGS*"
      ]
    }
  ]
}
```

### 4.2 DynamoDB Policy (Replace YOUR-TABLE-NAME)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:DescribeTable"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/YOUR-TABLE-NAME",
        "arn:aws:dynamodb:*:*:table/YOUR-TABLE-NAME/index/*"
      ]
    }
  ]
}
```

## 📝 Step 5: Gather Information for Flowid

After creating the role, collect this information:

1. **Role ARN:** Found in role summary (e.g., `arn:aws:iam::123456789012:role/FlowIdCrossAccountRole`)
2. **External ID:** The one you generated in Step 1
3. **AWS Region:** Your primary region (e.g., `us-east-1`)
4. **Account Name:** A friendly name for this account in Flowid

## 🧪 Step 6: Test the Role (Optional)

Test role assumption using AWS CLI:

```bash
# Test assuming the role
aws sts assume-role \
  --role-arn "arn:aws:iam::YOUR-ACCOUNT:role/FlowIdCrossAccountRole" \
  --role-session-name "FlowIdTest" \
  --external-id "YOUR-EXTERNAL-ID"

# If successful, you'll get temporary credentials
```

## 🔐 Step 7: Configure in Flowid

Now add your AWS account in Flowid:

1. Navigate to "AWS Accounts" in Flowid
2. Click "Add AWS Account"
3. Fill in the form:
   - **Account Name:** `Production AWS` (or your preferred name)
   - **IAM Role ARN:** `arn:aws:iam::123456789012:role/FlowIdCrossAccountRole`
   - **External ID:** Your generated External ID
   - **Default Region:** `us-east-1` (or your region)
4. Click "Add Account"
5. Test the connection using the "Test" button

## 🛡️ Security Best Practices

### ✅ Do's
- Use unique External IDs for each environment
- Regularly rotate External IDs (quarterly)
- Monitor CloudTrail for AssumeRole events
- Use least-privilege permissions
- Enable MFA for IAM role creation

### ❌ Don'ts  
- Don't use predictable External IDs
- Don't grant broader permissions than needed
- Don't share External IDs in plain text
- Don't use the same role for multiple applications

## 🔍 Troubleshooting

### Common Issues

**"Access Denied" when assuming role:**
- Check External ID matches exactly
- Verify role ARN is correct
- Ensure trust policy allows the correct principal

**"Role not found":**
- Verify role name and account ID
- Check if role exists in correct region

**"Invalid External ID":**
- External ID is case-sensitive
- Check for extra spaces or characters

### Verification Commands

```bash
# Check if role exists
aws iam get-role --role-name FlowIdCrossAccountRole

# List role policies
aws iam list-attached-role-policies --role-name FlowIdCrossAccountRole

# View trust policy
aws iam get-role --role-name FlowIdCrossAccountRole --query 'Role.AssumeRolePolicyDocument'
```

## 📞 Need Help?

- **AWS Documentation:** [IAM Roles for Cross-Account Access](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)
- **AWS Support:** Contact AWS Support for account-specific issues
- **Flowid Support:** Check the main documentation or GitHub issues

---

**🎉 Congratulations!** You've successfully set up secure cross-account access for Flowid. Your AWS resources can now be safely accessed through automated debugging workflows.
