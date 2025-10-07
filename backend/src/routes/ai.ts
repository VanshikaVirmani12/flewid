import express from 'express'
import { BedrockTransformService } from '../services/ai/BedrockTransformService'
import { TransformService } from '../services/TransformService'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

const router = express.Router()
const bedrockService = new BedrockTransformService()
const transformService = new TransformService()

/**
 * Generate AI transformation suggestions
 * POST /api/ai/generate-transformation
 */
router.post('/generate-transformation', async (req, res, next) => {
  try {
    const { userIntent, sourceNodeType, targetNodeType, sampleData, workflowContext } = req.body

    // Validate required fields
    if (!userIntent || !sourceNodeType || !targetNodeType) {
      return res.status(400).json({
        error: 'Missing required fields: userIntent, sourceNodeType, targetNodeType'
      })
    }

    logger.info('AI transformation request', {
      userIntent: userIntent.substring(0, 100),
      sourceNodeType,
      targetNodeType,
      hasSampleData: !!sampleData
    })

    // Generate AI suggestions
    const suggestions = await bedrockService.generateTransformation({
      userIntent,
      sourceNodeType,
      targetNodeType,
      sampleData: sampleData || {},
      workflowContext
    })

    // Validate generated code
    const validatedSuggestions = suggestions.map(suggestion => {
      const validation = bedrockService.validateTransformationCode(suggestion.code)
      return {
        ...suggestion,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors
        }
      }
    })

    res.json({
      success: true,
      suggestions: validatedSuggestions,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'bedrock-claude',
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    })

  } catch (error: any) {
    logger.error('AI transformation generation failed', {
      error: error.message,
      stack: error.stack
    })
    next(createError(`AI transformation failed: ${error.message}`, 500))
  }
})

/**
 * Test AI transformation code
 * POST /api/ai/test-transformation
 */
router.post('/test-transformation', async (req, res, next) => {
  try {
    const { code, testData, scriptType = 'javascript' } = req.body

    if (!code || !testData) {
      return res.status(400).json({
        error: 'Missing required fields: code, testData'
      })
    }

    logger.info('Testing AI-generated transformation', {
      codeLength: code.length,
      scriptType
    })

    // Validate code first
    const validation = bedrockService.validateTransformationCode(code)
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Code validation failed',
        validationErrors: validation.errors
      })
    }

    // Execute transformation
    const result = await transformService.executeTransform({
      script: code,
      inputData: testData,
      scriptType: scriptType as 'javascript' | 'jsonpath' | 'regex'
    })

    res.json({
      success: true,
      result,
      validation,
      metadata: {
        executedAt: new Date().toISOString(),
        executionTime: Date.now()
      }
    })

  } catch (error: any) {
    logger.error('AI transformation test failed', {
      error: error.message
    })
    next(createError(`Transformation test failed: ${error.message}`, 400))
  }
})

/**
 * Get AI transformation examples
 * GET /api/ai/examples/:sourceType/:targetType
 */
router.get('/examples/:sourceType/:targetType', async (req, res, next) => {
  try {
    const { sourceType, targetType } = req.params

    logger.info('Fetching transformation examples', { sourceType, targetType })

    // Predefined examples for common transformations
    const examples = getTransformationExamples(sourceType, targetType)

    res.json({
      success: true,
      examples,
      sourceType,
      targetType
    })

  } catch (error: any) {
    logger.error('Failed to fetch examples', { error: error.message })
    next(createError(`Failed to fetch examples: ${error.message}`, 500))
  }
})

/**
 * Get AI service health status
 * GET /api/ai/health
 */
router.get('/health', async (req, res, next) => {
  try {
    // Test Bedrock connectivity with a simple request
    const testSuggestions = await bedrockService.generateTransformation({
      userIntent: 'Test connectivity',
      sourceNodeType: 'sqs',
      targetNodeType: 'cloudwatch',
      sampleData: { messages: [] }
    })

    res.json({
      success: true,
      status: 'healthy',
      service: 'bedrock',
      timestamp: new Date().toISOString(),
      testResult: testSuggestions.length > 0
    })

  } catch (error: any) {
    logger.error('AI service health check failed', { error: error.message })
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      service: 'bedrock',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * Get predefined transformation examples
 */
function getTransformationExamples(sourceType: string, targetType: string): any[] {
  const key = `${sourceType.toLowerCase()}_to_${targetType.toLowerCase()}`
  
  const exampleLibrary: Record<string, any[]> = {
    sqs_to_cloudwatch: [
      {
        title: 'Error Count Metrics',
        description: 'Extract error messages and create CloudWatch metrics',
        userIntent: 'Count error messages and create CloudWatch metrics',
        code: `const messages = data.messages || []
const errorMessages = filterArray(messages, 'body contains "ERROR"')
const errorsByType = groupBy(errorMessages.map(msg => {
  const body = parseJSON(msg.body) || {}
  return { errorType: body.errorType || 'unknown' }
}), 'errorType')

return {
  customMetrics: Object.keys(errorsByType).map(type => ({
    MetricName: 'ApplicationErrors',
    Value: errorsByType[type].length,
    Unit: 'Count',
    Dimensions: [{ Name: 'ErrorType', Value: type }]
  }))
}`
      },
      {
        title: 'Message Volume Tracking',
        description: 'Track message volume and processing rates',
        userIntent: 'Track message volume and processing rates for monitoring',
        code: `const messages = data.messages || []
const messagesByHour = groupBy(messages.map(msg => ({
  hour: formatDate(msg.attributes?.SentTimestamp || Date.now(), 'iso').substring(0, 13)
})), 'hour')

return {
  customMetrics: [{
    MetricName: 'MessageVolume',
    Value: messages.length,
    Unit: 'Count',
    Dimensions: [{ Name: 'Queue', Value: 'application-events' }]
  }],
  hourlyBreakdown: messagesByHour
}`
      }
    ],
    
    cloudwatch_to_dynamodb: [
      {
        title: 'User Activity Tracking',
        description: 'Extract user activities from logs and store in DynamoDB',
        userIntent: 'Extract user activities from CloudWatch logs for DynamoDB storage',
        code: `const events = data.events || []
const userActivities = events.map(event => {
  const userId = extractPattern(event.message, 'user_id: ([a-zA-Z0-9-]+)')[0]
  const action = extractPattern(event.message, 'action: ([a-zA-Z_]+)')[0]
  
  return {
    userId,
    timestamp: formatDate(event.timestamp, 'iso'),
    action,
    logStream: event.logStream,
    requestId: extractPattern(event.message, 'request_id: ([a-zA-Z0-9-]+)')[0]
  }
}).filter(activity => activity.userId && activity.action)

return {
  dynamoDBItems: userActivities,
  batchSize: 25
}`
      }
    ],
    
    dynamodb_to_s3: [
      {
        title: 'Data Export',
        description: 'Export DynamoDB items to S3 for analytics',
        userIntent: 'Export DynamoDB data to S3 for analytics processing',
        code: `const items = data.items || []
const exportData = {
  exportTimestamp: new Date().toISOString(),
  totalRecords: items.length,
  records: items.map(item => ({
    ...item,
    exportedAt: new Date().toISOString()
  }))
}

return {
  s3Object: {
    key: \`exports/dynamodb-export-\${formatDate(Date.now(), 'iso').substring(0, 10)}.json\`,
    body: JSON.stringify(exportData, null, 2),
    contentType: 'application/json'
  }
}`
      }
    ]
  }

  return exampleLibrary[key] || []
}

export default router
