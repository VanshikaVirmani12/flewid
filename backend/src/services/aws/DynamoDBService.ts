import { DynamoDBClient, QueryCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
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

  /**
   * Update an item in DynamoDB table
   */
  async updateItem(params: {
    accountId: string
    tableName: string
    key: Record<string, any>
    updateExpression: string
    conditionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
    returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Updating DynamoDB item', { 
      accountId: params.accountId,
      tableName: params.tableName,
      key: params.key
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new DynamoDBClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate required parameters
      if (!params.key || Object.keys(params.key).length === 0) {
        throw createError('Key is required for update operations', 400)
      }

      if (!params.updateExpression || params.updateExpression.trim() === '') {
        throw createError('Update expression is required', 400)
      }

      const updateParams: any = {
        TableName: params.tableName,
        Key: marshall(params.key),
        UpdateExpression: params.updateExpression,
        ReturnValues: params.returnValues || 'ALL_NEW',
        ReturnConsumedCapacity: 'TOTAL'
      }

      // Add condition expression if provided
      if (params.conditionExpression) {
        updateParams.ConditionExpression = params.conditionExpression
      }

      // Add expression attribute names if provided
      if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
        updateParams.ExpressionAttributeNames = params.expressionAttributeNames
      }

      // Add expression attribute values if provided
      if (params.expressionAttributeValues && Object.keys(params.expressionAttributeValues).length > 0) {
        updateParams.ExpressionAttributeValues = marshall(params.expressionAttributeValues)
      }

      logger.info('DynamoDB UpdateItem parameters', {
        tableName: params.tableName,
        updateExpression: params.updateExpression,
        conditionExpression: params.conditionExpression,
        returnValues: params.returnValues
      })

      const command = new UpdateItemCommand(updateParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:UpdateItem', true)

      const result = {
        success: true,
        attributes: response.Attributes ? unmarshall(response.Attributes) : null,
        consumedCapacity: response.ConsumedCapacity?.CapacityUnits || 0
      }

      logger.info('DynamoDB UpdateItem completed', {
        accountId: params.accountId,
        tableName: params.tableName,
        consumedCapacity: result.consumedCapacity
      })

      return result

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:UpdateItem', false)
      logger.error('Failed to update DynamoDB item', { 
        accountId: params.accountId,
        tableName: params.tableName,
        error: error.message
      })
      
      if (error.name === 'ConditionalCheckFailedException') {
        throw createError('Condition check failed - item may have been modified by another process', 409)
      } else if (error.name === 'ResourceNotFoundException') {
        throw createError(`Table '${params.tableName}' not found`, 404)
      } else if (error.name === 'ValidationException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else {
        this.handleAWSError(error, 'DynamoDB UpdateItem', params.tableName)
      }
    }
  }

  /**
   * Delete an item from DynamoDB table
   */
  async deleteItem(params: {
    accountId: string
    tableName: string
    key: Record<string, any>
    conditionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
    returnValues?: 'NONE' | 'ALL_OLD'
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Deleting DynamoDB item', { 
      accountId: params.accountId,
      tableName: params.tableName,
      key: params.key
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new DynamoDBClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate required parameters
      if (!params.key || Object.keys(params.key).length === 0) {
        throw createError('Key is required for delete operations', 400)
      }

      const deleteParams: any = {
        TableName: params.tableName,
        Key: marshall(params.key),
        ReturnValues: params.returnValues || 'ALL_OLD',
        ReturnConsumedCapacity: 'TOTAL'
      }

      // Add condition expression if provided
      if (params.conditionExpression) {
        deleteParams.ConditionExpression = params.conditionExpression
      }

      // Add expression attribute names if provided
      if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
        deleteParams.ExpressionAttributeNames = params.expressionAttributeNames
      }

      // Add expression attribute values if provided
      if (params.expressionAttributeValues && Object.keys(params.expressionAttributeValues).length > 0) {
        deleteParams.ExpressionAttributeValues = marshall(params.expressionAttributeValues)
      }

      logger.info('DynamoDB DeleteItem parameters', {
        tableName: params.tableName,
        conditionExpression: params.conditionExpression,
        returnValues: params.returnValues
      })

      const command = new DeleteItemCommand(deleteParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:DeleteItem', true)

      const result = {
        success: true,
        attributes: response.Attributes ? unmarshall(response.Attributes) : null,
        consumedCapacity: response.ConsumedCapacity?.CapacityUnits || 0
      }

      logger.info('DynamoDB DeleteItem completed', {
        accountId: params.accountId,
        tableName: params.tableName,
        consumedCapacity: result.consumedCapacity
      })

      return result

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:DeleteItem', false)
      logger.error('Failed to delete DynamoDB item', { 
        accountId: params.accountId,
        tableName: params.tableName,
        error: error.message
      })
      
      if (error.name === 'ConditionalCheckFailedException') {
        throw createError('Condition check failed - item may have been modified by another process', 409)
      } else if (error.name === 'ResourceNotFoundException') {
        throw createError(`Table '${params.tableName}' not found`, 404)
      } else if (error.name === 'ValidationException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else {
        this.handleAWSError(error, 'DynamoDB DeleteItem', params.tableName)
      }
    }
  }

  /**
   * Put (create or replace) an item in DynamoDB table
   */
  async putItem(params: {
    accountId: string
    tableName: string
    item: Record<string, any>
    conditionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
    returnValues?: 'NONE' | 'ALL_OLD'
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Putting DynamoDB item', { 
      accountId: params.accountId,
      tableName: params.tableName,
      itemKeys: Object.keys(params.item)
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new DynamoDBClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate required parameters
      if (!params.item || Object.keys(params.item).length === 0) {
        throw createError('Item is required for put operations', 400)
      }

      const putParams: any = {
        TableName: params.tableName,
        Item: marshall(params.item),
        ReturnValues: params.returnValues || 'NONE',
        ReturnConsumedCapacity: 'TOTAL'
      }

      // Add condition expression if provided
      if (params.conditionExpression) {
        putParams.ConditionExpression = params.conditionExpression
      }

      // Add expression attribute names if provided
      if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
        putParams.ExpressionAttributeNames = params.expressionAttributeNames
      }

      // Add expression attribute values if provided
      if (params.expressionAttributeValues && Object.keys(params.expressionAttributeValues).length > 0) {
        putParams.ExpressionAttributeValues = marshall(params.expressionAttributeValues)
      }

      logger.info('DynamoDB PutItem parameters', {
        tableName: params.tableName,
        conditionExpression: params.conditionExpression,
        returnValues: params.returnValues
      })

      const command = new PutItemCommand(putParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:PutItem', true)

      const result = {
        success: true,
        attributes: response.Attributes ? unmarshall(response.Attributes) : null,
        consumedCapacity: response.ConsumedCapacity?.CapacityUnits || 0
      }

      logger.info('DynamoDB PutItem completed', {
        accountId: params.accountId,
        tableName: params.tableName,
        consumedCapacity: result.consumedCapacity
      })

      return result

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:PutItem', false)
      logger.error('Failed to put DynamoDB item', { 
        accountId: params.accountId,
        tableName: params.tableName,
        error: error.message
      })
      
      if (error.name === 'ConditionalCheckFailedException') {
        throw createError('Condition check failed - item already exists or condition not met', 409)
      } else if (error.name === 'ResourceNotFoundException') {
        throw createError(`Table '${params.tableName}' not found`, 404)
      } else if (error.name === 'ValidationException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else {
        this.handleAWSError(error, 'DynamoDB PutItem', params.tableName)
      }
    }
  }

  /**
   * Get a single item from DynamoDB table
   */
  async getItem(params: {
    accountId: string
    tableName: string
    key: Record<string, any>
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting DynamoDB item', { 
      accountId: params.accountId,
      tableName: params.tableName,
      key: params.key
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new DynamoDBClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate required parameters
      if (!params.key || Object.keys(params.key).length === 0) {
        throw createError('Key is required for get operations', 400)
      }

      const getParams: any = {
        TableName: params.tableName,
        Key: marshall(params.key),
        ReturnConsumedCapacity: 'TOTAL'
      }

      // Add projection expression if provided
      if (params.projectionExpression) {
        getParams.ProjectionExpression = params.projectionExpression
      }

      // Add expression attribute names if provided
      if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
        getParams.ExpressionAttributeNames = params.expressionAttributeNames
      }

      logger.info('DynamoDB GetItem parameters', {
        tableName: params.tableName,
        projectionExpression: params.projectionExpression
      })

      const command = new GetItemCommand(getParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:GetItem', true)

      const result = {
        success: true,
        item: response.Item ? unmarshall(response.Item) : null,
        consumedCapacity: response.ConsumedCapacity?.CapacityUnits || 0
      }

      logger.info('DynamoDB GetItem completed', {
        accountId: params.accountId,
        tableName: params.tableName,
        itemFound: !!response.Item,
        consumedCapacity: result.consumedCapacity
      })

      return result

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'dynamodb:GetItem', false)
      logger.error('Failed to get DynamoDB item', { 
        accountId: params.accountId,
        tableName: params.tableName,
        error: error.message
      })
      
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Table '${params.tableName}' not found`, 404)
      } else if (error.name === 'ValidationException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else {
        this.handleAWSError(error, 'DynamoDB GetItem', params.tableName)
      }
    }
  }
}
