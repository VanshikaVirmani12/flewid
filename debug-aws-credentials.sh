#!/bin/bash

echo "🔍 AWS Credentials Diagnostic Script"
echo "===================================="
echo ""

echo "1. Checking AWS CLI installation..."
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI is installed: $(aws --version)"
else
    echo "❌ AWS CLI is not installed"
    echo "   Install with: brew install awscli (macOS) or download from https://aws.amazon.com/cli/"
    exit 1
fi
echo ""

echo "2. Checking AWS configuration..."
echo "Current AWS configuration:"
aws configure list
echo ""

echo "3. Checking AWS credentials file..."
if [ -f ~/.aws/credentials ]; then
    echo "✅ Credentials file exists at ~/.aws/credentials"
    echo "File contents (keys hidden for security):"
    sed 's/aws_access_key_id = .*/aws_access_key_id = [HIDDEN]/' ~/.aws/credentials | sed 's/aws_secret_access_key = .*/aws_secret_access_key = [HIDDEN]/'
else
    echo "❌ No credentials file found at ~/.aws/credentials"
fi
echo ""

echo "4. Checking AWS config file..."
if [ -f ~/.aws/config ]; then
    echo "✅ Config file exists at ~/.aws/config"
    echo "File contents:"
    cat ~/.aws/config
else
    echo "❌ No config file found at ~/.aws/config"
fi
echo ""

echo "5. Checking environment variables..."
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    echo "✅ AWS_ACCESS_KEY_ID environment variable is set"
else
    echo "ℹ️  AWS_ACCESS_KEY_ID environment variable is not set"
fi

if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "✅ AWS_SECRET_ACCESS_KEY environment variable is set"
else
    echo "ℹ️  AWS_SECRET_ACCESS_KEY environment variable is not set"
fi

if [ -n "$AWS_SESSION_TOKEN" ]; then
    echo "⚠️  AWS_SESSION_TOKEN environment variable is set (this might be causing issues if it's expired)"
else
    echo "ℹ️  AWS_SESSION_TOKEN environment variable is not set"
fi
echo ""

echo "6. Testing AWS credentials..."
echo "Attempting to call AWS STS GetCallerIdentity..."
aws sts get-caller-identity 2>&1
echo ""

echo "🔧 Troubleshooting Suggestions:"
echo "==============================="
echo ""
echo "If you see 'InvalidClientTokenId' error:"
echo "1. Check if your access keys are correct (no extra spaces/characters)"
echo "2. Verify the IAM user exists and is active in AWS Console"
echo "3. Make sure the access keys haven't been deleted or rotated"
echo "4. Clear any expired session tokens: unset AWS_SESSION_TOKEN"
echo "5. Try creating new access keys for your IAM user"
echo ""
echo "If you see 'AccessDenied' error:"
echo "1. Your credentials work, but the IAM user needs more permissions"
echo "2. Add the 'sts:GetCallerIdentity' permission to your IAM user"
echo ""
echo "If you see 'CredentialsNotFound' error:"
echo "1. Run 'aws configure' to set up your credentials"
echo "2. Make sure you have valid AWS access keys"
echo ""
