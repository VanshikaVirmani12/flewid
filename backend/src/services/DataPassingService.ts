import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

export interface NodeOutput {
  nodeId: string
  nodeType: string
  status: 'success' | 'error'
  data: any
  extractedData?: Record<string, any>
  timestamp: string
  duration: number
}

export interface VariableReference {
  nodeId: string
  path: string
  fullExpression: string
}

export class DataPassingService {
  private nodeOutputs: Map<string, NodeOutput> = new Map()

  /**
   * Store the output from a node execution
   */
  storeNodeOutput(nodeId: string, nodeType: string, output: NodeOutput): void {
    logger.info('Storing node output', { 
      nodeId, 
      nodeType, 
      status: output.status,
      hasExtractedData: !!output.extractedData 
    })
    
    this.nodeOutputs.set(nodeId, {
      ...output,
      nodeId,
      nodeType,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Extract variables from node output based on node type
   */
  extractVariables(nodeId: string, nodeType: string, rawOutput: any): Record<string, any> {
    logger.info('Extracting variables from node output', { nodeId, nodeType })

    const extractedData: Record<string, any> = {}

    try {
      switch (nodeType.toLowerCase()) {
        case 'cloudwatch':
          extractedData.events = rawOutput.events || []
          extractedData.logGroup = rawOutput.summary?.logGroup
          extractedData.totalEvents = rawOutput.events?.length || 0
          
          // Extract specific data from log events
          if (rawOutput.events && Array.isArray(rawOutput.events)) {
            extractedData.timestamps = rawOutput.events.map((event: any) => event.timestamp)
            extractedData.logStreams = [...new Set(rawOutput.events.map((event: any) => event.logStream))]
            extractedData.messages = rawOutput.events.map((event: any) => event.message)
            
            // Extract common patterns from log messages
            const requestIds = this.extractPatterns(rawOutput.events, /request[_-]?id[:\s=]+([a-zA-Z0-9-]+)/i)
            const userIds = this.extractPatterns(rawOutput.events, /user[_-]?id[:\s=]+([a-zA-Z0-9-]+)/i)
            const errorCodes = this.extractPatterns(rawOutput.events, /error[_-]?code[:\s=]+([0-9]+)/i)
            const traceIds = this.extractPatterns(rawOutput.events, /trace[_-]?id[:\s=]+([a-zA-Z0-9-]+)/i)
            
            if (requestIds.length > 0) extractedData.requestIds = requestIds
            if (userIds.length > 0) extractedData.userIds = userIds
            if (errorCodes.length > 0) extractedData.errorCodes = errorCodes
            if (traceIds.length > 0) extractedData.traceIds = traceIds
          }
          break

        case 'dynamodb':
          extractedData.items = rawOutput.items || []
          extractedData.count = rawOutput.count || 0
          extractedData.scannedCount = rawOutput.scannedCount || 0
          extractedData.tableName = rawOutput.summary?.tableName
          
          // Extract attribute values from items
          if (rawOutput.items && Array.isArray(rawOutput.items)) {
            const allAttributes = new Set<string>()
            rawOutput.items.forEach((item: any) => {
              Object.keys(item).forEach(key => allAttributes.add(key))
            })
            
            // Create arrays of values for each attribute
            allAttributes.forEach(attr => {
              const values = rawOutput.items
                .map((item: any) => item[attr])
                .filter((val: any) => val !== undefined && val !== null)
              
              if (values.length > 0) {
                extractedData[`${attr}Values`] = values
                extractedData[`unique${attr.charAt(0).toUpperCase() + attr.slice(1)}Values`] = [...new Set(values)]
              }
            })
          }
          break

        case 's3':
          extractedData.objects = rawOutput.objects || []
          extractedData.bucketName = rawOutput.bucketName
          extractedData.totalObjects = rawOutput.objects?.length || 0
          
          if (rawOutput.objects && Array.isArray(rawOutput.objects)) {
            extractedData.objectKeys = rawOutput.objects.map((obj: any) => obj.key || obj.Key)
            extractedData.objectSizes = rawOutput.objects.map((obj: any) => obj.size || obj.Size)
            extractedData.lastModified = rawOutput.objects.map((obj: any) => obj.lastModified || obj.LastModified)
          }
          break

        case 'lambda':
          extractedData.functionName = rawOutput.functionName
          extractedData.statusCode = rawOutput.statusCode
          extractedData.payload = rawOutput.payload
          extractedData.logResult = rawOutput.logResult
          extractedData.executionArn = rawOutput.executionArn
          
          // Try to parse JSON payload
          if (rawOutput.payload) {
            try {
              const parsedPayload = JSON.parse(rawOutput.payload)
              extractedData.parsedPayload = parsedPayload
              
              // Extract common response fields
              if (parsedPayload.statusCode) extractedData.responseStatusCode = parsedPayload.statusCode
              if (parsedPayload.body) extractedData.responseBody = parsedPayload.body
              if (parsedPayload.headers) extractedData.responseHeaders = parsedPayload.headers
            } catch (e) {
              // Payload is not JSON, keep as string
            }
          }
          break

        case 'emr':
          extractedData.clusterId = rawOutput.clusterId
          extractedData.clusterName = rawOutput.clusterName
          extractedData.state = rawOutput.state
          extractedData.steps = rawOutput.steps || []
          extractedData.applications = rawOutput.applications || []
          break

        case 'apigateway':
          extractedData.apiId = rawOutput.apiId
          extractedData.apiName = rawOutput.apiName
          extractedData.stage = rawOutput.stage
          extractedData.endpoints = rawOutput.endpoints || []
          extractedData.methods = rawOutput.methods || []
          break

        default:
          logger.warn('Unknown node type for variable extraction', { nodeType })
          // For unknown types, try to extract common fields
          if (rawOutput && typeof rawOutput === 'object') {
            Object.keys(rawOutput).forEach(key => {
              if (typeof rawOutput[key] !== 'function') {
                extractedData[key] = rawOutput[key]
              }
            })
          }
      }

      logger.info('Variables extracted successfully', { 
        nodeId, 
        nodeType, 
        extractedKeys: Object.keys(extractedData) 
      })

      return extractedData
    } catch (error: any) {
      logger.error('Failed to extract variables', { 
        nodeId, 
        nodeType, 
        error: error.message 
      })
      return {}
    }
  }

  /**
   * Extract patterns from log messages using regex
   */
  private extractPatterns(events: any[], pattern: RegExp): string[] {
    const matches: string[] = []
    
    events.forEach(event => {
      if (event.message) {
        const match = event.message.match(pattern)
        if (match && match[1]) {
          matches.push(match[1])
        }
      }
    })
    
    return [...new Set(matches)] // Remove duplicates
  }

  /**
   * Parse variable references from a string (e.g., "{{cloudwatch.extractedData.userIds[0]}}")
   */
  parseVariableReferences(input: string): VariableReference[] {
    const variablePattern = /\{\{([^}]+)\}\}/g
    const references: VariableReference[] = []
    let match

    while ((match = variablePattern.exec(input)) !== null) {
      const fullExpression = match[0]
      const path = match[1].trim()
      
      // Extract node ID (first part before the dot)
      const parts = path.split('.')
      if (parts.length >= 2) {
        const nodeId = parts[0]
        const remainingPath = parts.slice(1).join('.')
        
        references.push({
          nodeId,
          path: remainingPath,
          fullExpression
        })
      }
    }

    return references
  }

  /**
   * Resolve a variable reference to its actual value
   */
  resolveVariableReference(reference: VariableReference): any {
    const nodeOutput = this.nodeOutputs.get(reference.nodeId)
    
    if (!nodeOutput) {
      throw createError(`Node output not found for node: ${reference.nodeId}`, 404)
    }

    if (nodeOutput.status !== 'success') {
      throw createError(`Cannot reference data from failed node: ${reference.nodeId}`, 400)
    }

    try {
      // Navigate through the path to get the value
      const pathParts = reference.path.split('.')
      let currentValue: any = nodeOutput

      for (const part of pathParts) {
        // Handle array indexing (e.g., userIds[0])
        const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/)
        if (arrayMatch) {
          const [, arrayName, indexStr] = arrayMatch
          const index = parseInt(indexStr, 10)
          
          if (currentValue[arrayName] && Array.isArray(currentValue[arrayName])) {
            currentValue = currentValue[arrayName][index]
          } else {
            throw new Error(`Array ${arrayName} not found or not an array`)
          }
        } else {
          if (currentValue && typeof currentValue === 'object' && part in currentValue) {
            currentValue = currentValue[part]
          } else {
            throw new Error(`Property ${part} not found`)
          }
        }
      }

      return currentValue
    } catch (error: any) {
      throw createError(
        `Failed to resolve variable reference ${reference.fullExpression}: ${error.message}`, 
        400
      )
    }
  }

  /**
   * Substitute all variable references in a string with their actual values
   */
  substituteVariables(input: string): string {
    if (typeof input !== 'string') {
      return input
    }

    const references = this.parseVariableReferences(input)
    let result = input

    for (const reference of references) {
      try {
        const value = this.resolveVariableReference(reference)
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
        result = result.replace(reference.fullExpression, stringValue)
      } catch (error: any) {
        logger.error('Failed to substitute variable', { 
          reference: reference.fullExpression, 
          error: error.message 
        })
        // Keep the original expression if substitution fails
      }
    }

    return result
  }

  /**
   * Substitute variables in an entire configuration object
   */
  substituteVariablesInConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        result[key] = this.substituteVariables(value)
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'string' ? this.substituteVariables(item) : item
        )
      } else if (value && typeof value === 'object') {
        result[key] = this.substituteVariablesInConfig(value)
      } else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Get available variables for a given execution context
   */
  getAvailableVariables(): Record<string, any> {
    const variables: Record<string, any> = {}

    for (const [nodeId, output] of this.nodeOutputs.entries()) {
      if (output.status === 'success') {
        variables[nodeId] = {
          nodeType: output.nodeType,
          data: output.data,
          extractedData: output.extractedData || {},
          timestamp: output.timestamp
        }
      }
    }

    return variables
  }

  /**
   * Clear all stored node outputs (for new workflow execution)
   */
  clearNodeOutputs(): void {
    logger.info('Clearing all node outputs')
    this.nodeOutputs.clear()
  }

  /**
   * Get node output by ID
   */
  getNodeOutput(nodeId: string): NodeOutput | undefined {
    return this.nodeOutputs.get(nodeId)
  }

  /**
   * Check if a node has been executed successfully
   */
  hasNodeOutput(nodeId: string): boolean {
    const output = this.nodeOutputs.get(nodeId)
    return output !== undefined && output.status === 'success'
  }

  /**
   * Validate variable references in a configuration
   */
  validateVariableReferences(config: Record<string, any>, availableNodes: string[]): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    const checkValue = (value: any, path: string) => {
      if (typeof value === 'string') {
        const references = this.parseVariableReferences(value)
        
        for (const ref of references) {
          if (!availableNodes.includes(ref.nodeId)) {
            errors.push(`Invalid node reference '${ref.nodeId}' in ${path}`)
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => checkValue(item, `${path}[${index}]`))
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => checkValue(val, `${path}.${key}`))
      }
    }

    Object.entries(config).forEach(([key, value]) => checkValue(value, key))

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
