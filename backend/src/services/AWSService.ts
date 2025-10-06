import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { AWSCredentialService, AWSCredentials, AWSAccount } from './AWSCredentialService'

// Import all the individual AWS services
import { CloudWatchService } from './aws/CloudWatchService'
import { DynamoDBService } from './aws/DynamoDBService'
import { S3Service } from './aws/S3Service'
import { LambdaService } from './aws/LambdaService'
import { EMRService } from './aws/EMRService'
import { APIGatewayService } from './aws/APIGatewayService'
import { SQSService } from './aws/SQSService'
import { AthenaService } from './aws/AthenaService'

export class AWSService {
  private credentialService: AWSCredentialService
  private accounts: Map<string, AWSAccount> = new Map()

  // Individual service instances
  private cloudWatchService: CloudWatchService
  private dynamoDBService: DynamoDBService
  private s3Service: S3Service
  private lambdaService: LambdaService
  private emrService: EMRService
  private apiGatewayService: APIGatewayService
  private sqsService: SQSService
  private athenaService: AthenaService

  constructor() {
    this.credentialService = new AWSCredentialService()
    this.initializeMockAccounts()

    // Initialize all service instances
    this.cloudWatchService = new CloudWatchService(this.credentialService)
    this.dynamoDBService = new DynamoDBService(this.credentialService)
    this.s3Service = new S3Service(this.credentialService)
    this.lambdaService = new LambdaService(this.credentialService)
    this.emrService = new EMRService(this.credentialService)
    this.apiGatewayService = new APIGatewayService(this.credentialService)
    this.sqsService = new SQSService(this.credentialService)
    this.athenaService = new AthenaService(this.credentialService)
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

  // CloudWatch methods
  async queryCloudWatchLogs(params: {
    accountId: string
    logGroup: string
    query?: string
    startTime?: number
    endTime?: number
    filterPattern?: string
  }): Promise<any> {
    return this.cloudWatchService.queryLogs(params, this.accounts)
  }

  async listLogGroups(): Promise<any> {
    return this.cloudWatchService.listLogGroups()
  }

  async listCloudWatchAlarms(params: {
    accountId: string
    stateValue?: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA'
    actionPrefix?: string
    alarmNamePrefix?: string
    maxRecords?: number
  }): Promise<any> {
    return this.cloudWatchService.listAlarms(params, this.accounts)
  }

  async getCloudWatchAlarmDetails(params: {
    accountId: string
    alarmName: string
    includeHistory?: boolean
    historyItemType?: 'ConfigurationUpdate' | 'StateUpdate' | 'Action'
    startDate?: string
    endDate?: string
    maxRecords?: number
  }): Promise<any> {
    return this.cloudWatchService.getAlarmDetails(params, this.accounts)
  }

  // DynamoDB methods
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
    return this.dynamoDBService.queryTable(params, this.accounts)
  }

  // S3 methods
  async listS3Objects(params: any): Promise<any> {
    return this.s3Service.listObjects(params)
  }

  async getS3Object(params: any): Promise<any> {
    return this.s3Service.getObject(params)
  }

  async exploreS3Location(params: {
    accountId: string
    s3Location: string
  }): Promise<any> {
    return this.s3Service.exploreLocation(params, this.accounts)
  }

  // Lambda methods
  async listLambdaFunctions(params: {
    accountId: string
    functionName?: string
    maxItems?: number
  }): Promise<any> {
    return this.lambdaService.listFunctions(params, this.accounts)
  }

  async getLambdaFunction(params: {
    accountId: string
    functionName: string
  }): Promise<any> {
    return this.lambdaService.getFunction(params, this.accounts)
  }

  async invokeLambda(params: {
    accountId: string
    functionName: string
    payload?: string
    invocationType?: 'RequestResponse' | 'Event' | 'DryRun'
    logType?: 'None' | 'Tail'
    clientContext?: string
    qualifier?: string
  }): Promise<any> {
    return this.lambdaService.invokeFunction(params, this.accounts)
  }

  async updateLambdaCodeFromS3(params: {
    accountId: string
    functionName: string
    s3Bucket: string
    s3Key: string
    s3ObjectVersion?: string
    dryRun?: boolean
  }): Promise<any> {
    return this.lambdaService.updateFunctionCodeFromS3(params, this.accounts)
  }

  async publishLambdaVersion(params: {
    accountId: string
    functionName: string
    description?: string
    revisionId?: string
  }): Promise<any> {
    return this.lambdaService.publishVersion(params, this.accounts)
  }

  async listLambdaVersions(params: {
    accountId: string
    functionName: string
    maxItems?: number
  }): Promise<any> {
    return this.lambdaService.listVersions(params, this.accounts)
  }

  // EMR methods
  async listEMRClusters(params: {
    accountId: string
    states?: string[]
    clusterId?: string
    clusterName?: string
  }): Promise<any> {
    return this.emrService.listClusters(params, this.accounts)
  }

  async describeEMRCluster(params: {
    accountId: string
    clusterId: string
  }): Promise<any> {
    return this.emrService.describeCluster(params, this.accounts)
  }

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
    return this.emrService.addSteps(params, this.accounts)
  }

  async listEMRSteps(params: {
    accountId: string
    clusterId: string
    stepStates?: string[]
  }): Promise<any> {
    return this.emrService.listSteps(params, this.accounts)
  }

  async getEMRYarnApplications(params: {
    accountId: string
    clusterId: string
    limit?: number
    windowStart?: number
    windowEnd?: number
  }): Promise<any> {
    return this.emrService.getYarnApplications(params, this.accounts)
  }

  async getEMRYarnApplicationDetails(params: {
    accountId: string
    clusterId: string
    applicationId: string
  }): Promise<any> {
    return this.emrService.getYarnApplicationDetails(params, this.accounts)
  }

  // API Gateway methods
  async listAPIGatewayAPIs(params: {
    accountId: string
    limit?: number
  }): Promise<any> {
    return this.apiGatewayService.listAPIs(params, this.accounts)
  }

  async listAPIGatewayStages(params: {
    accountId: string
    apiId: string
  }): Promise<any> {
    return this.apiGatewayService.listStages(params, this.accounts)
  }

  async analyzeAPIGateway(params: {
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
  }): Promise<any> {
    return this.apiGatewayService.analyze(params, this.accounts)
  }

  // SQS methods
  async listSQSQueues(params: {
    accountId: string
    queueNamePrefix?: string
    maxResults?: number
  }): Promise<any> {
    return this.sqsService.listQueues(params, this.accounts)
  }

  async getSQSQueueUrl(params: {
    accountId: string
    queueName: string
    queueOwnerAWSAccountId?: string
  }): Promise<any> {
    return this.sqsService.getQueueUrl(params, this.accounts)
  }

  async getSQSQueueAttributes(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    attributeNames?: string[]
  }): Promise<any> {
    return this.sqsService.getQueueAttributes(params, this.accounts)
  }

  async sendSQSMessage(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    messageBody: string
    delaySeconds?: number
    messageAttributes?: Record<string, any>
    messageGroupId?: string
    messageDeduplicationId?: string
  }): Promise<any> {
    return this.sqsService.sendMessage(params, this.accounts)
  }

  async receiveSQSMessages(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    maxNumberOfMessages?: number
    visibilityTimeoutSeconds?: number
    waitTimeSeconds?: number
    attributeNames?: string[]
    messageAttributeNames?: string[]
  }): Promise<any> {
    return this.sqsService.receiveMessages(params, this.accounts)
  }

  async deleteSQSMessage(params: {
    accountId: string
    queueUrl: string
    receiptHandle: string
  }): Promise<any> {
    return this.sqsService.deleteMessage(params, this.accounts)
  }

  async pollSQSMessages(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    maxNumberOfMessages?: number
    visibilityTimeoutSeconds?: number
    waitTimeSeconds?: number
    pollDurationSeconds?: number
    attributeNames?: string[]
    messageAttributeNames?: string[]
  }): Promise<any> {
    return this.sqsService.pollMessages(params, this.accounts)
  }

  // Athena methods
  async executeAthenaQuery(params: {
    accountId: string
    queryString: string
    database: string
    outputLocation: string
    workGroup?: string
    queryExecutionContext?: Record<string, any>
    resultConfiguration?: Record<string, any>
    clientRequestToken?: string
  }): Promise<any> {
    return this.athenaService.executeQuery(params, this.accounts)
  }

  async getAthenaQueryExecution(params: {
    accountId: string
    queryExecutionId: string
  }): Promise<any> {
    return this.athenaService.getQueryExecution(params, this.accounts)
  }

  async listAthenaQueryExecutions(params: {
    accountId: string
    workGroup?: string
    maxResults?: number
    nextToken?: string
  }): Promise<any> {
    return this.athenaService.listQueryExecutions(params, this.accounts)
  }

  async stopAthenaQueryExecution(params: {
    accountId: string
    queryExecutionId: string
  }): Promise<any> {
    return this.athenaService.stopQueryExecution(params, this.accounts)
  }

  async listAthenaDatabases(params: {
    accountId: string
    catalogName?: string
    maxResults?: number
    nextToken?: string
  }): Promise<any> {
    return this.athenaService.listDatabases(params, this.accounts)
  }

  async listAthenaTables(params: {
    accountId: string
    catalogName?: string
    databaseName: string
    expression?: string
    maxResults?: number
    nextToken?: string
  }): Promise<any> {
    return this.athenaService.listTables(params, this.accounts)
  }

  async getAthenaQueryResults(params: {
    accountId: string
    queryExecutionId: string
    maxResults?: number
    nextToken?: string
  }): Promise<any> {
    return this.athenaService.getQueryResults(params, this.accounts)
  }

  // Utility methods
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
}
