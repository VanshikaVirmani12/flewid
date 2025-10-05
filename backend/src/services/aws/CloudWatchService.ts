import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs'
import { CloudWatchClient, DescribeAlarmsCommand, DescribeAlarmHistoryCommand } from '@aws-sdk/client-cloudwatch'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class CloudWatchService extends BaseAWSService {
  /**
   * Query CloudWatch logs with real AWS SDK
   */
  async queryLogs(params: {
    accountId: string
    logGroup: string
    query?: string
    startTime?: number
    endTime?: number
    filterPattern?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Querying CloudWatch logs', { 
      accountId: params.accountId,
      logGroup: params.logGroup,
      filterPattern: params.filterPattern,
      startTime: params.startTime,
      endTime: params.endTime
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create CloudWatch Logs client
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

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:FilterLogEvents', false)
      this.handleAWSError(error, 'CloudWatch query', params.logGroup)
    }
  }

  /**
   * List CloudWatch log groups
   */
  async listLogGroups(): Promise<any> {
    logger.info('Listing CloudWatch log groups')

    try {
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

    } catch (error: any) {
      logger.error('Failed to list CloudWatch log groups', { 
        error: error.message
      })
      
      throw createError(`Failed to list log groups: ${error.message}`, 500)
    }
  }

  /**
   * List CloudWatch alarms
   */
  async listAlarms(params: {
    accountId: string
    stateValue?: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA'
    actionPrefix?: string
    alarmNamePrefix?: string
    maxRecords?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing CloudWatch alarms', { 
      accountId: params.accountId,
      stateValue: params.stateValue,
      alarmNamePrefix: params.alarmNamePrefix,
      maxRecords: params.maxRecords
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create CloudWatch client
      const client = new CloudWatchClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Build describe alarms parameters
      const describeParams: any = {
        MaxRecords: params.maxRecords || 100
      }

      if (params.stateValue) {
        describeParams.StateValue = params.stateValue
      }

      if (params.actionPrefix) {
        describeParams.ActionPrefix = params.actionPrefix
      }

      if (params.alarmNamePrefix) {
        describeParams.AlarmNamePrefix = params.alarmNamePrefix
      }

      // List alarms
      const command = new DescribeAlarmsCommand(describeParams)
      const response = await client.send(command)
      
      const alarms = response.MetricAlarms?.map(alarm => ({
        alarmName: alarm.AlarmName,
        alarmArn: alarm.AlarmArn,
        alarmDescription: alarm.AlarmDescription,
        alarmConfigurationUpdatedTimestamp: alarm.AlarmConfigurationUpdatedTimestamp?.toISOString(),
        actionsEnabled: alarm.ActionsEnabled,
        okActions: alarm.OKActions || [],
        alarmActions: alarm.AlarmActions || [],
        insufficientDataActions: alarm.InsufficientDataActions || [],
        stateValue: alarm.StateValue,
        stateReason: alarm.StateReason,
        stateReasonData: alarm.StateReasonData,
        stateUpdatedTimestamp: alarm.StateUpdatedTimestamp?.toISOString(),
        metricName: alarm.MetricName,
        namespace: alarm.Namespace,
        statistic: alarm.Statistic,
        extendedStatistic: alarm.ExtendedStatistic,
        dimensions: alarm.Dimensions?.map(dim => ({
          name: dim.Name,
          value: dim.Value
        })) || [],
        period: alarm.Period,
        unit: alarm.Unit,
        evaluationPeriods: alarm.EvaluationPeriods,
        datapointsToAlarm: alarm.DatapointsToAlarm,
        threshold: alarm.Threshold,
        comparisonOperator: alarm.ComparisonOperator,
        treatMissingData: alarm.TreatMissingData,
        evaluateLowSampleCountPercentile: alarm.EvaluateLowSampleCountPercentile,
        thresholdMetricId: alarm.ThresholdMetricId
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:DescribeAlarms', true)

      logger.info('CloudWatch alarms listed', {
        accountId: params.accountId,
        count: alarms.length,
        stateValue: params.stateValue
      })

      return {
        success: true,
        alarms,
        count: alarms.length,
        nextToken: response.NextToken,
        filters: {
          stateValue: params.stateValue,
          alarmNamePrefix: params.alarmNamePrefix,
          actionPrefix: params.actionPrefix
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:DescribeAlarms', false)
      this.handleAWSError(error, 'CloudWatch list alarms')
    }
  }

  /**
   * Get CloudWatch alarm details and history
   */
  async getAlarmDetails(params: {
    accountId: string
    alarmName: string
    includeHistory?: boolean
    historyItemType?: 'ConfigurationUpdate' | 'StateUpdate' | 'Action'
    startDate?: string
    endDate?: string
    maxRecords?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting CloudWatch alarm details', { 
      accountId: params.accountId,
      alarmName: params.alarmName,
      includeHistory: params.includeHistory
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create CloudWatch client
      const client = new CloudWatchClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Get alarm details
      const describeCommand = new DescribeAlarmsCommand({
        AlarmNames: [params.alarmName]
      })

      const describeResponse = await client.send(describeCommand)
      
      if (!describeResponse.MetricAlarms || describeResponse.MetricAlarms.length === 0) {
        throw createError(`Alarm '${params.alarmName}' not found`, 404)
      }

      const alarm = describeResponse.MetricAlarms[0]
      
      let alarmHistory: any[] = []
      
      // Get alarm history if requested
      if (params.includeHistory) {
        const historyParams: any = {
          AlarmName: params.alarmName,
          MaxRecords: params.maxRecords || 50
        }

        if (params.historyItemType) {
          historyParams.HistoryItemType = params.historyItemType
        }

        if (params.startDate) {
          historyParams.StartDate = new Date(params.startDate)
        }

        if (params.endDate) {
          historyParams.EndDate = new Date(params.endDate)
        }

        const historyCommand = new DescribeAlarmHistoryCommand(historyParams)
        const historyResponse = await client.send(historyCommand)
        
        alarmHistory = historyResponse.AlarmHistoryItems?.map(item => ({
          alarmName: item.AlarmName,
          timestamp: item.Timestamp?.toISOString(),
          historyItemType: item.HistoryItemType,
          historySummary: item.HistorySummary,
          historyData: item.HistoryData
        })) || []
      }

      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:DescribeAlarms', true)
      if (params.includeHistory) {
        this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:DescribeAlarmHistory', true)
      }

      return {
        success: true,
        alarm: alarm,
        history: alarmHistory,
        historyCount: alarmHistory.length,
        includeHistory: params.includeHistory
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'cloudwatch:DescribeAlarms', false)
      this.handleAWSError(error, 'CloudWatch get alarm details', params.alarmName)
    }
  }
}
