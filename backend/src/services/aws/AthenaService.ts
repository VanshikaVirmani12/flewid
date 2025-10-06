import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand, ListQueryExecutionsCommand, StopQueryExecutionCommand, GetDataCatalogCommand, ListDataCatalogsCommand, ListDatabasesCommand, ListTableMetadataCommand } from '@aws-sdk/client-athena'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class AthenaService extends BaseAWSService {
  /**
   * Execute a query in Athena
   */
  async executeQuery(params: {
    accountId: string
    queryString: string
    database: string
    outputLocation: string
    workGroup?: string
    queryExecutionContext?: Record<string, any>
    resultConfiguration?: Record<string, any>
    clientRequestToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Executing Athena query', { 
      accountId: params.accountId,
      database: params.database,
      workGroup: params.workGroup,
      queryLength: params.queryString.length
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Start query execution
      const startCommand = new StartQueryExecutionCommand({
        QueryString: params.queryString,
        QueryExecutionContext: {
          Database: params.database,
          ...params.queryExecutionContext
        },
        ResultConfiguration: {
          OutputLocation: params.outputLocation,
          ...params.resultConfiguration
        },
        WorkGroup: params.workGroup,
        ClientRequestToken: params.clientRequestToken
      })

      const startResponse = await client.send(startCommand)
      const queryExecutionId = startResponse.QueryExecutionId

      if (!queryExecutionId) {
        throw new Error('Failed to start query execution - no execution ID returned')
      }

      logger.info('Query execution started', { 
        queryExecutionId,
        accountId: params.accountId
      })

      // Poll for completion
      let status = 'RUNNING'
      let attempts = 0
      const maxAttempts = 150 // 5 minutes with 2-second intervals
      
      while ((status === 'RUNNING' || status === 'QUEUED') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
        
        const statusCommand = new GetQueryExecutionCommand({ 
          QueryExecutionId: queryExecutionId 
        })
        const statusResponse = await client.send(statusCommand)
        status = statusResponse.QueryExecution?.Status?.State || 'FAILED'
        
        logger.debug('Query execution status check', { 
          queryExecutionId,
          status,
          attempt: attempts
        })
      }

      if (attempts >= maxAttempts) {
        throw new Error('Query execution timed out after 5 minutes')
      }

      this.credentialService.auditCredentialUsage(params.accountId, 'athena:StartQueryExecution', true)

      if (status === 'SUCCEEDED') {
        // Get results
        const resultsCommand = new GetQueryResultsCommand({ 
          QueryExecutionId: queryExecutionId,
          MaxResults: 1000 // Limit results for performance
        })
        const resultsResponse = await client.send(resultsCommand)
        
        const rows = resultsResponse.ResultSet?.Rows || []
        const columnInfo = resultsResponse.ResultSet?.ResultSetMetadata?.ColumnInfo || []
        
        // Format results for better display
        const formattedResults = rows.map((row, index) => {
          const rowData: Record<string, any> = {}
          row.Data?.forEach((cell, cellIndex) => {
            const columnName = columnInfo[cellIndex]?.Name || `column_${cellIndex}`
            rowData[columnName] = cell.VarCharValue || null
          })
          return {
            rowNumber: index,
            data: rowData
          }
        })

        // Get final execution details
        const finalStatusCommand = new GetQueryExecutionCommand({ 
          QueryExecutionId: queryExecutionId 
        })
        const finalStatusResponse = await client.send(finalStatusCommand)
        const executionDetails = finalStatusResponse.QueryExecution

        return {
          success: true,
          queryExecutionId,
          status: 'SUCCEEDED',
          results: formattedResults,
          columnInfo: columnInfo.map(col => ({
            name: col.Name,
            type: col.Type,
            label: col.Label
          })),
          resultCount: rows.length,
          executionTimeMs: executionDetails?.Statistics?.EngineExecutionTimeInMillis || 0,
          dataScannedBytes: executionDetails?.Statistics?.DataScannedInBytes || 0,
          outputLocation: executionDetails?.ResultConfiguration?.OutputLocation,
          workGroup: executionDetails?.WorkGroup,
          database: params.database
        }
      } else {
        // Get error details
        const errorCommand = new GetQueryExecutionCommand({ 
          QueryExecutionId: queryExecutionId 
        })
        const errorResponse = await client.send(errorCommand)
        const errorReason = errorResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error'
        
        throw new Error(`Query failed with status ${status}: ${errorReason}`)
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:StartQueryExecution', false)
      logger.error('Failed to execute Athena query', { 
        accountId: params.accountId,
        database: params.database,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena query execution')
    }
  }

  /**
   * Get query execution details
   */
  async getQueryExecution(params: {
    accountId: string
    queryExecutionId: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting Athena query execution details', { 
      accountId: params.accountId,
      queryExecutionId: params.queryExecutionId
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new GetQueryExecutionCommand({
        QueryExecutionId: params.queryExecutionId
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:GetQueryExecution', true)

      const execution = response.QueryExecution
      if (!execution) {
        throw new Error('Query execution not found')
      }

      return {
        success: true,
        queryExecution: {
          queryExecutionId: execution.QueryExecutionId,
          query: execution.Query,
          status: execution.Status?.State,
          stateChangeReason: execution.Status?.StateChangeReason,
          submissionDateTime: execution.Status?.SubmissionDateTime,
          completionDateTime: execution.Status?.CompletionDateTime,
          database: execution.QueryExecutionContext?.Database,
          workGroup: execution.WorkGroup,
          executionTimeMs: execution.Statistics?.EngineExecutionTimeInMillis || 0,
          dataScannedBytes: execution.Statistics?.DataScannedInBytes || 0,
          outputLocation: execution.ResultConfiguration?.OutputLocation
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:GetQueryExecution', false)
      logger.error('Failed to get Athena query execution', { 
        accountId: params.accountId,
        queryExecutionId: params.queryExecutionId,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena get query execution', params.queryExecutionId)
    }
  }

  /**
   * List query executions
   */
  async listQueryExecutions(params: {
    accountId: string
    workGroup?: string
    maxResults?: number
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing Athena query executions', { 
      accountId: params.accountId,
      workGroup: params.workGroup,
      maxResults: params.maxResults
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListQueryExecutionsCommand({
        WorkGroup: params.workGroup,
        MaxResults: params.maxResults || 50,
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListQueryExecutions', true)

      return {
        success: true,
        queryExecutionIds: response.QueryExecutionIds || [],
        nextToken: response.NextToken,
        totalCount: response.QueryExecutionIds?.length || 0
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListQueryExecutions', false)
      logger.error('Failed to list Athena query executions', { 
        accountId: params.accountId,
        workGroup: params.workGroup,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena list query executions')
    }
  }

  /**
   * Stop query execution
   */
  async stopQueryExecution(params: {
    accountId: string
    queryExecutionId: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Stopping Athena query execution', { 
      accountId: params.accountId,
      queryExecutionId: params.queryExecutionId
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new StopQueryExecutionCommand({
        QueryExecutionId: params.queryExecutionId
      })

      await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:StopQueryExecution', true)

      return {
        success: true,
        queryExecutionId: params.queryExecutionId,
        message: 'Query execution stopped successfully'
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:StopQueryExecution', false)
      logger.error('Failed to stop Athena query execution', { 
        accountId: params.accountId,
        queryExecutionId: params.queryExecutionId,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena stop query execution', params.queryExecutionId)
    }
  }

  /**
   * List databases in a data catalog
   */
  async listDatabases(params: {
    accountId: string
    catalogName?: string
    maxResults?: number
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing Athena databases', { 
      accountId: params.accountId,
      catalogName: params.catalogName
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListDatabasesCommand({
        CatalogName: params.catalogName || 'AwsDataCatalog',
        MaxResults: params.maxResults || 50,
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListDatabases', true)

      const databases = response.DatabaseList || []

      return {
        success: true,
        databases: databases.map(db => ({
          name: db.Name,
          description: db.Description,
          parameters: db.Parameters
        })),
        nextToken: response.NextToken,
        totalCount: databases.length,
        catalogName: params.catalogName || 'AwsDataCatalog'
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListDatabases', false)
      logger.error('Failed to list Athena databases', { 
        accountId: params.accountId,
        catalogName: params.catalogName,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena list databases')
    }
  }

  /**
   * List tables in a database
   */
  async listTables(params: {
    accountId: string
    catalogName?: string
    databaseName: string
    expression?: string
    maxResults?: number
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing Athena tables', { 
      accountId: params.accountId,
      catalogName: params.catalogName,
      databaseName: params.databaseName
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListTableMetadataCommand({
        CatalogName: params.catalogName || 'AwsDataCatalog',
        DatabaseName: params.databaseName,
        Expression: params.expression,
        MaxResults: params.maxResults || 50,
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListTableMetadata', true)

      const tables = response.TableMetadataList || []

      return {
        success: true,
        tables: tables.map(table => ({
          name: table.Name,
          tableType: table.TableType,
          columns: table.Columns?.map(col => ({
            name: col.Name,
            type: col.Type,
            comment: col.Comment
          })) || [],
          partitionKeys: table.PartitionKeys?.map(key => ({
            name: key.Name,
            type: key.Type,
            comment: key.Comment
          })) || [],
          parameters: table.Parameters,
          createTime: table.CreateTime,
          lastAccessTime: table.LastAccessTime
        })),
        nextToken: response.NextToken,
        totalCount: tables.length,
        catalogName: params.catalogName || 'AwsDataCatalog',
        databaseName: params.databaseName
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:ListTableMetadata', false)
      logger.error('Failed to list Athena tables', { 
        accountId: params.accountId,
        catalogName: params.catalogName,
        databaseName: params.databaseName,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena list tables')
    }
  }

  /**
   * Get query results
   */
  async getQueryResults(params: {
    accountId: string
    queryExecutionId: string
    maxResults?: number
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting Athena query results', { 
      accountId: params.accountId,
      queryExecutionId: params.queryExecutionId,
      maxResults: params.maxResults
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new AthenaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new GetQueryResultsCommand({
        QueryExecutionId: params.queryExecutionId,
        MaxResults: params.maxResults || 1000,
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:GetQueryResults', true)

      const rows = response.ResultSet?.Rows || []
      const columnInfo = response.ResultSet?.ResultSetMetadata?.ColumnInfo || []
      
      // Format results for better display
      const formattedResults = rows.map((row, index) => {
        const rowData: Record<string, any> = {}
        row.Data?.forEach((cell, cellIndex) => {
          const columnName = columnInfo[cellIndex]?.Name || `column_${cellIndex}`
          rowData[columnName] = cell.VarCharValue || null
        })
        return {
          rowNumber: index,
          data: rowData
        }
      })

      return {
        success: true,
        queryExecutionId: params.queryExecutionId,
        results: formattedResults,
        columnInfo: columnInfo.map(col => ({
          name: col.Name,
          type: col.Type,
          label: col.Label
        })),
        resultCount: rows.length,
        nextToken: response.NextToken
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'athena:GetQueryResults', false)
      logger.error('Failed to get Athena query results', { 
        accountId: params.accountId,
        queryExecutionId: params.queryExecutionId,
        error: error.message
      })
      
      this.handleAWSError(error, 'Athena get query results', params.queryExecutionId)
    }
  }
}
