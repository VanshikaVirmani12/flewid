import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs'
import { DynamoDBClient, QueryCommand, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { LambdaClient, InvokeCommand, GetFunctionCommand } from '@aws-sdk/client-lambda'
import { EMRClient, ListClustersCommand, DescribeClusterCommand, AddJobFlowStepsCommand, ListStepsCommand, DescribeStepCommand, ClusterState, StepState, ActionOnFailure } from '@aws-sdk/client-emr'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { AWSCredentialService, AWSCredentials, AWSAccount } from './AWSCredentialService'

export class AWSService {
  private credentialService: AWSCredentialService
  private accounts: Map<string, AWSAccount> = new Map()

  constructor() {
    this.credentialService = new AWSCredentialService()
    this.initializeMockAccounts()
  }

  /**
   * Initialize mock AWS accounts for development
   */
  private initializeMockAccounts(): void {
    const mockAccount: AWSAccount = {
      id: 'dev-account-1',
      name: 'Development Account',
      roleArn: 'arn:aws:iam::123456789012:role/FlowIdDebugRole',
      externalId: 'flowid-external-id-12345',
      region: 'us-east-1',
      isActive: true,
      lastUsed: new Date()
    }
    this.accounts.set(mockAccount.id, mockAccount)
  }

  /**
   * Get AWS account by ID
   */
  private async getAccountById(accountId: string): Promise<AWSAccount> {
    const account = this.accounts.get(accountId)
    if (!account) {
      throw createError(`AWS account ${accountId} not found`, 404)
    }
    return account
  }

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
   * Query CloudWatch logs with real AWS SDK
   */
  async queryCloudWatchLogs(params: {
    accountId: string
    logGroup: string
    query?: string
    startTime?: number
    endTime?: number
    filterPattern?: string
  }): Promise<any> {
    logger.info('Querying CloudWatch logs', { 
      accountId: params.accountId,
      logGroup: params.logGroup,
      filterPattern: params.filterPattern,
      startTime: params.startTime,
      endTime: params.endTime
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create CloudWatch Logs client with local credentials
        const client = new CloudWatchLogsClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // First, check if the log group exists
        try {
          const describeCommand = new DescribeLogGroupsCommand({
            logGroupNamePrefix: params.logGroup,
            limit: 1
          })
          const describeResponse = await client.send(describeCommand)
          
          if (!describeResponse.logGroups || describeResponse.logGroups.length === 0) {
            throw createError(`Log group '${params.logGroup}' not found`, 404)
          }
        } catch (describeError: any) {
          if (describeError.name === 'ResourceNotFoundException') {
            throw createError(`Log group '${params.logGroup}' not found`, 404)
          }
          throw describeError
        }

        // Query logs with filter pattern (keyword)
        const queryParams = {
          logGroupName: params.logGroup,
          startTime: params.startTime || Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
          endTime: params.endTime || Date.now(),
          filterPattern: params.filterPattern, // This will be the keyword
          limit: 100
        }
        
        logger.info('CloudWatch FilterLogEvents parameters', {
          ...queryParams,
          startTimeFormatted: new Date(queryParams.startTime).toISOString(),
          endTimeFormatted: new Date(queryParams.endTime).toISOString()
        })

        const command = new FilterLogEventsCommand(queryParams)
        const response = await client.send(command)
        
        logger.info('CloudWatch FilterLogEvents response', {
          eventsCount: response.events?.length || 0,
          nextToken: response.nextToken,
          searchedLogStreams: response.searchedLogStreams?.length || 0
        })
        
        this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:FilterLogEvents', true)

        const events = response.events?.map(event => ({
          timestamp: new Date(event.timestamp!).toISOString(),
          message: event.message,
          logStream: event.logStreamName
        })) || []

        logger.info('CloudWatch query completed', {
          accountId: params.accountId,
          eventsFound: events.length,
          logGroup: params.logGroup
        })

        return {
          success: true,
          events,
          nextToken: response.nextToken,
          summary: {
            totalEvents: events.length,
            logGroup: params.logGroup,
            filterPattern: params.filterPattern,
            timeRange: {
              start: new Date(params.startTime || Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date(params.endTime || Date.now()).toISOString()
            }
          }
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create CloudWatch Logs client
        const client = new CloudWatchLogsClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Query logs
        const command = new FilterLogEventsCommand({
          logGroupName: params.logGroup,
          startTime: params.startTime || Date.now() - 24 * 60 * 60 * 1000,
          endTime: params.endTime || Date.now(),
          filterPattern: params.filterPattern,
          limit: 100
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:FilterLogEvents', true)

        return {
          success: true,
          events: response.events?.map(event => ({
            timestamp: new Date(event.timestamp!).toISOString(),
            message: event.message,
            logStream: event.logStreamName
          })) || [],
          nextToken: response.nextToken
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:FilterLogEvents', false)
      logger.error('Failed to query CloudWatch logs', { 
        accountId: params.accountId,
        error: error.message,
        logGroup: params.logGroup
      })
      
      // Return more specific error messages
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Log group '${params.logGroup}' not found`, 404)
      } else if (error.name === 'InvalidParameterException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidClientTokenId') {
        throw createError('AWS credentials are invalid or not configured', 401)
      } else {
        throw createError(`CloudWatch query failed: ${error.message}`, 500)
      }
    }
  }

  /**
   * Query or scan DynamoDB table with real AWS SDK
   */
  async queryDynamoDB(params: {
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
  }): Promise<any> {
    logger.info('Querying DynamoDB', { 
      accountId: params.accountId,
      tableName: params.tableName,
      operation: params.operation,
      partitionKey: params.partitionKey,
      indexName: params.indexName,
      limit: params.limit
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create DynamoDB client with local credentials
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
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create DynamoDB client
        const client = new DynamoDBClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Similar logic as above but with role-based credentials
        // Implementation would be the same, just using different credentials
        
        // For now, return a placeholder
        return {
          success: false,
          message: 'Role-based DynamoDB operations not fully implemented'
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
      } else if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidClientTokenId') {
        throw createError('AWS credentials are invalid or not configured', 401)
      } else if (error.name === 'ProvisionedThroughputExceededException') {
        throw createError('Table throughput exceeded. Please try again later.', 429)
      } else {
        throw createError(`DynamoDB operation failed: ${error.message}`, 500)
      }
    }
  }

  async listS3Objects(params: any): Promise<any> {
    logger.info('Listing S3 objects', { params })
    
    // Mock implementation
    return {
      objects: [
        {
          key: 'logs/2024/01/15/app.log',
          size: 1024,
          lastModified: new Date().toISOString()
        },
        {
          key: 'logs/2024/01/15/error.log',
          size: 512,
          lastModified: new Date().toISOString()
        }
      ]
    }
  }

  async getS3Object(params: any): Promise<any> {
    logger.info('Getting S3 object', { params })
    
    // Mock implementation
    return {
      content: 'Sample S3 object content',
      contentType: 'text/plain',
      size: 1024
    }
  }

  /**
   * Explore S3 location - determine if it's a folder or object and return appropriate data
   */
  async exploreS3Location(params: {
    accountId: string
    s3Location: string
  }): Promise<any> {
    logger.info('Exploring S3 location', { 
      accountId: params.accountId,
      s3Location: params.s3Location
    })

    try {
      // Parse S3 location
      const s3Url = params.s3Location.startsWith('s3://') ? params.s3Location : `s3://${params.s3Location}`
      const urlParts = s3Url.replace('s3://', '').split('/')
      const bucket = urlParts[0]
      const key = urlParts.slice(1).join('/')

      if (!bucket) {
        throw createError('Invalid S3 location: bucket name is required', 400)
      }

      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create S3 client with local credentials
        const client = new S3Client({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // First, try to check if it's an object by attempting to get its metadata
        if (key && !key.endsWith('/')) {
          try {
            const headCommand = new GetObjectCommand({
              Bucket: bucket,
              Key: key
            })
            
            // Just get metadata, not the actual content
            const headResponse = await client.send(headCommand)
            
            this.credentialService.auditCredentialUsage(params.accountId, 's3:GetObject', true)

            // It's an object, return object details
            return {
              success: true,
              type: 'object',
              object: {
                bucket: bucket,
                key: key,
                size: headResponse.ContentLength,
                lastModified: headResponse.LastModified?.toISOString(),
                etag: headResponse.ETag?.replace(/"/g, ''),
                contentType: headResponse.ContentType,
                storageClass: headResponse.StorageClass,
                metadata: headResponse.Metadata || {}
              }
            }
          } catch (error: any) {
            // If GetObject fails, it might be a folder or the object doesn't exist
            // Continue to list objects
            logger.info('Object not found, treating as folder', { bucket, key })
          }
        }

        // It's a folder (bucket root or prefix), list contents
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: key || '',
          Delimiter: '/',
          MaxKeys: 1000
        })

        const listResponse = await client.send(listCommand)
        
        this.credentialService.auditCredentialUsage(params.accountId, 's3:ListObjectsV2', true)

        const items: any[] = []

        // Add folders (common prefixes)
        if (listResponse.CommonPrefixes) {
          listResponse.CommonPrefixes.forEach(prefix => {
            if (prefix.Prefix) {
              const folderName = prefix.Prefix.replace(key || '', '').replace('/', '')
              if (folderName) {
                items.push({
                  name: folderName,
                  type: 'folder',
                  fullPath: `s3://${bucket}/${prefix.Prefix}`
                })
              }
            }
          })
        }

        // Add objects
        if (listResponse.Contents) {
          listResponse.Contents.forEach(object => {
            if (object.Key && object.Key !== (key || '')) {
              const objectName = object.Key.replace(key || '', '').replace(/^\//, '')
              if (objectName && !objectName.includes('/')) {
                items.push({
                  name: objectName,
                  type: 'object',
                  size: object.Size,
                  lastModified: object.LastModified?.toISOString(),
                  etag: object.ETag?.replace(/"/g, ''),
                  storageClass: object.StorageClass,
                  fullPath: `s3://${bucket}/${object.Key}`
                })
              }
            }
          })
        }

        // Sort items: folders first, then objects, both alphabetically
        items.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        return {
          success: true,
          type: 'folder',
          bucket: bucket,
          prefix: key || '',
          items: items,
          truncated: listResponse.IsTruncated || false,
          nextContinuationToken: listResponse.NextContinuationToken
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create S3 client
        const client = new S3Client({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Similar logic as above but with role-based credentials
        // Implementation would be the same, just using different credentials
        
        // For now, return a placeholder
        return {
          success: false,
          message: 'Role-based S3 exploration not fully implemented'
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 's3:Explore', false)
      logger.error('Failed to explore S3 location', { 
        accountId: params.accountId,
        s3Location: params.s3Location,
        error: error.message
      })
      
      // Return more specific error messages
      if (error.name === 'NoSuchBucket') {
        throw createError(`Bucket '${params.s3Location}' does not exist`, 404)
      } else if (error.name === 'AccessDenied') {
        throw createError(`Access denied to S3 location '${params.s3Location}'`, 403)
      } else if (error.name === 'InvalidBucketName') {
        throw createError(`Invalid bucket name in '${params.s3Location}'`, 400)
      } else if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidClientTokenId') {
        throw createError('AWS credentials are invalid or not configured', 401)
      } else {
        throw createError(`S3 exploration failed: ${error.message}`, 500)
      }
    }
  }

  async invokeLambda(params: any): Promise<any> {
    logger.info('Invoking Lambda function', { params })
    
    // Mock implementation
    return {
      statusCode: 200,
      payload: {
        message: 'Lambda function executed successfully',
        result: 'Sample result data'
      },
      executionTime: 150
    }
  }

  async listLogGroups(): Promise<any> {
    logger.info('Listing CloudWatch log groups')

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create CloudWatch Logs client with local credentials
        const client = new CloudWatchLogsClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // List log groups
        const command = new DescribeLogGroupsCommand({
          limit: 50 // Get first 50 log groups
        })

        const response = await client.send(command)
        
        const logGroups = response.logGroups?.map(lg => ({
          name: lg.logGroupName,
          creationTime: lg.creationTime ? new Date(lg.creationTime).toISOString() : null,
          retentionInDays: lg.retentionInDays,
          storedBytes: lg.storedBytes
        })) || []

        logger.info('CloudWatch log groups listed', {
          count: logGroups.length
        })

        return {
          success: true,
          logGroups,
          count: logGroups.length
        }
      } else {
        // Use role-based credentials for production
        // Implementation would be similar but with role-based credentials
        return {
          success: false,
          message: 'Role-based credentials not implemented for log group listing'
        }
      }

    } catch (error: any) {
      logger.error('Failed to list CloudWatch log groups', { 
        error: error.message
      })
      
      throw createError(`Failed to list log groups: ${error.message}`, 500)
    }
  }

  async getAvailableRegions(): Promise<any> {
    logger.info('Getting available AWS regions')
    
    return {
      regions: [
        { code: 'us-east-1', name: 'US East (N. Virginia)' },
        { code: 'us-west-2', name: 'US West (Oregon)' },
        { code: 'eu-west-1', name: 'Europe (Ireland)' },
        { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' }
      ]
    }
  }

  /**
   * List EMR clusters
   */
  async listEMRClusters(params: {
    accountId: string
    states?: string[]
    clusterId?: string
    clusterName?: string
  }): Promise<any> {
    logger.info('Listing EMR clusters', { 
      accountId: params.accountId,
      states: params.states
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create EMR client with local credentials
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // List clusters
        const command = new ListClustersCommand({
          ClusterStates: (params.states as ClusterState[]) || [ClusterState.STARTING, ClusterState.BOOTSTRAPPING, ClusterState.RUNNING, ClusterState.WAITING]
        })

        const response = await client.send(command)
        
        let clusters = response.Clusters?.map(cluster => ({
          id: cluster.Id,
          name: cluster.Name,
          state: cluster.Status?.State,
          stateChangeReason: cluster.Status?.StateChangeReason?.Message,
          creationDateTime: cluster.Status?.Timeline?.CreationDateTime?.toISOString(),
          readyDateTime: cluster.Status?.Timeline?.ReadyDateTime?.toISOString(),
          normalizedInstanceHours: cluster.NormalizedInstanceHours
        })) || []

        // Filter by cluster ID if provided
        if (params.clusterId) {
          clusters = clusters.filter(cluster => 
            cluster.id?.toLowerCase().includes(params.clusterId!.toLowerCase())
          )
        }

        // Filter by cluster name if provided
        if (params.clusterName) {
          clusters = clusters.filter(cluster => 
            cluster.name?.toLowerCase().includes(params.clusterName!.toLowerCase())
          )
        }

        logger.info('EMR clusters listed', {
          accountId: params.accountId,
          count: clusters.length,
          filteredBy: {
            clusterId: params.clusterId,
            clusterName: params.clusterName
          }
        })

        this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListClusters', true)

        return {
          success: true,
          clusters,
          count: clusters.length,
          filters: {
            clusterId: params.clusterId,
            clusterName: params.clusterName,
            states: params.states
          }
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create EMR client
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // List clusters
        const command = new ListClustersCommand({
          ClusterStates: (params.states as ClusterState[]) || [ClusterState.STARTING, ClusterState.BOOTSTRAPPING, ClusterState.RUNNING, ClusterState.WAITING]
        })

        const response = await client.send(command)
        
        let clusters = response.Clusters?.map(cluster => ({
          id: cluster.Id,
          name: cluster.Name,
          state: cluster.Status?.State,
          stateChangeReason: cluster.Status?.StateChangeReason?.Message,
          creationDateTime: cluster.Status?.Timeline?.CreationDateTime?.toISOString(),
          readyDateTime: cluster.Status?.Timeline?.ReadyDateTime?.toISOString(),
          normalizedInstanceHours: cluster.NormalizedInstanceHours
        })) || []

        // Filter by cluster ID if provided
        if (params.clusterId) {
          clusters = clusters.filter(cluster => 
            cluster.id?.toLowerCase().includes(params.clusterId!.toLowerCase())
          )
        }

        // Filter by cluster name if provided
        if (params.clusterName) {
          clusters = clusters.filter(cluster => 
            cluster.name?.toLowerCase().includes(params.clusterName!.toLowerCase())
          )
        }
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListClusters', true)

        return {
          success: true,
          clusters,
          count: clusters.length,
          filters: {
            clusterId: params.clusterId,
            clusterName: params.clusterName,
            states: params.states
          }
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListClusters', false)
      logger.error('Failed to list EMR clusters', { 
        accountId: params.accountId,
        error: error.message
      })
      
      throw createError(`Failed to list EMR clusters: ${error.message}`, 500)
    }
  }

  /**
   * Describe EMR cluster
   */
  async describeEMRCluster(params: {
    accountId: string
    clusterId: string
  }): Promise<any> {
    logger.info('Describing EMR cluster', { 
      accountId: params.accountId,
      clusterId: params.clusterId
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create EMR client with local credentials
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Describe cluster
        const command = new DescribeClusterCommand({
          ClusterId: params.clusterId
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:DescribeCluster', true)

        const cluster = response.Cluster
        if (!cluster) {
          throw createError(`Cluster ${params.clusterId} not found`, 404)
        }

        return {
          success: true,
          cluster: {
            id: cluster.Id,
            name: cluster.Name,
            state: cluster.Status?.State,
            stateChangeReason: cluster.Status?.StateChangeReason?.Message,
            creationDateTime: cluster.Status?.Timeline?.CreationDateTime?.toISOString(),
            readyDateTime: cluster.Status?.Timeline?.ReadyDateTime?.toISOString(),
            endDateTime: cluster.Status?.Timeline?.EndDateTime?.toISOString(),
            normalizedInstanceHours: cluster.NormalizedInstanceHours,
            masterPublicDnsName: cluster.MasterPublicDnsName,
            applications: cluster.Applications?.map(app => ({
              name: app.Name,
              version: app.Version
            })) || [],
            ec2InstanceAttributes: {
              keyName: cluster.Ec2InstanceAttributes?.Ec2KeyName,
              instanceProfile: cluster.Ec2InstanceAttributes?.IamInstanceProfile,
              subnetId: cluster.Ec2InstanceAttributes?.Ec2SubnetId
            }
          }
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create EMR client
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Describe cluster
        const command = new DescribeClusterCommand({
          ClusterId: params.clusterId
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:DescribeCluster', true)

        return {
          success: true,
          cluster: response.Cluster
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:DescribeCluster', false)
      logger.error('Failed to describe EMR cluster', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        error: error.message
      })
      
      if (error.name === 'InvalidRequestException') {
        throw createError(`Cluster ${params.clusterId} not found`, 404)
      }
      
      throw createError(`Failed to describe EMR cluster: ${error.message}`, 500)
    }
  }

  /**
   * Add job flow steps to EMR cluster
   */
  async addEMRSteps(params: {
    accountId: string
    clusterId: string
    steps: Array<{
      name: string
      jar: string
      mainClass?: string
      args?: string[]
      actionOnFailure?: string
    }>
  }): Promise<any> {
    logger.info('Adding EMR steps', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      stepCount: params.steps.length
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create EMR client with local credentials
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Prepare steps
        const emrSteps = params.steps.map(step => ({
          Name: step.name,
          ActionOnFailure: (step.actionOnFailure as ActionOnFailure) || ActionOnFailure.CONTINUE,
          HadoopJarStep: {
            Jar: step.jar,
            MainClass: step.mainClass,
            Args: step.args || []
          }
        }))

        // Add steps
        const command = new AddJobFlowStepsCommand({
          JobFlowId: params.clusterId,
          Steps: emrSteps
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:AddJobFlowSteps', true)

        return {
          success: true,
          stepIds: response.StepIds || []
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create EMR client
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // Prepare and add steps
        const emrSteps = params.steps.map(step => ({
          Name: step.name,
          ActionOnFailure: (step.actionOnFailure as ActionOnFailure) || ActionOnFailure.CONTINUE,
          HadoopJarStep: {
            Jar: step.jar,
            MainClass: step.mainClass,
            Args: step.args || []
          }
        }))

        const command = new AddJobFlowStepsCommand({
          JobFlowId: params.clusterId,
          Steps: emrSteps
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:AddJobFlowSteps', true)

        return {
          success: true,
          stepIds: response.StepIds || []
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:AddJobFlowSteps', false)
      logger.error('Failed to add EMR steps', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        error: error.message
      })
      
      throw createError(`Failed to add EMR steps: ${error.message}`, 500)
    }
  }

  /**
   * List EMR steps for a cluster
   */
  async listEMRSteps(params: {
    accountId: string
    clusterId: string
    stepStates?: string[]
  }): Promise<any> {
    logger.info('Listing EMR steps', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      stepStates: params.stepStates
    })

    try {
      // For local development, use local credentials
      if (this.credentialService.shouldUseLocalCredentials()) {
        const credentials = await this.credentialService.getLocalCredentials()
        
        // Create EMR client with local credentials
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // List steps
        const command = new ListStepsCommand({
          ClusterId: params.clusterId,
          StepStates: params.stepStates as StepState[]
        })

        const response = await client.send(command)
        
        const steps = response.Steps?.map(step => ({
          id: step.Id,
          name: step.Name,
          state: step.Status?.State,
          stateChangeReason: step.Status?.StateChangeReason,
          creationDateTime: step.Status?.Timeline?.CreationDateTime?.toISOString(),
          startDateTime: step.Status?.Timeline?.StartDateTime?.toISOString(),
          endDateTime: step.Status?.Timeline?.EndDateTime?.toISOString(),
          actionOnFailure: step.ActionOnFailure,
          config: {
            jar: step.Config?.Jar,
            mainClass: step.Config?.MainClass,
            args: step.Config?.Args
          }
        })) || []

        this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListSteps', true)

        return {
          success: true,
          steps,
          count: steps.length
        }
      } else {
        // Use role-based credentials for production
        const account = await this.getAccountById(params.accountId)
        const credentials = await this.credentialService.refreshCredentialsIfNeeded(account)
        
        // Create EMR client
        const client = new EMRClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        // List steps
        const command = new ListStepsCommand({
          ClusterId: params.clusterId,
          StepStates: params.stepStates as StepState[]
        })

        const response = await client.send(command)
        
        this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListSteps', true)

        return {
          success: true,
          steps: response.Steps || []
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListSteps', false)
      logger.error('Failed to list EMR steps', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        error: error.message
      })
      
      throw createError(`Failed to list EMR steps: ${error.message}`, 500)
    }
  }

  /**
   * Get YARN Timeline Server applications for EMR cluster
   */
  async getEMRYarnApplications(params: {
    accountId: string
    clusterId: string
    limit?: number
    windowStart?: number
    windowEnd?: number
  }): Promise<any> {
    logger.info('Getting YARN applications for EMR cluster', { 
      accountId: params.accountId,
      clusterId: params.clusterId
    })

    try {
      // First get cluster info to get master DNS
      const clusterInfo = await this.describeEMRCluster({
        accountId: params.accountId,
        clusterId: params.clusterId
      })

      if (!clusterInfo.cluster.masterPublicDnsName) {
        throw createError('Cluster does not have a public DNS name. Timeline Server access requires a running cluster with public DNS.', 400)
      }

      const masterDns = clusterInfo.cluster.masterPublicDnsName
      const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION`
      
      // Build query parameters
      const queryParams = new URLSearchParams()
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.windowStart) queryParams.append('windowStart', params.windowStart.toString())
      if (params.windowEnd) queryParams.append('windowEnd', params.windowEnd.toString())
      
      const fullUrl = queryParams.toString() ? `${timelineUrl}?${queryParams}` : timelineUrl

      logger.info('Fetching YARN applications from Timeline Server', { 
        url: fullUrl,
        clusterId: params.clusterId
      })

      // Use fetch with AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Timeline Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as any
      
      const applications = data.entities?.map((app: any) => ({
        id: app.entity,
        type: app.entitytype,
        startTime: app.starttime ? new Date(app.starttime).toISOString() : null,
        events: app.events?.map((event: any) => ({
          eventType: event.eventtype,
          timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : null,
          eventInfo: event.eventinfo
        })) || [],
        primaryFilters: app.primaryfilters || {},
        otherInfo: app.otherinfo || {},
        relatedEntities: app.relatedentities || {}
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', true)

      return {
        success: true,
        clusterId: params.clusterId,
        masterDns: masterDns,
        applications,
        count: applications.length,
        timelineServerUrl: timelineUrl,
        queryParams: {
          limit: params.limit,
          windowStart: params.windowStart,
          windowEnd: params.windowEnd
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', false)
      logger.error('Failed to get YARN applications from Timeline Server', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        error: error.message
      })
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw createError('Unable to connect to YARN Timeline Server. Ensure the cluster is running and Timeline Server is accessible on port 8188.', 503)
      } else if (error.message.includes('timeout')) {
        throw createError('Timeline Server request timed out. The server may be overloaded or unresponsive.', 504)
      } else {
        throw createError(`Failed to get YARN applications: ${error.message}`, 500)
      }
    }
  }

  /**
   * Get specific YARN application details from Timeline Server
   */
  async getEMRYarnApplicationDetails(params: {
    accountId: string
    clusterId: string
    applicationId: string
  }): Promise<any> {
    logger.info('Getting YARN application details', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      applicationId: params.applicationId
    })

    try {
      // First get cluster info to get master DNS
      const clusterInfo = await this.describeEMRCluster({
        accountId: params.accountId,
        clusterId: params.clusterId
      })

      if (!clusterInfo.cluster.masterPublicDnsName) {
        throw createError('Cluster does not have a public DNS name', 400)
      }

      const masterDns = clusterInfo.cluster.masterPublicDnsName
      const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION/${params.applicationId}`

      // Use fetch with AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(timelineUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          throw createError(`Application ${params.applicationId} not found in Timeline Server`, 404)
        }
        throw new Error(`Timeline Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', true)

      return {
        success: true,
        clusterId: params.clusterId,
        applicationId: params.applicationId,
        application: data
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', false)
      logger.error('Failed to get YARN application details', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        applicationId: params.applicationId,
        error: error.message
      })
      
      throw createError(`Failed to get application details: ${error.message}`, error.statusCode || 500)
    }
  }
}
