# AWS Security Integration Guide for Flowid

## 🔐 Security-First AWS Integration

This guide outlines the secure methods to connect Flowid to your AWS account, following AWS security best practices and the principle of least privilege.

## 🎯 Recommended Security Approaches

### 1. **IAM Roles with Cross-Account Access (Recommended for Production)**

**Best for:** Production environments, enterprise deployments

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::FLOWID-ACCOUNT:role/FlowIdExecutionRole"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "unique-external-id-12345"
        },
        "IpAddress": {
          "aws:SourceIp": ["YOUR-FLOWID-SERVER-IP/32"]
        }
      }
    }
  ]
}
```

### 2. **IAM User with Temporary Credentials (Development)**

**Best for:** Development, testing, small teams

- Create dedicated IAM user for Flowid
- Use AWS STS to generate temporary credentials
- Rotate credentials regularly (every 1-4 hours)

### 3. **AWS SSO Integration (Enterprise)**

**Best for:** Large organizations with existing AWS SSO

- Integrate with corporate identity provider
- Use SAML/OIDC for authentication
- Leverage existing access controls

## 🛡️ Required IAM Permissions

### Minimal CloudWatch Permissions
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
        "arn:aws:logs:*:*:log-group:/aws/apigateway/*"
      ]
    }
  ]
}
```

### Minimal DynamoDB Permissions
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
        "arn:aws:dynamodb:*:*:table/YourTableName",
        "arn:aws:dynamodb:*:*:table/YourTableName/index/*"
      ]
    }
  ]
}
```

### Minimal S3 Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-logs-bucket",
        "arn:aws:s3:::your-logs-bucket/*"
      ],
      "Condition": {
        "StringLike": {
          "s3:prefix": ["logs/*", "debug/*"]
        }
      }
    }
  ]
}
```

### Minimal Lambda Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:debug-*",
        "arn:aws:lambda:*:*:function:test-*"
      ]
    }
  ]
}
```

## 🔒 Security Implementation Features

### 1. **Credential Encryption**
- All AWS credentials encrypted at rest using AES-256
- Credentials encrypted in transit using TLS 1.3
- Use AWS KMS for key management

### 2. **Access Controls**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) support
- Session timeout and automatic logout

### 3. **Audit Logging**
- All AWS API calls logged with CloudTrail
- User actions tracked and auditable
- Real-time security monitoring

### 4. **Network Security**
- VPC deployment with private subnets
- Security groups with minimal access
- WAF protection for web interface

## 🚀 Implementation Steps

### Step 1: Create IAM Role in Your AWS Account
```bash
# Create the trust policy
aws iam create-role \
  --role-name FlowIdDebugRole \
  --assume-role-policy-document file://trust-policy.json

# Attach minimal permissions
aws iam attach-role-policy \
  --role-name FlowIdDebugRole \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Create custom policy for specific resources
aws iam create-policy \
  --policy-name FlowIdMinimalAccess \
  --policy-document file://minimal-permissions.json
```

### Step 2: Configure Flowid Backend
```typescript
// Environment variables
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/FlowIdDebugRole
AWS_EXTERNAL_ID=unique-external-id-12345
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Step 3: Test Connection
```bash
# Test AWS connectivity
npm run test:aws-connection

# Verify permissions
npm run verify:aws-permissions
```

## 🔍 Security Monitoring

### CloudTrail Events to Monitor
- `AssumeRole` events from Flowid
- Unusual API call patterns
- Failed authentication attempts
- Cross-region API calls

### Alerts to Configure
- Multiple failed login attempts
- API calls from unexpected IP addresses
- Privilege escalation attempts
- Unusual data access patterns

## 🛠️ Troubleshooting

### Common Issues
1. **Access Denied**: Check IAM permissions and resource ARNs
2. **Credential Expiry**: Implement automatic credential refresh
3. **Network Issues**: Verify security groups and NACLs
4. **Rate Limiting**: Implement exponential backoff

### Security Checklist
- [ ] Minimal IAM permissions configured
- [ ] Credentials encrypted at rest and in transit
- [ ] MFA enabled for admin accounts
- [ ] CloudTrail logging enabled
- [ ] Security groups properly configured
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

## 📞 Support

For security-related questions or incidents:
- Review AWS Security Best Practices
- Contact AWS Support for account-specific guidance
- Implement AWS Config for compliance monitoring
