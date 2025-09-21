import { Router } from 'express'
import { AWSCredentialService } from '../services/AWSCredentialService'
import { AWSService } from '../services/AWSService'
import { logger } from '../utils/logger'

const router = Router()
const credentialService = new AWSCredentialService()
const awsService = new AWSService()

/**
 * Test AWS connectivity and permissions
 */
router.get('/aws-connectivity', async (req, res) => {
  try {
    logger.info('Testing AWS connectivity...')
    
    const results = {
      timestamp: new Date().toISOString(),
      awsCredentials: false,
      cloudWatchAccess: false,
      dynamoDBAccess: false,
      s3Access: false,
      lambdaAccess: false,
      errors: [] as string[]
    }

    // Test 1: AWS Credentials
    try {
      if (credentialService.shouldUseLocalCredentials()) {
        const credentials = await credentialService.getLocalCredentials()
        const isValid = await credentialService.validateCredentials(credentials)
        results.awsCredentials = isValid
        if (!isValid) {
          results.errors.push('AWS credentials validation failed')
        }
      } else {
        results.errors.push('Cross-account role assumption not tested in this endpoint')
      }
    } catch (error: any) {
      results.errors.push(`AWS Credentials: ${error.message}`)
    }

    // Test 2: CloudWatch Logs
    try {
      const { CloudWatchLogsClient, DescribeLogGroupsCommand } = await import('@aws-sdk/client-cloudwatch-logs')
      
      let client
      if (credentialService.shouldUseLocalCredentials()) {
        const credentials = await credentialService.getLocalCredentials()
        client = new CloudWatchLogsClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })
      } else {
        client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' })
      }

      const command = new DescribeLogGroupsCommand({ limit: 1 })
      await client.send(command)
      results.cloudWatchAccess = true
    } catch (error: any) {
      results.errors.push(`CloudWatch: ${error.message}`)
    }

    // Test 3: DynamoDB
    try {
      const { DynamoDBClient, ListTablesCommand } = await import('@aws-sdk/client-dynamodb')
      
      let client
      if (credentialService.shouldUseLocalCredentials()) {
        const credentials = await credentialService.getLocalCredentials()
        client = new DynamoDBClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })
      } else {
        client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
      }

      const command = new ListTablesCommand({ Limit: 1 })
      await client.send(command)
      results.dynamoDBAccess = true
    } catch (error: any) {
      results.errors.push(`DynamoDB: ${error.message}`)
    }

    // Test 4: S3
    try {
      const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3')
      
      let client
      if (credentialService.shouldUseLocalCredentials()) {
        const credentials = await credentialService.getLocalCredentials()
        client = new S3Client({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })
      } else {
        client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
      }

      const command = new ListBucketsCommand({})
      await client.send(command)
      results.s3Access = true
    } catch (error: any) {
      results.errors.push(`S3: ${error.message}`)
    }

    // Test 5: Lambda
    try {
      const { LambdaClient, ListFunctionsCommand } = await import('@aws-sdk/client-lambda')
      
      let client
      if (credentialService.shouldUseLocalCredentials()) {
        const credentials = await credentialService.getLocalCredentials()
        client = new LambdaClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })
      } else {
        client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' })
      }

      const command = new ListFunctionsCommand({ MaxItems: 1 })
      await client.send(command)
      results.lambdaAccess = true
    } catch (error: any) {
      results.errors.push(`Lambda: ${error.message}`)
    }

    // Calculate overall success
    const totalTests = 5
    const passedTests = [
      results.awsCredentials,
      results.cloudWatchAccess,
      results.dynamoDBAccess,
      results.s3Access,
      results.lambdaAccess
    ].filter(Boolean).length

    const overallSuccess = passedTests >= 3 // At least 3 out of 5 services working

    logger.info('AWS connectivity test completed', {
      passedTests,
      totalTests,
      overallSuccess,
      errors: results.errors
    })

    res.json({
      success: overallSuccess,
      summary: `${passedTests}/${totalTests} AWS services accessible`,
      details: results,
      recommendations: results.errors.length > 0 ? [
        'Check AWS credentials configuration',
        'Verify IAM permissions for failing services',
        'Ensure correct AWS region is configured',
        'Review AWS_TESTING_GUIDE.md for detailed troubleshooting'
      ] : [
        'All tests passed! Your AWS integration is working correctly.',
        'You can now create workflows using AWS services.',
        'Try the Workflow Builder to test real scenarios.'
      ]
    })

  } catch (error: any) {
    logger.error('AWS connectivity test failed', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to run AWS connectivity tests',
      message: error.message,
      recommendations: [
        'Check if AWS CLI is configured: aws sts get-caller-identity',
        'Verify backend environment variables are set',
        'Review AWS_CREDENTIALS_SETUP.md for setup instructions'
      ]
    })
  }
})

/**
 * Quick health check for AWS services
 */
router.get('/aws-quick', async (req, res) => {
  try {
    // Just test credentials and one service for quick feedback
    if (credentialService.shouldUseLocalCredentials()) {
      const credentials = await credentialService.getLocalCredentials()
      const isValid = await credentialService.validateCredentials(credentials)
      
      if (isValid) {
        res.json({
          success: true,
          message: 'AWS credentials are working',
          mode: 'local',
          region: credentials.region
        })
      } else {
        res.status(401).json({
          success: false,
          message: 'AWS credentials are invalid',
          recommendations: ['Run: aws sts get-caller-identity', 'Check AWS_CREDENTIALS_SETUP.md']
        })
      }
    } else {
      res.json({
        success: true,
        message: 'Cross-account mode configured',
        mode: 'cross-account'
      })
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'AWS quick test failed',
      error: error.message
    })
  }
})

export default router
