import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AWSService } from '../services/AWSService'

const router = Router()
const awsService = new AWSService()

// POST /api/aws/cloudwatch/query - Query CloudWatch logs
router.post('/cloudwatch/query', asyncHandler(async (req, res) => {
  const result = await awsService.queryCloudWatchLogs(req.body)
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

export default router
