import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AWSService } from '../services/AWSService'
import { AWSCredentialService } from '../services/AWSCredentialService'

const router = Router()
const awsService = new AWSService()
const credentialService = new AWSCredentialService()

// GET /api/aws/health - AWS service health check
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    localMode: process.env.AWS_USE_LOCAL_CREDENTIALS === 'true',
    region: process.env.AWS_REGION || 'us-east-1',
    timestamp: new Date().toISOString()
  })
}))

// POST /api/aws/cloudwatch/query - Query CloudWatch logs
router.post('/cloudwatch/query', asyncHandler(async (req, res) => {
  const result = await awsService.queryCloudWatchLogs(req.body)
  res.json(result)
}))

// GET /api/aws/cloudwatch/log-groups - List available log groups
router.get('/cloudwatch/log-groups', asyncHandler(async (req, res) => {
  const result = await awsService.listLogGroups()
  res.json(result)
}))

// POST /api/aws/dynamodb/query - Query DynamoDB
router.post('/dynamodb/query', asyncHandler(async (req, res) => {
  const result = await awsService.queryDynamoDB(req.body)
  res.json(result)
}))

// POST /api/aws/s3/list - List S3 objects
router.post('/s3/list', asyncHandler(async (req, res) => {
  const result = await awsService.listS3Objects(req.body)
  res.json(result)
}))

// POST /api/aws/s3/get - Get S3 object
router.post('/s3/get', asyncHandler(async (req, res) => {
  const result = await awsService.getS3Object(req.body)
  res.json(result)
}))

// POST /api/aws/s3/explore - Explore S3 location (folder or object)
router.post('/s3/explore', asyncHandler(async (req, res) => {
  const result = await awsService.exploreS3Location(req.body)
  res.json(result)
}))

// GET /api/aws/lambda/functions - List Lambda functions
router.get('/lambda/functions', asyncHandler(async (req, res) => {
  const { accountId, functionName, maxItems } = req.query
  const result = await awsService.listLambdaFunctions({
    accountId: accountId as string || 'dev-account-1',
    functionName: functionName as string,
    maxItems: maxItems ? parseInt(maxItems as string) : undefined
  })
  res.json(result)
}))

// POST /api/aws/lambda/functions/list - List Lambda functions (POST version for complex queries)
router.post('/lambda/functions/list', asyncHandler(async (req, res) => {
  const result = await awsService.listLambdaFunctions(req.body)
  res.json(result)
}))

// POST /api/aws/lambda/function/get - Get Lambda function details
router.post('/lambda/function/get', asyncHandler(async (req, res) => {
  const result = await awsService.getLambdaFunction(req.body)
  res.json(result)
}))

// POST /api/aws/lambda/invoke - Invoke Lambda function
router.post('/lambda/invoke', asyncHandler(async (req, res) => {
  const result = await awsService.invokeLambda(req.body)
  res.json(result)
}))

// POST /api/aws/lambda/update-code - Update Lambda function code from S3
router.post('/lambda/update-code', asyncHandler(async (req, res) => {
  const result = await awsService.updateLambdaCodeFromS3(req.body)
  res.json(result)
}))

// POST /api/aws/lambda/publish-version - Publish Lambda function version
router.post('/lambda/publish-version', asyncHandler(async (req, res) => {
  const result = await awsService.publishLambdaVersion(req.body)
  res.json(result)
}))

// POST /api/aws/lambda/versions - List Lambda function versions
router.post('/lambda/versions', asyncHandler(async (req, res) => {
  const result = await awsService.listLambdaVersions(req.body)
  res.json(result)
}))

// GET /api/aws/regions - Get available AWS regions
router.get('/regions', asyncHandler(async (req, res) => {
  const regions = await awsService.getAvailableRegions()
  res.json(regions)
}))

// POST /api/aws/emr/clusters - Handle EMR operations
router.post('/emr/clusters', asyncHandler(async (req, res) => {
  const { operation, ...params } = req.body
  
  let result
  switch (operation) {
    case 'listClusters':
      result = await awsService.listEMRClusters(params)
      break
    case 'describeCluster':
      result = await awsService.describeEMRCluster(params)
      break
    case 'addStep':
      result = await awsService.addEMRSteps(params)
      break
    case 'getYarnApplications':
      result = await awsService.getEMRYarnApplications(params)
      break
    case 'getYarnApplicationDetails':
      result = await awsService.getEMRYarnApplicationDetails(params)
      break
    default:
      return res.status(400).json({
        success: false,
        message: `Unknown EMR operation: ${operation}`
      })
  }
  
  res.json(result)
}))

// POST /api/aws/emr/cluster/describe - Describe EMR cluster
router.post('/emr/cluster/describe', asyncHandler(async (req, res) => {
  const result = await awsService.describeEMRCluster(req.body)
  res.json(result)
}))

// POST /api/aws/emr/steps/add - Add steps to EMR cluster
router.post('/emr/steps/add', asyncHandler(async (req, res) => {
  const result = await awsService.addEMRSteps(req.body)
  res.json(result)
}))

// POST /api/aws/emr/steps/list - List EMR steps
router.post('/emr/steps/list', asyncHandler(async (req, res) => {
  const result = await awsService.listEMRSteps(req.body)
  res.json(result)
}))

// GET /api/aws/credentials/status - Check credential status
router.get('/credentials/status', asyncHandler(async (req, res) => {
  const status = await credentialService.checkCredentialStatus()
  res.json(status)
}))

// POST /api/aws/credentials/clear-cache - Clear credential cache
router.post('/credentials/clear-cache', asyncHandler(async (req, res) => {
  const { accountId } = req.body
  credentialService.clearCredentialsCache(accountId)
  res.json({
    success: true,
    message: accountId ? `Cleared cache for account ${accountId}` : 'Cleared all cached credentials'
  })
}))

// POST /api/aws/credentials/validate - Validate current credentials
router.post('/credentials/validate', asyncHandler(async (req, res) => {
  try {
    const credentials = await credentialService.getLocalCredentials()
    const isValid = await credentialService.validateCredentials(credentials)
    
    res.json({
      success: true,
      isValid,
      message: isValid ? 'Credentials are valid' : 'Credentials are invalid or expired'
    })
  } catch (error: any) {
    res.status(401).json({
      success: false,
      isValid: false,
      error: error.message
    })
  }
}))

export default router
