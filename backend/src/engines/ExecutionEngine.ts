import { logger } from '../utils/logger'
import { Workflow, WorkflowExecution, WorkflowNode, WorkflowEdge } from '../services/WorkflowService'
import { DataPassingService, NodeOutput } from '../services/DataPassingService'
import { AWSService } from '../services/AWSService'

export interface NodeExecutionResult {
  nodeId: string
  status: 'success' | 'error'
  output: any
  extractedData?: Record<string, any>
  duration: number
  timestamp: string
  error?: string
}

export class ExecutionEngine {
  private dataPassingService: DataPassingService
  private awsService: AWSService

  constructor() {
    this.dataPassingService = new DataPassingService()
    this.awsService = new AWSService()
  }

  async execute(workflow: Workflow, execution: WorkflowExecution): Promise<WorkflowExecution> {
    logger.info('Starting workflow execution', { 
      workflowId: workflow.id, 
      executionId: execution.id 
    })

    try {
      execution.status = 'running'
      
      // Clear any previous node outputs for this execution
      this.dataPassingService.clearNodeOutputs()
      
      // Build execution order based on workflow DAG
      const executionOrder = this.buildExecutionOrder(workflow.nodes, workflow.edges)
      
      // Execute nodes in topological order
      const nodeResults: NodeExecutionResult[] = []
      
      for (const nodeId of executionOrder) {
        const node = workflow.nodes.find(n => n.id === nodeId)
        if (!node) {
          throw new Error(`Node ${nodeId} not found in workflow`)
        }

        logger.info('Executing node', { 
          nodeId: node.id, 
          nodeType: node.type,
          executionId: execution.id 
        })

        try {
          const result = await this.executeNode(node, execution)
          nodeResults.push(result)

          // Store successful node output for data passing
          if (result.status === 'success') {
            const nodeOutput: NodeOutput = {
              nodeId: result.nodeId,
              nodeType: node.type,
              status: result.status,
              data: result.output,
              extractedData: result.extractedData,
              timestamp: result.timestamp,
              duration: result.duration
            }
            
            this.dataPassingService.storeNodeOutput(node.id, node.type, nodeOutput)
          }
        } catch (error: any) {
          const failedResult: NodeExecutionResult = {
            nodeId: node.id,
            status: 'error',
            output: null,
            duration: 0,
            timestamp: new Date().toISOString(),
            error: error.message
          }
          nodeResults.push(failedResult)
          
          // Stop execution on node failure
          throw new Error(`Node ${node.id} failed: ${error.message}`)
        }
      }
      
      execution.status = 'completed'
      execution.endTime = new Date().toISOString()
      execution.outputs = {
        message: 'Workflow completed successfully',
        nodesExecuted: nodeResults.length,
        executionTime: Date.now() - new Date(execution.startTime).getTime(),
        nodeResults,
        availableVariables: this.dataPassingService.getAvailableVariables()
      }
      
      logger.info('Workflow execution completed', { 
        executionId: execution.id,
        duration: execution.outputs.executionTime,
        nodesExecuted: nodeResults.length
      })
      
    } catch (error: any) {
      execution.status = 'failed'
      execution.endTime = new Date().toISOString()
      execution.error = error.message
      
      logger.error('Workflow execution failed', { 
        executionId: execution.id,
        error: error.message 
      })
    }
    
    return execution
  }

  /**
   * Build execution order using topological sort
   */
  private buildExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
    const nodeIds = nodes.map(n => n.id)
    const inDegree = new Map<string, number>()
    const adjacencyList = new Map<string, string[]>()

    // Initialize
    nodeIds.forEach(id => {
      inDegree.set(id, 0)
      adjacencyList.set(id, [])
    })

    // Build adjacency list and calculate in-degrees
    edges.forEach(edge => {
      const from = edge.source
      const to = edge.target
      
      if (nodeIds.includes(from) && nodeIds.includes(to)) {
        adjacencyList.get(from)?.push(to)
        inDegree.set(to, (inDegree.get(to) || 0) + 1)
      }
    })

    // Topological sort using Kahn's algorithm
    const queue: string[] = []
    const result: string[] = []

    // Find nodes with no incoming edges
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId)
      }
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      // Process neighbors
      const neighbors = adjacencyList.get(current) || []
      neighbors.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      })
    }

    // Check for cycles
    if (result.length !== nodeIds.length) {
      throw new Error('Workflow contains cycles - cannot determine execution order')
    }

    logger.info('Built execution order', { 
      totalNodes: nodeIds.length,
      executionOrder: result 
    })

    return result
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: WorkflowNode, execution: WorkflowExecution): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Skip non-AWS nodes (like input/output nodes)
      if (node.type === 'input' || node.type === 'output') {
        return {
          nodeId: node.id,
          status: 'success',
          output: { message: `${node.type} node processed` },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      }

      // Substitute variables in node configuration
      const originalConfig = node.data.config
      const substitutedConfig = this.dataPassingService.substituteVariablesInConfig(originalConfig)
      
      logger.info('Node configuration after variable substitution', {
        nodeId: node.id,
        originalConfig,
        substitutedConfig
      })

      // Execute AWS service node
      let result: any
      
      switch (node.type.toLowerCase()) {
        case 'cloudwatch':
          result = await this.executeCloudWatchNode(substitutedConfig)
          break
        case 'dynamodb':
          result = await this.executeDynamoDBNode(substitutedConfig)
          break
        case 's3':
          result = await this.executeS3Node(substitutedConfig)
          break
        case 'lambda':
          result = await this.executeLambdaNode(substitutedConfig)
          break
        case 'emr':
          result = await this.executeEMRNode(substitutedConfig)
          break
        case 'apigateway':
          result = await this.executeAPIGatewayNode(substitutedConfig)
          break
        case 'sqs':
          result = await this.executeSQSNode(substitutedConfig)
          break
        default:
          throw new Error(`Unsupported node type: ${node.type}`)
      }

      // Extract variables from the result
      const extractedData = this.dataPassingService.extractVariables(node.id, node.type, result)

      return {
        nodeId: node.id,
        status: 'success',
        output: result,
        extractedData,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }

    } catch (error: any) {
      logger.error('Node execution failed', {
        nodeId: node.id,
        nodeType: node.type,
        error: error.message
      })

      return {
        nodeId: node.id,
        status: 'error',
        output: null,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      }
    }
  }

  /**
   * Execute CloudWatch node
   */
  private async executeCloudWatchNode(config: any): Promise<any> {
    const operation = config.operation || 'logs'
    
    if (operation === 'logs') {
      if (!config.logGroup || !config.keyword) {
        throw new Error('CloudWatch log query requires logGroup and keyword')
      }

      return await this.awsService.queryCloudWatchLogs({
        accountId: 'dev-account-1', // This should come from workflow context
        logGroup: config.logGroup,
        filterPattern: config.keyword,
        startTime: config.startTime ? new Date(config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
        endTime: config.endTime ? new Date(config.endTime).getTime() : Date.now()
      })
    } else {
      // Alarm operation
      if (!config.selectedAlarm) {
        throw new Error('CloudWatch alarm query requires selectedAlarm')
      }

      return await this.awsService.getCloudWatchAlarmDetails({
        accountId: 'dev-account-1',
        alarmName: config.selectedAlarm,
        includeHistory: config.includeHistory || false
      })
    }
  }

  /**
   * Execute DynamoDB node
   */
  private async executeDynamoDBNode(config: any): Promise<any> {
    if (!config.tableName) {
      throw new Error('DynamoDB query requires tableName')
    }

    return await this.awsService.queryDynamoDB({
      accountId: 'dev-account-1',
      tableName: config.tableName,
      operation: config.operation || 'scan',
      partitionKey: config.partitionKey,
      partitionKeyValue: config.partitionKeyValue,
      sortKey: config.sortKey,
      sortKeyValue: config.sortKeyValue,
      indexName: config.indexName,
      filterExpression: config.filterExpression,
      limit: config.limit || 25
    })
  }

  /**
   * Execute S3 node
   */
  private async executeS3Node(config: any): Promise<any> {
    if (!config.bucketName) {
      throw new Error('S3 operation requires bucketName')
    }

    // This would call the appropriate S3 service method
    // For now, return a mock response
    return {
      success: true,
      bucketName: config.bucketName,
      objects: [],
      message: 'S3 operation completed (mock)'
    }
  }

  /**
   * Execute Lambda node
   */
  private async executeLambdaNode(config: any): Promise<any> {
    if (!config.functionName) {
      throw new Error('Lambda invocation requires functionName')
    }

    // This would call the appropriate Lambda service method
    // For now, return a mock response
    return {
      success: true,
      functionName: config.functionName,
      statusCode: 200,
      payload: JSON.stringify({ message: 'Lambda executed successfully (mock)' }),
      message: 'Lambda invocation completed (mock)'
    }
  }

  /**
   * Execute EMR node
   */
  private async executeEMRNode(config: any): Promise<any> {
    // This would call the appropriate EMR service method
    // For now, return a mock response
    return {
      success: true,
      clusterId: 'j-mock123',
      clusterName: config.clusterName || 'mock-cluster',
      state: 'RUNNING',
      message: 'EMR operation completed (mock)'
    }
  }

  /**
   * Execute API Gateway node
   */
  private async executeAPIGatewayNode(config: any): Promise<any> {
    // This would call the appropriate API Gateway service method
    // For now, return a mock response
    return {
      success: true,
      apiId: 'mock-api-123',
      apiName: config.apiName || 'mock-api',
      stage: config.stage || 'dev',
      message: 'API Gateway operation completed (mock)'
    }
  }

  /**
   * Execute SQS node
   */
  private async executeSQSNode(config: any): Promise<any> {
    const operation = config.operation
    const accountId = 'dev-account-1' // This should come from workflow context

    switch (operation) {
      case 'listQueues':
        return await this.awsService.listSQSQueues({
          accountId,
          queueNamePrefix: config.queueNamePrefix,
          maxResults: config.maxResults
        })

      case 'sendMessage':
        if (!config.queueName && !config.queueUrl) {
          throw new Error('SQS sendMessage requires queueName or queueUrl')
        }
        if (!config.messageBody) {
          throw new Error('SQS sendMessage requires messageBody')
        }

        return await this.awsService.sendSQSMessage({
          accountId,
          queueName: config.queueName,
          queueUrl: config.queueUrl,
          messageBody: config.messageBody,
          delaySeconds: config.delaySeconds,
          messageAttributes: config.messageAttributes,
          messageGroupId: config.messageGroupId,
          messageDeduplicationId: config.messageDeduplicationId
        })

      case 'receiveMessages':
        if (!config.queueName && !config.queueUrl) {
          throw new Error('SQS receiveMessages requires queueName or queueUrl')
        }

        return await this.awsService.receiveSQSMessages({
          accountId,
          queueName: config.queueName,
          queueUrl: config.queueUrl,
          maxNumberOfMessages: config.maxNumberOfMessages,
          visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
          waitTimeSeconds: config.waitTimeSeconds,
          attributeNames: config.attributeNames,
          messageAttributeNames: config.messageAttributeNames
        })

      case 'pollMessages':
        if (!config.queueName && !config.queueUrl) {
          throw new Error('SQS pollMessages requires queueName or queueUrl')
        }

        return await this.awsService.pollSQSMessages({
          accountId,
          queueName: config.queueName,
          queueUrl: config.queueUrl,
          maxNumberOfMessages: config.maxNumberOfMessages,
          visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
          waitTimeSeconds: config.waitTimeSeconds,
          pollDurationSeconds: config.pollDurationSeconds,
          attributeNames: config.attributeNames,
          messageAttributeNames: config.messageAttributeNames
        })

      case 'getQueueAttributes':
        if (!config.queueName && !config.queueUrl) {
          throw new Error('SQS getQueueAttributes requires queueName or queueUrl')
        }

        return await this.awsService.getSQSQueueAttributes({
          accountId,
          queueName: config.queueName,
          queueUrl: config.queueUrl,
          attributeNames: config.attributeNames
        })

      default:
        throw new Error(`Unsupported SQS operation: ${operation}`)
    }
  }

  /**
   * Get the data passing service instance
   */
  getDataPassingService(): DataPassingService {
    return this.dataPassingService
  }
}
