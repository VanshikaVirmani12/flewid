# API Gateway IAM Permissions for Flowid

## 🚨 Issue Identified
The current AWS user `flewid-dev-user` lacks API Gateway permissions. The error shows:
```
User: arn:aws:iam::038462790558:user/flewid-dev-user is not authorized to perform: apigateway:GET on resource: arn:aws:apigateway:us-east-1::/restapis
```

## 🔧 Required API Gateway Permissions

Add this policy to your IAM user or role to enable API Gateway functionality:

### Minimal API Gateway Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE",
        "apigateway:PATCH"
      ],
      "Resource": [
        "arn:aws:apigateway:*::/restapis",
        "arn:aws:apigateway:*::/restapis/*",
        "arn:aws:apigateway:*::/apis",
        "arn:aws:apigateway:*::/apis/*"
      ]
    }
  ]
}
```

### Read-Only API Gateway Policy (Recommended for Flowid)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET"
      ],
      "Resource": [
        "arn:aws:apigateway:*::/restapis",
        "arn:aws:apigateway:*::/restapis/*/stages",
        "arn:aws:apigateway:*::/restapis/*/stages/*",
        "arn:aws:apigateway:*::/restapis/*/resources",
        "arn:aws:apigateway:*::/restapis/*/resources/*",
        "arn:aws:apigateway:*::/apis",
        "arn:aws:apigateway:*::/apis/*/stages",
        "arn:aws:apigateway:*::/apis/*/stages/*"
      ]
    }
  ]
}
```

## 🚀 How to Apply These Permissions

### Option 1: AWS Console (Recommended)
1. Go to AWS Console → IAM → Users
2. Find user `flewid-dev-user`
3. Click "Add permissions" → "Attach policies directly"
4. Click "Create policy"
5. Paste the JSON policy above
6. Name it `FlowIdAPIGatewayAccess`
7. Attach to the user

### Option 2: AWS CLI
```bash
# Create the policy
aws iam create-policy \
  --policy-name FlowIdAPIGatewayAccess \
  --policy-document file://api-gateway-policy.json

# Attach to user
aws iam attach-user-policy \
  --user-name flewid-dev-user \
  --policy-arn arn:aws:iam::038462790558:policy/FlowIdAPIGatewayAccess
```

### Option 3: Add to Existing Policy
If you have an existing policy attached to the user, add these permissions to it:
```json
{
  "Effect": "Allow",
  "Action": [
    "apigateway:GET"
  ],
  "Resource": [
    "arn:aws:apigateway:*::/restapis",
    "arn:aws:apigateway:*::/restapis/*",
    "arn:aws:apigateway:*::/apis",
    "arn:aws:apigateway:*::/apis/*"
  ]
}
```

## 🧪 Test After Adding Permissions

Once you've added the permissions, test the API Gateway functionality:

```bash
# Test listing APIs
curl -X POST http://localhost:5001/api/aws/apigateway/apis \
  -H "Content-Type: application/json" \
  -d '{"accountId": "dev-account-1", "limit": 10}'

# Should return your API Gateway APIs instead of permission error
```

## 📋 Complete IAM Policy for Flowid

Here's a comprehensive policy that includes all services Flowid needs:

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
        "s3:ListBucket",
        "s3:ListAllMyBuckets"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:GetFunctionConfiguration",
        "lambda:ListVersionsByFunction"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "emr:ListClusters",
        "emr:DescribeCluster",
        "emr:ListSteps",
        "emr:DescribeStep"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET"
      ],
      "Resource": [
        "arn:aws:apigateway:*::/restapis",
        "arn:aws:apigateway:*::/restapis/*",
        "arn:aws:apigateway:*::/apis",
        "arn:aws:apigateway:*::/apis/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:DescribeAlarmHistory",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

## ✅ Verification Steps

After adding permissions:

1. **Test API Gateway List**: Should return your APIs
2. **Test API Gateway Stages**: Should return stages for a specific API
3. **Test API Gateway Analysis**: Should work with proper log group access

## 🔒 Security Notes

- These permissions are read-only and safe for debugging
- Consider using resource-specific ARNs in production
- Monitor CloudTrail for API Gateway access patterns
- Rotate credentials regularly

## 📞 Next Steps

1. Add the API Gateway permissions to your IAM user/role
2. Test the API Gateway endpoints
3. Verify the frontend can load and display your APIs
4. Configure API Gateway access logging if needed for analysis features
