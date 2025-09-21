# 🚀 Flowid Deployment Options & AWS Integration

## Overview
You have several options for deploying Flowid, each with different AWS integration approaches. Here are the main deployment scenarios:

## 📋 Deployment Scenarios

### 1. **Self-Hosted in Your Own AWS Account (Recommended)**
Deploy Flowid directly in your AWS account where your resources are located.

**Pros:**
- No cross-account setup needed
- Simplest security model
- Direct access to your resources
- Full control over the deployment

**AWS Integration:**
- Use IAM roles attached to EC2/ECS/Lambda
- No External ID required
- Direct resource access within the same account

**Setup Steps:**
1. Deploy Flowid to EC2, ECS, or Lambda in your AWS account
2. Create an IAM role with required permissions
3. Attach the role to your Flowid deployment
4. Configure Flowid to use the attached role

### 2. **Self-Hosted Outside AWS (Local/Other Cloud)**
Run Flowid on your local machine, on-premises, or another cloud provider.

**Pros:**
- Keep Flowid separate from AWS infrastructure
- Good for development and testing
- No AWS hosting costs for Flowid itself

**AWS Integration:**
- Requires cross-account style setup (even within same account)
- Use IAM user with access keys OR
- Use IAM role with External ID for security

**Setup Steps:**
1. Create IAM user with programmatic access OR IAM role
2. Configure AWS credentials in Flowid
3. Use the current setup we've built

### 3. **Multi-Account Enterprise Setup**
Deploy Flowid in a dedicated "tools" AWS account to manage multiple production accounts.

**Pros:**
- Centralized debugging platform
- Manage multiple AWS accounts from one place
- Better separation of concerns
- Enterprise-grade security

**AWS Integration:**
- Cross-account IAM roles (what we built)
- Each target account trusts the Flowid account
- External IDs for security

### 4. **SaaS/Hosted Service**
If Flowid were offered as a hosted service (like Datadog).

**AWS Integration:**
- Cross-account roles with External IDs
- Service provider's AWS account assumes roles in your account

## 🎯 Recommended Approach for You

Based on your question, here are the best options:

### **Option A: Deploy in Your AWS Account (Simplest)**

```bash
# Deploy to EC2 with IAM role
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.medium \
  --iam-instance-profile Name=FlowIdInstanceProfile \
  --user-data file://install-flowid.sh
```

**IAM Role Policy (same account):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:FilterLogEvents",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "s3:GetObject",
        "lambda:InvokeFunction"
      ],
      "Resource": "*"
    }
  ]
}
```

### **Option B: Local Development with AWS Access**

For development/testing, you can run Flowid locally and still access your AWS account:

```bash
# Configure AWS CLI with your credentials
aws configure

# Or use temporary credentials
aws sts get-session-token
```

**Update backend/.env:**
```env
# Use local AWS credentials (no cross-account needed)
AWS_REGION=us-east-1
AWS_USE_LOCAL_CREDENTIALS=true
```

## 🔧 Updated Implementation for Same-Account Deployment

Let me update the AWS credential service to support both scenarios:

### Local AWS Credentials (Same Account)
```typescript
// Use default AWS credential chain
const credentials = new AWS.Config.credentials || 
  AWS.config.credentials ||
  new AWS.EC2MetadataCredentials() ||
  new AWS.SharedIniFileCredentials()
```

### Cross-Account Role Assumption
```typescript
// Use the existing implementation with External ID
const assumedRole = await sts.assumeRole({
  RoleArn: account.roleArn,
  RoleSessionName: 'FlowIdSession',
  ExternalId: account.externalId
}).promise()
```

## 📝 Quick Start Options

### **For Local Development:**
1. Install AWS CLI: `aws configure`
2. Set environment variable: `AWS_USE_LOCAL_CREDENTIALS=true`
3. Run Flowid locally: `npm run dev`
4. Access your AWS resources directly

### **For AWS Deployment:**
1. Create EC2 instance with IAM role
2. Deploy Flowid application
3. Configure to use instance role
4. No External ID needed

### **For Cross-Account Setup:**
1. Follow the existing IAM_ROLE_SETUP_GUIDE.md
2. Use External ID for security
3. Configure cross-account trust relationships

## 🔐 Security Considerations by Deployment Type

| Deployment | Security Model | Complexity | Best For |
|------------|---------------|------------|----------|
| Same Account | IAM Role/User | Low | Development, Single Account |
| Cross-Account | External ID + Role | Medium | Enterprise, Multi-Account |
| Local Dev | AWS CLI Credentials | Low | Development, Testing |
| Multi-Account | Federated Access | High | Enterprise, Compliance |

## 🚀 Next Steps

**Choose your deployment approach:**

1. **Quick Start (Local):** Use your existing AWS credentials
2. **Production (Same Account):** Deploy to EC2 with IAM role  
3. **Enterprise (Cross-Account):** Follow the cross-account setup guide

Would you like me to update the implementation to support local AWS credentials for easier development?
