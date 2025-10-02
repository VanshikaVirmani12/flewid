# AWS Credentials Refresh Guide

## The Problem
You're encountering an "ExpiredToken" error when calling AWS GetCallerIdentity operation. This means your AWS credentials have expired.

## Quick Solutions

### 1. If you're using AWS SSO (Single Sign-On)
```bash
aws sso login
```

### 2. If you're using AWS CLI with profiles
```bash
# Check your current configuration
aws configure list

# If using a specific profile
aws sso login --profile your-profile-name

# Or refresh default credentials
aws configure
```

### 3. If you're using temporary credentials (MFA/AssumeRole)
```bash
# Get new session token with MFA
aws sts get-session-token --serial-number arn:aws:iam::ACCOUNT:mfa/USERNAME --token-code 123456

# Then update your credentials file with the new temporary credentials
```

### 4. Check credential status via API
You can now use the new API endpoints to check your credential status:

```bash
# Check credential status
curl http://localhost:5001/api/aws/credentials/status

# Validate credentials
curl -X POST http://localhost:5001/api/aws/credentials/validate

# Clear credential cache if needed
curl -X POST http://localhost:5001/api/aws/credentials/clear-cache
```

## What I've Fixed

1. **Enhanced Error Handling**: Updated the `AWSCredentialService` to provide more specific error messages when credentials expire.

2. **Credential Validation**: Added automatic credential validation before using them.

3. **Better Caching**: Improved credential caching with validation checks.

4. **New API Endpoints**: Added endpoints to check credential status and clear cache.

5. **Detailed Logging**: Enhanced logging to help diagnose credential issues.

## Next Steps

1. **Refresh your AWS credentials** using one of the methods above
2. **Test the connection** by calling the credential status endpoint
3. **Try your AWS operations again**

## Common AWS Credential Locations

- **AWS SSO**: `~/.aws/sso/cache/`
- **AWS CLI**: `~/.aws/credentials` and `~/.aws/config`
- **Environment Variables**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`

## Troubleshooting

If you continue to have issues:

1. Check which credential provider is being used:
   ```bash
   aws configure list
   ```

2. Verify your AWS identity:
   ```bash
   aws sts get-caller-identity
   ```

3. Check the application logs for more detailed error messages.

4. Use the new credential validation endpoint to get specific error details.
