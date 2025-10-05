import { DynamoDBClient, QueryCommand, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class DynamoDBService extends BaseAWSService {
  /**
   * Validate and parse DynamoDB filter expression
   */
  private validateAndParseFilterExpression(filterExpression: string): {
    isValid: boolean
    error?: string
    filterExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
  } {
    if (!filterExpression || filterExpression.trim() === '') {
      return { isValid: false, error: 'Filter expression cannot be empty' }
    }

    const trimmedExpression = filterExpression.trim()
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}
    let parsedFilterExpression = trimmedExpression

    // Handle simple equality filters like "Status=ACTIVE" or "attribute=value"
    const equalityMatch = trimmedExpression.match(/^(\w+)\s*=\s*(.+)$/)
    if (equalityMatch) {
      const [, attributeName, attributeValue] = equalityMatch
      
      // Validate attribute name (must be alphanumeric and underscores)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `The attribute name "${attributeName}" is not valid.\n\nAttribute names must:\n• Start with a letter (a-z, A-Z) or underscore (_)\n• Only contain letters, numbers, and underscores\n\nExample: "Status" or "user_id" or "_internal"` 
        }
      }

      // Validate attribute value (cannot be empty)
      const cleanValue = attributeValue.trim().replace(/^["']|["']$/g, '')
      if (cleanValue === '') {
        return { 
          isValid: false, 
          error: `The value for "${attributeName}" cannot be empty.\n\nPlease provide a value after the equals sign.\n\nExample: ${attributeName}=ACTIVE` 
        }
      }

      expressionAttributeNames[`#${attributeName}`] = attributeName
      expressionAttributeValues[`:${attributeName}Val`] = { S: cleanValue }
      parsedFilterExpression = `#${attributeName} = :${attributeName}Val`

      return {
        isValid: true,
        filterExpression: parsedFilterExpression,
        expressionAttributeNames,
        expressionAttributeValues
      }
    }

    // Handle attribute_exists function
    const attributeExistsMatch = trimmedExpression.match(/^attribute_exists\s*\(\s*([^)]+)\s*\)$/)
    if (attributeExistsMatch) {
      const attributeName = attributeExistsMatch[1].trim().replace(/["']/g, '')
      
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in attribute_exists function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      expressionAttributeNames[`#${attributeName}`] = attributeName
      parsedFilterExpression = `attribute_exists(#${attributeName})`

      return {
        isValid: true,
        filterExpression: parsedFilterExpression,
        expressionAttributeNames,
        expressionAttributeValues: {}
      }
    }

    // Handle contains function
    const containsMatch = trimmedExpression.match(/^contains\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/)
    if (containsMatch) {
      const attributeName = containsMatch[1].trim().replace(/["']/g, '')
      const searchValue = containsMatch[2].trim().replace(/["']/g, '')

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in contains function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      if (searchValue === '') {
        return { 
          isValid: false, 
          error: `Search value cannot be empty in contains function '${trimmedExpression}'` 
        }
      }

      expressionAttributeNames[`#${attributeName}`] = attributeName
      expressionAttributeValues[`:${attributeName}Val`] = { S: searchValue }
      parsedFilterExpression = `contains(#${attributeName}, :${attributeName}Val)`

      return {
        isValid: true,
        filterExpression: parsedFilterExpression,
        expressionAttributeNames,
        expressionAttributeValues
      }
    }

    // Handle begins_with function
    const beginsWithMatch = trimmedExpression.match(/^begins_with\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/)
    if (beginsWithMatch) {
      const attributeName = beginsWithMatch[1].trim().replace(/["']/g, '')
      const prefixValue = beginsWithMatch[2].trim().replace(/["']/g, '')

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in begins_with function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      if (prefixValue === '') {
        return { 
          isValid: false, 
          error: `Prefix value cannot be empty in begins_with function '${trimmedExpression}'` 
        }
      }

      expressionAttributeNames[`#${attributeName}`] = attributeName
      expressionAttributeValues[`:${attributeName}Val`] = { S: prefixValue }
      parsedFilterExpression = `begins_with(#${attributeName}, :${attributeName}Val)`

      return {
        isValid: true,
        filterExpression: parsedFilterExpression,
        expressionAttributeNames,
        expressionAttributeValues
      }
    }

    // If none of the patterns match, return error with helpful message
    return {
      isValid: false,
      error: `The filter expression "${trimmedExpression}" is not in a supported format.\n\nSupported formats:\n\n• Simple equality: attribute=value\n  Example: Status=ACTIVE\n\n• Contains text: contains(attribute,value)\n  Example: contains(name,John)\n\n• Starts with: begins_with(attribute,value)\n  Example: begins_with(id,user)\n\n• Check if exists: attribute_exists(attribute)\n  Example: attribute_exists(email)`
    }
  }

  /**
   * Query or scan DynamoDB table with real AWS SDK
   */
  async queryTable(params: {
    accountId: string
    tableName: string
    operation: 'scan' | 'query'
    partitionKey?: string
    partitionKeyValue?: string
    sortKey?: string
    sortKeyValue?: string
    indexName?: string
    filterExpression?: string
    limit?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Querying DynamoDB', { 
      accountId: params.accountId,
      tableName: params.tableName,
      operation: params.operation,
      partitionKey: params.partitionKey,
      indexName: params.indexName,
      limit: params.limit
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create DynamoDB client
      const client = new DynamoDBClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      let command
      let response
      
      if (params.operation === 'query') {
        // Validate required parameters for query
        if (!params.partitionKey || !params.partitionKeyValue) {
          throw createError('Partition key name and value are required for query operations', 400)
        }

        // Build key condition expression
        let keyConditionExpression = `#pk = :pkval`
        const expressionAttributeNames: Record<string, string> = {
          '#pk': params.partitionKey
        }
        const expressionAttributeValues: Record<string, any> = {
          ':pkval': { S: params.partitionKeyValue }
        }

        // Add sort key condition if provided
        if (params.sortKey && params.sortKeyValue) {
          keyConditionExpression += ` AND #sk = :skval`
          expressionAttributeNames['#sk'] = params.sortKey
          expressionAttributeValues[':skval'] = { S: params.sortKeyValue }
        }

        // Build query parameters
        const queryParams: any = {
          TableName: params.tableName,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          Limit: params.limit || 25,
          ReturnConsumedCapacity: 'TOTAL'
        }

        // Add index if specified
        if (params.indexName) {
          queryParams.IndexName = params.indexName
        }

        // Add filter expression if provided
        if (params.filterExpression) {
          // Validate and parse filter expression
          const validationResult = this.validateAndParseFilterExpression(params.filterExpression)
          if (!validationResult.isValid) {
            throw createError(`Invalid filter expression: ${validationResult.error}`, 400)
          }

          queryParams.FilterExpression = validationResult.filterExpression
          
          // Merge filter expression attributes with existing key condition attributes
          if (validationResult.expressionAttributeNames && Object.keys(validationResult.expressionAttributeNames).length > 0) {
            queryParams.ExpressionAttributeNames = {
              ...queryParams.ExpressionAttributeNames,
              ...validationResult.expressionAttributeNames
            }
          }
          
          if (validationResult.expressionAttributeValues && Object.keys(validationResult.expressionAttributeValues).length > 0) {
            queryParams.ExpressionAttributeValues = {
              ...queryParams.ExpressionAttributeValues,
              ...validationResult.expressionAttributeValues
            }
          }
        }

        logger.info('DynamoDB Query parameters', {
          tableName: params.tableName,
          keyConditionExpression,
          indexName: params.indexName,
          filterExpression: params.filterExpression,
          limit: params.limit
        })

        command = new QueryCommand(queryParams)
        response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:Query', true)

      } else {
        // Scan operation
        const scanParams: any = {
          TableName: params.tableName,
          Limit: params.limit || 25,
          ReturnConsumedCapacity: 'TOTAL'
        }

        // Add index if specified
        if (params.indexName) {
          scanParams.IndexName = params.indexName
        }

        // Add filter expression if provided
        if (params.filterExpression) {
          // Validate and parse filter expression
          const validationResult = this.validateAndParseFilterExpression(params.filterExpression)
          if (!validationResult.isValid) {
            throw createError(`Invalid filter expression: ${validationResult.error}`, 400)
          }

          scanParams.FilterExpression = validationResult.filterExpression
          
          if (validationResult.expressionAttributeNames && Object.keys(validationResult.expressionAttributeNames).length > 0) {
            scanParams.ExpressionAttributeNames = validationResult.expressionAttributeNames
          }
          
          if (validationResult.expressionAttributeValues && Object.keys(validationResult.expressionAttributeValues).length > 0) {
            scanParams.ExpressionAttributeValues = validationResult.expressionAttributeValues
          }
        }

        logger.info('DynamoDB Scan parameters', {
          tableName: params.tableName,
          indexName: params.indexName,
          filterExpression: params.filterExpression,
          limit: params.limit
        })

        command = new ScanCommand(scanParams)
        response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:Scan', true)
      }

      // Convert DynamoDB items to plain JavaScript objects
      const items = response.Items?.map((item: any) => {
        const convertedItem: any = {}
        Object.entries(item).forEach(([key, value]: [string, any]) => {
          // Convert DynamoDB attribute values to plain values
          if (value.S !== undefined) convertedItem[key] = value.S
          else if (value.N !== undefined) convertedItem[key] = Number(value.N)
          else if (value.BOOL !== undefined) convertedItem[key] = value.BOOL
          else if (value.SS !== undefined) convertedItem[key] = value.SS
          else if (value.NS !== undefined) convertedItem[key] = value.NS.map(Number)
          else if (value.L !== undefined) convertedItem[key] = value.L
          else if (value.M !== undefined) convertedItem[key] = value.M
          else if (value.NULL !== undefined) convertedItem[key] = null
          else convertedItem[key] = value
        })
        return convertedItem
      }) || []

      logger.info('DynamoDB operation completed', {
        accountId: params.accountId,
        operation: params.operation,
        itemsReturned: items.length,
        scannedCount: response.ScannedCount,
        consumedCapacity: response.ConsumedCapacity?.CapacityUnits
      })

      return {
        success: true,
        items,
        count: response.Count || 0,
        scannedCount: response.ScannedCount || 0,
        lastEvaluatedKey: response.LastEvaluatedKey,
        summary: {
          operation: params.operation,
          tableName: params.tableName,
          itemsReturned: items.length,
          scannedCount: response.ScannedCount || 0,
          consumedCapacity: response.ConsumedCapacity?.CapacityUnits || 0,
          indexName: params.indexName,
          hasMoreResults: !!response.LastEvaluatedKey
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, `dynamodb:${params.operation}`, false)
      logger.error('Failed to query DynamoDB', { 
        accountId: params.accountId,
        tableName: params.tableName,
        operation: params.operation,
        error: error.message
      })
      
      // Return more specific error messages
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Table '${params.tableName}' not found`, 404)
      } else if (error.name === 'ValidationException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else if (error.name === 'AccessDeniedException') {
        throw createError(`Access denied to table '${params.tableName}'`, 403)
      } else if (error.name === 'ProvisionedThroughputExceededException') {
        throw createError('Table throughput exceeded. Please try again later.', 429)
      } else {
        this.handleAWSError(error, 'DynamoDB operation', params.tableName)
      }
    }
  }
}
