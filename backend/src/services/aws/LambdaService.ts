import { LambdaClient, InvokeCommand, GetFunctionCommand, UpdateFunctionCodeCommand, PublishVersionCommand, ListVersionsByFunctionCommand, GetFunctionConfigurationCommand, ListFunctionsCommand } from '@aws-sdk/client-lambda'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class LambdaService extends BaseAWSService {
  /**
   * List Lambda functions
   */
  async listFunctions(params: {
    accountId: string
    functionName?: string
    maxItems?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing Lambda functions', { 
      accountId: params.accountId,
      functionName: params.functionName,
      maxItems: params.maxItems
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List functions
      const command = new ListFunctionsCommand({
        MaxItems: params.maxItems || 50
      })

      const response = await client.send(command)
      
      let functions = response.Functions?.map(func => ({
        functionName: func.FunctionName,
        functionArn: func.FunctionArn,
        runtime: func.Runtime,
        role: func.Role,
        handler: func.Handler,
        codeSize: func.CodeSize,
        description: func.Description,
        timeout: func.Timeout,
        memorySize: func.MemorySize,
        lastModified: func.LastModified,
        codeSha256: func.CodeSha256,
        version: func.Version,
        environment: func.Environment,
        deadLetterConfig: func.DeadLetterConfig,
        kmsKeyArn: func.KMSKeyArn,
        tracingConfig: func.TracingConfig,
        layers: func.Layers?.map(layer => ({
          arn: layer.Arn,
          codeSize: layer.CodeSize
        })) || [],
        state: func.State,
        stateReason: func.StateReason,
        lastUpdateStatus: func.LastUpdateStatus,
        packageType: func.PackageType,
        architectures: func.Architectures
      })) || []

      // Filter by function name if provided
      if (params.functionName) {
        functions = functions.filter(func => 
          func.functionName?.toLowerCase().includes(params.functionName!.toLowerCase())
        )
      }

      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:ListFunctions', true)

      return {
        success: true,
        functions,
        count: functions.length,
        filters: {
          functionName: params.functionName
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:ListFunctions', false)
      this.handleAWSError(error, 'Lambda list functions')
    }
  }

  /**
   * Get Lambda function details
   */
  async getFunction(params: {
    accountId: string
    functionName: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting Lambda function details', { 
      accountId: params.accountId,
      functionName: params.functionName
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Get function details
      const command = new GetFunctionCommand({
        FunctionName: params.functionName
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:GetFunction', true)

      return {
        success: true,
        function: {
          configuration: response.Configuration,
          code: response.Code,
          tags: response.Tags,
          concurrency: response.Concurrency
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:GetFunction', false)
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Lambda function '${params.functionName}' not found`, 404)
      }
      this.handleAWSError(error, 'Lambda get function', params.functionName)
    }
  }

  /**
   * Invoke Lambda function
   */
  async invokeFunction(params: {
    accountId: string
    functionName: string
    payload?: string
    invocationType?: 'RequestResponse' | 'Event' | 'DryRun'
    logType?: 'None' | 'Tail'
    clientContext?: string
    qualifier?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Invoking Lambda function', { 
      accountId: params.accountId,
      functionName: params.functionName,
      invocationType: params.invocationType,
      logType: params.logType
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Prepare payload
      let payloadBuffer: Uint8Array | undefined
      if (params.payload && params.payload.trim() !== '') {
        try {
          // Validate JSON if provided
          JSON.parse(params.payload.trim())
          payloadBuffer = new TextEncoder().encode(params.payload.trim())
        } catch (error) {
          throw createError('Invalid JSON payload provided', 400)
        }
      }

      // Invoke function - only include Payload if we have one
      const invokeParams: any = {
        FunctionName: params.functionName,
        InvocationType: params.invocationType || 'RequestResponse',
        LogType: params.logType || 'None'
      }

      if (payloadBuffer) {
        invokeParams.Payload = payloadBuffer
      }

      if (params.clientContext) {
        invokeParams.ClientContext = params.clientContext
      }

      if (params.qualifier) {
        invokeParams.Qualifier = params.qualifier
      }

      const command = new InvokeCommand(invokeParams)

      const startTime = Date.now()
      const response = await client.send(command)
      const duration = Date.now() - startTime
      
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:InvokeFunction', true)

      // Parse response payload
      let responsePayload: any = null
      if (response.Payload) {
        try {
          const payloadString = new TextDecoder().decode(response.Payload)
          responsePayload = JSON.parse(payloadString)
        } catch (error) {
          // If not JSON, return as string
          responsePayload = new TextDecoder().decode(response.Payload)
        }
      }

      // Parse log result if available
      let logResult: string | null = null
      if (response.LogResult) {
        try {
          logResult = Buffer.from(response.LogResult, 'base64').toString('utf-8')
        } catch (error) {
          logResult = response.LogResult
        }
      }

      return {
        success: true,
        statusCode: response.StatusCode,
        functionError: response.FunctionError,
        logResult: logResult,
        payload: responsePayload,
        executedVersion: response.ExecutedVersion,
        duration: duration,
        invocationType: params.invocationType || 'RequestResponse',
        timestamp: new Date().toISOString()
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:InvokeFunction', false)
      
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Lambda function '${params.functionName}' not found`, 404)
      } else if (error.name === 'InvalidParameterValueException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else if (error.name === 'TooManyRequestsException') {
        throw createError('Too many requests. Please try again later.', 429)
      } else if (error.name === 'ServiceException') {
        throw createError('Lambda service error. Please try again later.', 503)
      }
      
      this.handleAWSError(error, 'Lambda invoke function', params.functionName)
    }
  }

  /**
   * Update Lambda function code from S3
   */
  async updateFunctionCodeFromS3(params: {
    accountId: string
    functionName: string
    s3Bucket: string
    s3Key: string
    s3ObjectVersion?: string
    dryRun?: boolean
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Updating Lambda function code from S3', { 
      accountId: params.accountId,
      functionName: params.functionName,
      s3Bucket: params.s3Bucket,
      s3Key: params.s3Key,
      dryRun: params.dryRun
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate S3 location format
      if (!params.s3Bucket || !params.s3Key) {
        throw createError('S3 bucket and key are required', 400)
      }

      // If dry run, just validate the function exists and return
      if (params.dryRun) {
        const getFunctionCommand = new GetFunctionConfigurationCommand({
          FunctionName: params.functionName
        })
        
        await client.send(getFunctionCommand)
        
        return {
          success: true,
          dryRun: true,
          message: `Function '${params.functionName}' exists and can be updated`,
          s3Location: `s3://${params.s3Bucket}/${params.s3Key}`
        }
      }

      // Update function code
      const updateParams: any = {
        FunctionName: params.functionName,
        S3Bucket: params.s3Bucket,
        S3Key: params.s3Key
      }

      if (params.s3ObjectVersion) {
        updateParams.S3ObjectVersion = params.s3ObjectVersion
      }

      const command = new UpdateFunctionCodeCommand(updateParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:UpdateFunctionCode', true)

      return {
        success: true,
        functionName: response.FunctionName,
        functionArn: response.FunctionArn,
        version: response.Version,
        lastModified: response.LastModified,
        codeSha256: response.CodeSha256,
        codeSize: response.CodeSize,
        state: response.State,
        stateReason: response.StateReason,
        lastUpdateStatus: response.LastUpdateStatus,
        lastUpdateStatusReason: response.LastUpdateStatusReason,
        s3Location: `s3://${params.s3Bucket}/${params.s3Key}`,
        timestamp: new Date().toISOString()
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:UpdateFunctionCode', false)
      
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Lambda function '${params.functionName}' not found`, 404)
      } else if (error.name === 'InvalidParameterValueException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else if (error.name === 'CodeStorageExceededException') {
        throw createError('Code storage limit exceeded', 413)
      } else if (error.name === 'TooManyRequestsException') {
        throw createError('Too many requests. Please try again later.', 429)
      } else if (error.name === 'ResourceConflictException') {
        throw createError('Function is being updated. Please wait and try again.', 409)
      }
      
      this.handleAWSError(error, 'Lambda update function code', params.functionName)
    }
  }

  /**
   * Publish a new version of Lambda function
   */
  async publishVersion(params: {
    accountId: string
    functionName: string
    description?: string
    revisionId?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Publishing Lambda function version', { 
      accountId: params.accountId,
      functionName: params.functionName,
      description: params.description
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Publish version
      const publishParams: any = {
        FunctionName: params.functionName
      }

      if (params.description) {
        publishParams.Description = params.description
      }

      if (params.revisionId) {
        publishParams.RevisionId = params.revisionId
      }

      const command = new PublishVersionCommand(publishParams)
      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:PublishVersion', true)

      return {
        success: true,
        functionName: response.FunctionName,
        functionArn: response.FunctionArn,
        version: response.Version,
        description: response.Description,
        lastModified: response.LastModified,
        codeSha256: response.CodeSha256,
        codeSize: response.CodeSize,
        state: response.State,
        stateReason: response.StateReason,
        revisionId: response.RevisionId,
        timestamp: new Date().toISOString()
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:PublishVersion', false)
      
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Lambda function '${params.functionName}' not found`, 404)
      } else if (error.name === 'InvalidParameterValueException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      } else if (error.name === 'TooManyRequestsException') {
        throw createError('Too many requests. Please try again later.', 429)
      } else if (error.name === 'ResourceConflictException') {
        throw createError('Function is being updated. Please wait and try again.', 409)
      } else if (error.name === 'PreconditionFailedException') {
        throw createError('Revision ID does not match. Function may have been updated by another process.', 412)
      }
      
      this.handleAWSError(error, 'Lambda publish version', params.functionName)
    }
  }

  /**
   * List versions of a Lambda function
   */
  async listVersions(params: {
    accountId: string
    functionName: string
    maxItems?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing Lambda function versions', { 
      accountId: params.accountId,
      functionName: params.functionName,
      maxItems: params.maxItems
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create Lambda client
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List versions
      const command = new ListVersionsByFunctionCommand({
        FunctionName: params.functionName,
        MaxItems: params.maxItems || 50
      })

      const response = await client.send(command)
      
      const versions = response.Versions?.map(version => ({
        functionName: version.FunctionName,
        functionArn: version.FunctionArn,
        version: version.Version,
        description: version.Description,
        lastModified: version.LastModified,
        codeSha256: version.CodeSha256,
        codeSize: version.CodeSize,
        state: version.State,
        stateReason: version.StateReason,
        revisionId: version.RevisionId,
        runtime: version.Runtime,
        timeout: version.Timeout,
        memorySize: version.MemorySize,
        handler: version.Handler
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:ListVersionsByFunction', true)

      return {
        success: true,
        functionName: params.functionName,
        versions,
        count: versions.length,
        nextMarker: response.NextMarker
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'lambda:ListVersionsByFunction', false)
      
      if (error.name === 'ResourceNotFoundException') {
        throw createError(`Lambda function '${params.functionName}' not found`, 404)
      } else if (error.name === 'InvalidParameterValueException') {
        throw createError(`Invalid parameters: ${error.message}`, 400)
      }
      
      this.handleAWSError(error, 'Lambda list versions', params.functionName)
    }
  }
}
