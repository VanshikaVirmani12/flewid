import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AWSService } from '../services/AWSService'

const router = Router()
const awsService = new AWSService()

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

// POST /api/aws/lambda/invoke - Invoke Lambda function
router.post('/lambda/invoke', asyncHandler(async (req, res) => {
  const result = await awsService.invokeLambda(req.body)
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

export default router
