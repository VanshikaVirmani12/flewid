import { SNSClient, PublishCommand, ListTopicsCommand, CreateTopicCommand, DeleteTopicCommand, SubscribeCommand, UnsubscribeCommand, ListSubscriptionsCommand, ListSubscriptionsByTopicCommand, GetTopicAttributesCommand, SetTopicAttributesCommand, PublishBatchCommand } from '@aws-sdk/client-sns'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class SNSService extends BaseAWSService {
  /**
   * Publish a message to SNS topic or phone number
   */
  async publishMessage(params: {
    accountId: string
    topicArn?: string
    phoneNumber?: string
    targetArn?: string
    message: string
    subject?: string
    messageAttributes?: Record<string, any>
    messageStructure?: string
    messageDeduplicationId?: string
    messageGroupId?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Publishing SNS message', { 
      accountId: params.accountId,
      topicArn: params.topicArn,
      phoneNumber: params.phoneNumber,
      targetArn: params.targetArn,
      hasSubject: !!params.subject,
      messageLength: params.message.length
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Validate that at least one target is provided
      if (!params.topicArn && !params.phoneNumber && !params.targetArn) {
        throw new Error('Either topicArn, phoneNumber, or targetArn must be provided')
      }

      // Format message attributes for SNS
      let messageAttributes: Record<string, any> = {}
      if (params.messageAttributes) {
        for (const [key, value] of Object.entries(params.messageAttributes)) {
          if (typeof value === 'string') {
            messageAttributes[key] = {
              DataType: 'String',
              StringValue: value
            }
          } else if (typeof value === 'number') {
            messageAttributes[key] = {
              DataType: 'Number',
              StringValue: value.toString()
            }
          } else if (typeof value === 'object' && value.DataType) {
            // Already formatted
            messageAttributes[key] = value
          }
        }
      }

      const command = new PublishCommand({
        TopicArn: params.topicArn,
        PhoneNumber: params.phoneNumber,
        TargetArn: params.targetArn,
        Message: params.message,
        Subject: params.subject,
        MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
        MessageStructure: params.messageStructure,
        MessageDeduplicationId: params.messageDeduplicationId,
        MessageGroupId: params.messageGroupId
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:Publish', true)

      return {
        success: true,
        messageId: response.MessageId,
        sequenceNumber: response.SequenceNumber,
        target: params.topicArn || params.phoneNumber || params.targetArn,
        subject: params.subject,
        messageLength: params.message.length
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:Publish', false)
      logger.error('Failed to publish SNS message', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        phoneNumber: params.phoneNumber,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS message publish', params.topicArn || params.phoneNumber)
    }
  }

  /**
   * Publish multiple messages in batch (FIFO topics only)
   */
  async publishBatch(params: {
    accountId: string
    topicArn: string
    messages: Array<{
      id: string
      message: string
      subject?: string
      messageAttributes?: Record<string, any>
      messageDeduplicationId?: string
      messageGroupId?: string
    }>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Publishing SNS batch messages', { 
      accountId: params.accountId,
      topicArn: params.topicArn,
      messageCount: params.messages.length
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Format messages for batch publish
      const publishRequestEntries = params.messages.map(msg => {
        let messageAttributes: Record<string, any> = {}
        if (msg.messageAttributes) {
          for (const [key, value] of Object.entries(msg.messageAttributes)) {
            if (typeof value === 'string') {
              messageAttributes[key] = {
                DataType: 'String',
                StringValue: value
              }
            } else if (typeof value === 'number') {
              messageAttributes[key] = {
                DataType: 'Number',
                StringValue: value.toString()
              }
            }
          }
        }

        return {
          Id: msg.id,
          Message: msg.message,
          Subject: msg.subject,
          MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
          MessageDeduplicationId: msg.messageDeduplicationId,
          MessageGroupId: msg.messageGroupId
        }
      })

      const command = new PublishBatchCommand({
        TopicArn: params.topicArn,
        PublishBatchRequestEntries: publishRequestEntries
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:PublishBatch', true)

      return {
        success: true,
        successful: response.Successful || [],
        failed: response.Failed || [],
        topicArn: params.topicArn,
        totalMessages: params.messages.length,
        successCount: response.Successful?.length || 0,
        failureCount: response.Failed?.length || 0
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:PublishBatch', false)
      logger.error('Failed to publish SNS batch messages', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS batch message publish', params.topicArn)
    }
  }

  /**
   * List SNS topics
   */
  async listTopics(params: {
    accountId: string
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing SNS topics', { 
      accountId: params.accountId
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListTopicsCommand({
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:ListTopics', true)

      const topics = response.Topics || []

      return {
        success: true,
        topics: topics.map(topic => ({
          topicArn: topic.TopicArn,
          name: topic.TopicArn?.split(':').pop()
        })),
        nextToken: response.NextToken,
        totalCount: topics.length
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:ListTopics', false)
      logger.error('Failed to list SNS topics', { 
        accountId: params.accountId,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS list topics')
    }
  }

  /**
   * Create SNS topic
   */
  async createTopic(params: {
    accountId: string
    name: string
    attributes?: Record<string, string>
    tags?: Record<string, string>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Creating SNS topic', { 
      accountId: params.accountId,
      name: params.name
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Format tags for SNS
      let tags: Array<{ Key: string; Value: string }> = []
      if (params.tags) {
        tags = Object.entries(params.tags).map(([key, value]) => ({
          Key: key,
          Value: value
        }))
      }

      const command = new CreateTopicCommand({
        Name: params.name,
        Attributes: params.attributes,
        Tags: tags.length > 0 ? tags : undefined
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:CreateTopic', true)

      return {
        success: true,
        topicArn: response.TopicArn,
        name: params.name
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:CreateTopic', false)
      logger.error('Failed to create SNS topic', { 
        accountId: params.accountId,
        name: params.name,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS topic creation', params.name)
    }
  }

  /**
   * Delete SNS topic
   */
  async deleteTopic(params: {
    accountId: string
    topicArn: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Deleting SNS topic', { 
      accountId: params.accountId,
      topicArn: params.topicArn
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new DeleteTopicCommand({
        TopicArn: params.topicArn
      })

      await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:DeleteTopic', true)

      return {
        success: true,
        topicArn: params.topicArn,
        message: 'Topic deleted successfully'
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:DeleteTopic', false)
      logger.error('Failed to delete SNS topic', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS topic deletion', params.topicArn)
    }
  }

  /**
   * Subscribe to SNS topic
   */
  async subscribe(params: {
    accountId: string
    topicArn: string
    protocol: 'email' | 'email-json' | 'sms' | 'sqs' | 'application' | 'lambda' | 'firehose' | 'http' | 'https'
    endpoint: string
    attributes?: Record<string, string>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Subscribing to SNS topic', { 
      accountId: params.accountId,
      topicArn: params.topicArn,
      protocol: params.protocol,
      endpoint: params.endpoint
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new SubscribeCommand({
        TopicArn: params.topicArn,
        Protocol: params.protocol,
        Endpoint: params.endpoint,
        Attributes: params.attributes
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:Subscribe', true)

      return {
        success: true,
        subscriptionArn: response.SubscriptionArn,
        topicArn: params.topicArn,
        protocol: params.protocol,
        endpoint: params.endpoint
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:Subscribe', false)
      logger.error('Failed to subscribe to SNS topic', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        protocol: params.protocol,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS subscription', params.topicArn)
    }
  }

  /**
   * List subscriptions for a topic
   */
  async listSubscriptionsByTopic(params: {
    accountId: string
    topicArn: string
    nextToken?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing SNS subscriptions by topic', { 
      accountId: params.accountId,
      topicArn: params.topicArn
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListSubscriptionsByTopicCommand({
        TopicArn: params.topicArn,
        NextToken: params.nextToken
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:ListSubscriptionsByTopic', true)

      const subscriptions = response.Subscriptions || []

      return {
        success: true,
        subscriptions: subscriptions.map(sub => ({
          subscriptionArn: sub.SubscriptionArn,
          topicArn: sub.TopicArn,
          protocol: sub.Protocol,
          endpoint: sub.Endpoint,
          owner: sub.Owner
        })),
        nextToken: response.NextToken,
        totalCount: subscriptions.length,
        topicArn: params.topicArn
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:ListSubscriptionsByTopic', false)
      logger.error('Failed to list SNS subscriptions by topic', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS list subscriptions by topic', params.topicArn)
    }
  }

  /**
   * Get topic attributes
   */
  async getTopicAttributes(params: {
    accountId: string
    topicArn: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting SNS topic attributes', { 
      accountId: params.accountId,
      topicArn: params.topicArn
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SNSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new GetTopicAttributesCommand({
        TopicArn: params.topicArn
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:GetTopicAttributes', true)

      return {
        success: true,
        topicArn: params.topicArn,
        attributes: response.Attributes || {},
        name: params.topicArn.split(':').pop(),
        subscriptionsConfirmed: response.Attributes?.SubscriptionsConfirmed || '0',
        subscriptionsPending: response.Attributes?.SubscriptionsPending || '0',
        subscriptionsDeleted: response.Attributes?.SubscriptionsDeleted || '0'
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sns:GetTopicAttributes', false)
      logger.error('Failed to get SNS topic attributes', { 
        accountId: params.accountId,
        topicArn: params.topicArn,
        error: error.message
      })
      
      this.handleAWSError(error, 'SNS get topic attributes', params.topicArn)
    }
  }
}
