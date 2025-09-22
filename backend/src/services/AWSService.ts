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

  async queryDynamoDB(params: any): Promise<any> {
    logger.info('Querying DynamoDB', { params })
    
    // Mock implementation
    return {
      items: [
        {
          id: 'item-1',
          data: 'Sample DynamoDB item 1',
          timestamp: new Date().toISOString()
        },
        {
          id: 'item-2',
          data: 'Sample DynamoDB item 2',
          timestamp: new Date().toISOString()
        }
      ],
      count: 2
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
}
