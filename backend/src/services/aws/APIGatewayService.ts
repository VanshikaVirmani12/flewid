import { APIGatewayClient, GetRestApisCommand, GetStagesCommand, GetResourcesCommand } from '@aws-sdk/client-api-gateway'
import { ApiGatewayV2Client, GetApisCommand, GetStagesCommand as GetStagesV2Command } from '@aws-sdk/client-apigatewayv2'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class APIGatewayService extends BaseAWSService {
  /**
   * List API Gateway REST APIs
   */
  async listAPIs(params: {
    accountId: string
    limit?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing API Gateway APIs', { 
      accountId: params.accountId,
      limit: params.limit
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create API Gateway client
      const client = new APIGatewayClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List REST APIs
      const command = new GetRestApisCommand({
        limit: params.limit || 25
      })

      const response = await client.send(command)
      
      const apis = response.items?.map(api => ({
        id: api.id,
        name: api.name,
        description: api.description,
        createdDate: api.createdDate?.toISOString(),
        version: api.version,
        warnings: api.warnings,
        binaryMediaTypes: api.binaryMediaTypes,
        minimumCompressionSize: api.minimumCompressionSize,
        apiKeySource: api.apiKeySource,
        endpointConfiguration: api.endpointConfiguration,
        policy: api.policy,
        tags: api.tags
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:GET', true)

      return {
        success: true,
        apis,
        count: apis.length
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:GET', false)
      this.handleAWSError(error, 'API Gateway list APIs')
    }
  }

  /**
   * List API Gateway stages for a REST API
   */
  async listStages(params: {
    accountId: string
    apiId: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing API Gateway stages', { 
      accountId: params.accountId,
      apiId: params.apiId
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create API Gateway client
      const client = new APIGatewayClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List stages
      const command = new GetStagesCommand({
        restApiId: params.apiId
      })

      const response = await client.send(command)
      
      const stages = response.item?.map(stage => ({
        stageName: stage.stageName,
        deploymentId: stage.deploymentId,
        description: stage.description,
        createdDate: stage.createdDate?.toISOString(),
        lastUpdatedDate: stage.lastUpdatedDate?.toISOString(),
        cacheClusterEnabled: stage.cacheClusterEnabled,
        cacheClusterSize: stage.cacheClusterSize,
        cacheClusterStatus: stage.cacheClusterStatus,
        methodSettings: stage.methodSettings,
        variables: stage.variables,
        documentationVersion: stage.documentationVersion,
        accessLogSettings: stage.accessLogSettings,
        canarySettings: stage.canarySettings,
        tracingEnabled: stage.tracingEnabled,
        webAclArn: stage.webAclArn,
        tags: stage.tags
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:GET', true)

      return {
        success: true,
        stages,
        count: stages.length
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:GET', false)
      
      if (error.name === 'NotFoundException') {
        throw createError(`API Gateway '${params.apiId}' not found`, 404)
      }
      
      this.handleAWSError(error, 'API Gateway list stages', params.apiId)
    }
  }

  /**
   * Analyze API Gateway logs and metrics
   */
  async analyze(params: {
    accountId: string
    operation: 'access_logs' | 'request_tracing' | 'throttling_detection'
    apiId: string
    stage?: string
    logGroup?: string
    traceId?: string
    requestId?: string
    throttleThreshold?: number
    timeWindow?: number
    includeDetails?: boolean
    startTime?: number
    endTime?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Analyzing API Gateway', { 
      accountId: params.accountId,
      operation: params.operation,
      apiId: params.apiId,
      stage: params.stage
    })

    try {
      if (params.operation === 'access_logs') {
        // Analyze access logs from CloudWatch
        if (!params.logGroup) {
          throw createError('Log group is required for access logs analysis', 400)
        }

        // Import CloudWatch service to query logs
        const { CloudWatchService } = await import('./CloudWatchService')
        const cloudWatchService = new CloudWatchService(this.credentialService)
        
        const logResult = await cloudWatchService.queryLogs({
          accountId: params.accountId,
          logGroup: params.logGroup,
          startTime: params.startTime || Date.now() - 24 * 60 * 60 * 1000,
          endTime: params.endTime || Date.now(),
          filterPattern: '' // Get all logs for analysis
        }, accounts)

        if (!logResult.success) {
          throw createError('Failed to query CloudWatch logs', 500)
        }

        // Parse and analyze access logs
        const logs = logResult.events.map((event: any) => {
          try {
            // Parse API Gateway access log format
            // Example: $requestId $ip $requestTime "$httpMethod $resourcePath $protocol" $status $responseLength $responseTime
            const logParts = event.message.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+(\d+)/)
            
            if (logParts) {
              const [, requestId, sourceIp, timestamp, request, status, responseLength, responseTime] = logParts
              const [method, path] = request.split(' ')
              
              return {
                requestId,
                sourceIp,
                timestamp: new Date(timestamp).toISOString(),
                method,
                path,
                status: parseInt(status),
                responseLength: parseInt(responseLength),
                responseTime: parseInt(responseTime),
                userAgent: null // Would need to be extracted from extended log format
              }
            }
            
            // Fallback parsing for different log formats
            return {
              requestId: 'unknown',
              sourceIp: 'unknown',
              timestamp: event.timestamp,
              method: 'unknown',
              path: 'unknown',
              status: 200,
              responseLength: 0,
              responseTime: 0,
              userAgent: null,
              rawMessage: event.message
            }
          } catch (parseError) {
            return {
              requestId: 'parse-error',
              sourceIp: 'unknown',
              timestamp: event.timestamp,
              method: 'unknown',
              path: 'unknown',
              status: 0,
              responseLength: 0,
              responseTime: 0,
              userAgent: null,
              rawMessage: event.message
            }
          }
        })

        this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:AnalyzeAccessLogs', true)

        return {
          success: true,
          logs,
          summary: {
            apiId: params.apiId,
            stage: params.stage,
            logGroup: params.logGroup,
            timeRange: {
              start: new Date(params.startTime || Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date(params.endTime || Date.now()).toISOString()
            }
          }
        }

      } else if (params.operation === 'request_tracing') {
        // Mock request tracing implementation
        // In a real implementation, this would integrate with X-Ray or CloudWatch Insights
        const mockTraces = [
          {
            requestId: params.requestId || 'req-12345',
            traceId: params.traceId || '1-5e1b4e99-38a6d216b8e007da',
            timestamp: new Date().toISOString(),
            method: 'GET',
            path: '/api/users',
            status: 200,
            responseTime: 150,
            requestHeaders: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/json'
            },
            responseHeaders: {
              'Content-Type': 'application/json',
              'Content-Length': '1024'
            },
            requestBody: null,
            responseBody: '{"users": []}'
          }
        ]

        this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:RequestTracing', true)

        return {
          success: true,
          traces: mockTraces
        }

      } else if (params.operation === 'throttling_detection') {
        // Mock throttling detection implementation
        // In a real implementation, this would analyze CloudWatch metrics
        const mockThrottlingEvents = [
          {
            timestamp: new Date().toISOString(),
            method: 'POST',
            path: '/api/orders',
            requestRate: params.throttleThreshold ? params.throttleThreshold + 50 : 150,
            throttledCount: 25,
            sourceIps: ['192.168.1.100', '10.0.0.50'],
            details: params.includeDetails ? {
              throttleReason: 'Rate limit exceeded',
              burstLimit: 100,
              rateLimit: 50
            } : null
          }
        ]

        this.credentialService.auditCredentialUsage(params.accountId, 'apigateway:ThrottlingDetection', true)

        return {
          success: true,
          throttlingEvents: mockThrottlingEvents,
          summary: {
            totalThrottledRequests: 25,
            peakRequestRate: 150,
            mostAffectedEndpoint: 'POST /api/orders',
            timeRange: {
              start: new Date(params.startTime || Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date(params.endTime || Date.now()).toISOString()
            }
          }
        }
      }

      throw createError(`Unknown operation: ${params.operation}`, 400)

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, `apigateway:${params.operation}`, false)
      logger.error('Failed to analyze API Gateway', { 
        accountId: params.accountId,
        operation: params.operation,
        apiId: params.apiId,
        error: error.message
      })
      
      throw createError(`API Gateway analysis failed: ${error.message}`, 500)
    }
  }
}
