import { SQSClient, ListQueuesCommand, GetQueueUrlCommand, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand, QueueAttributeName } from '@aws-sdk/client-sqs'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class SQSService extends BaseAWSService {
  /**
   * List SQS queues
   */
  async listQueues(params: {
    accountId: string
    queueNamePrefix?: string
    maxResults?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing SQS queues', { 
      accountId: params.accountId,
      queueNamePrefix: params.queueNamePrefix
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new ListQueuesCommand({
        QueueNamePrefix: params.queueNamePrefix,
        MaxResults: params.maxResults || 1000
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:ListQueues', true)

      const queues = response.QueueUrls || []
      
      // Extract queue names from URLs for better display
      const queueDetails = queues.map(url => {
        const urlParts = url.split('/')
        const queueName = urlParts[urlParts.length - 1]
        return {
          queueUrl: url,
          queueName: queueName,
          region: credentials.region
        }
      })

      return {
        success: true,
        queues: queueDetails,
        totalCount: queues.length,
        region: credentials.region
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:ListQueues', false)
      logger.error('Failed to list SQS queues', { 
        accountId: params.accountId,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS list queues')
    }
  }

  /**
   * Get queue URL by name
   */
  async getQueueUrl(params: {
    accountId: string
    queueName: string
    queueOwnerAWSAccountId?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting SQS queue URL', { 
      accountId: params.accountId,
      queueName: params.queueName
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new GetQueueUrlCommand({
        QueueName: params.queueName,
        QueueOwnerAWSAccountId: params.queueOwnerAWSAccountId
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:GetQueueUrl', true)

      return {
        success: true,
        queueUrl: response.QueueUrl,
        queueName: params.queueName,
        region: credentials.region
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:GetQueueUrl', false)
      logger.error('Failed to get SQS queue URL', { 
        accountId: params.accountId,
        queueName: params.queueName,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS get queue URL', params.queueName)
    }
  }

  /**
   * Get queue attributes
   */
  async getQueueAttributes(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    attributeNames?: string[]
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting SQS queue attributes', { 
      accountId: params.accountId,
      queueUrl: params.queueUrl,
      queueName: params.queueName
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Resolve queueName to queueUrl if needed
      let queueUrl = params.queueUrl
      if (!queueUrl && params.queueName) {
        const queueUrlResponse = await this.getQueueUrl({
          accountId: params.accountId,
          queueName: params.queueName
        }, accounts)
        queueUrl = queueUrlResponse.queueUrl
      }

      if (!queueUrl) {
        throw new Error('Either queueUrl or queueName must be provided')
      }

      const command = new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: (params.attributeNames as QueueAttributeName[]) || ['All' as QueueAttributeName]
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:GetQueueAttributes', true)

      return {
        success: true,
        attributes: response.Attributes || {},
        queueUrl: queueUrl
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:GetQueueAttributes', false)
      logger.error('Failed to get SQS queue attributes', { 
        accountId: params.accountId,
        queueUrl: params.queueUrl,
        queueName: params.queueName,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS get queue attributes', params.queueUrl || params.queueName)
    }
  }

  /**
   * Send message to queue
   */
  async sendMessage(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    messageBody: string
    delaySeconds?: number
    messageAttributes?: Record<string, any>
    messageGroupId?: string
    messageDeduplicationId?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Sending message to SQS queue', { 
      accountId: params.accountId,
      queueUrl: params.queueUrl,
      queueName: params.queueName,
      messageBodyLength: params.messageBody.length
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Resolve queueName to queueUrl if needed
      let queueUrl = params.queueUrl
      if (!queueUrl && params.queueName) {
        const queueUrlResponse = await this.getQueueUrl({
          accountId: params.accountId,
          queueName: params.queueName
        }, accounts)
        queueUrl = queueUrlResponse.queueUrl
      }

      if (!queueUrl) {
        throw new Error('Either queueUrl or queueName must be provided')
      }

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: params.messageBody,
        DelaySeconds: params.delaySeconds,
        MessageAttributes: params.messageAttributes,
        MessageGroupId: params.messageGroupId,
        MessageDeduplicationId: params.messageDeduplicationId
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:SendMessage', true)

      return {
        success: true,
        messageId: response.MessageId,
        md5OfBody: response.MD5OfMessageBody,
        md5OfMessageAttributes: response.MD5OfMessageAttributes,
        sequenceNumber: response.SequenceNumber,
        queueUrl: queueUrl
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:SendMessage', false)
      logger.error('Failed to send message to SQS queue', { 
        accountId: params.accountId,
        queueUrl: params.queueUrl,
        queueName: params.queueName,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS send message', params.queueUrl || params.queueName)
    }
  }

  /**
   * Receive messages from queue
   */
  async receiveMessages(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    maxNumberOfMessages?: number
    visibilityTimeoutSeconds?: number
    waitTimeSeconds?: number
    attributeNames?: string[]
    messageAttributeNames?: string[]
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Receiving messages from SQS queue', { 
      accountId: params.accountId,
      queueUrl: params.queueUrl,
      queueName: params.queueName,
      maxNumberOfMessages: params.maxNumberOfMessages
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Resolve queueName to queueUrl if needed
      let queueUrl = params.queueUrl
      if (!queueUrl && params.queueName) {
        const queueUrlResponse = await this.getQueueUrl({
          accountId: params.accountId,
          queueName: params.queueName
        }, accounts)
        queueUrl = queueUrlResponse.queueUrl
      }

      if (!queueUrl) {
        throw new Error('Either queueUrl or queueName must be provided')
      }

      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: params.maxNumberOfMessages || 10,
        VisibilityTimeout: params.visibilityTimeoutSeconds,
        WaitTimeSeconds: params.waitTimeSeconds || 0,
        AttributeNames: params.attributeNames as QueueAttributeName[],
        MessageAttributeNames: params.messageAttributeNames
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:ReceiveMessage', true)

      const messages = response.Messages || []

      return {
        success: true,
        messages: messages.map(msg => ({
          messageId: msg.MessageId,
          receiptHandle: msg.ReceiptHandle,
          body: msg.Body,
          attributes: msg.Attributes || {},
          messageAttributes: msg.MessageAttributes || {},
          md5OfBody: msg.MD5OfBody,
          md5OfMessageAttributes: msg.MD5OfMessageAttributes
        })),
        messageCount: messages.length,
        queueUrl: queueUrl
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:ReceiveMessage', false)
      logger.error('Failed to receive messages from SQS queue', { 
        accountId: params.accountId,
        queueUrl: params.queueUrl,
        queueName: params.queueName,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS receive messages', params.queueUrl || params.queueName)
    }
  }

  /**
   * Delete message from queue
   */
  async deleteMessage(params: {
    accountId: string
    queueUrl: string
    receiptHandle: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Deleting message from SQS queue', { 
      accountId: params.accountId,
      queueUrl: params.queueUrl
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      const command = new DeleteMessageCommand({
        QueueUrl: params.queueUrl,
        ReceiptHandle: params.receiptHandle
      })

      await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:DeleteMessage', true)

      return {
        success: true,
        queueUrl: params.queueUrl,
        message: 'Message deleted successfully'
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:DeleteMessage', false)
      logger.error('Failed to delete message from SQS queue', { 
        accountId: params.accountId,
        queueUrl: params.queueUrl,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS delete message', params.queueUrl)
    }
  }

  /**
   * Poll messages from queue (continuous polling)
   */
  async pollMessages(params: {
    accountId: string
    queueUrl?: string
    queueName?: string
    maxNumberOfMessages?: number
    visibilityTimeoutSeconds?: number
    waitTimeSeconds?: number
    pollDurationSeconds?: number
    attributeNames?: string[]
    messageAttributeNames?: string[]
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Starting SQS queue polling', { 
      accountId: params.accountId,
      queueUrl: params.queueUrl,
      queueName: params.queueName,
      maxNumberOfMessages: params.maxNumberOfMessages,
      pollDurationSeconds: params.pollDurationSeconds
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      const client = new SQSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Resolve queueName to queueUrl if needed
      let queueUrl = params.queueUrl
      if (!queueUrl && params.queueName) {
        const queueUrlResponse = await this.getQueueUrl({
          accountId: params.accountId,
          queueName: params.queueName
        }, accounts)
        queueUrl = queueUrlResponse.queueUrl
      }

      if (!queueUrl) {
        throw new Error('Either queueUrl or queueName must be provided')
      }

      const allMessages: any[] = []
      const startTime = Date.now()
      const pollDuration = (params.pollDurationSeconds || 30) * 1000 // Convert to milliseconds
      const maxTotalMessages = params.maxNumberOfMessages || 10 // Total limit across all polls
      let pollCount = 0

      while (Date.now() - startTime < pollDuration && allMessages.length < maxTotalMessages) {
        pollCount++
        
        // Calculate how many more messages we can receive
        const remainingMessages = maxTotalMessages - allMessages.length
        const messagesPerPoll = Math.min(remainingMessages, 10) // SQS max per request is 10
        
        const command = new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: messagesPerPoll,
          VisibilityTimeout: params.visibilityTimeoutSeconds,
          WaitTimeSeconds: params.waitTimeSeconds || 5, // Use long polling by default
          AttributeNames: params.attributeNames as QueueAttributeName[],
          MessageAttributeNames: params.messageAttributeNames
        })

        const response = await client.send(command)
        const messages = response.Messages || []

        if (messages.length > 0) {
          const formattedMessages = messages.map(msg => ({
            messageId: msg.MessageId,
            receiptHandle: msg.ReceiptHandle,
            body: msg.Body,
            attributes: msg.Attributes || {},
            messageAttributes: msg.MessageAttributes || {},
            md5OfBody: msg.MD5OfBody,
            md5OfMessageAttributes: msg.MD5OfMessageAttributes,
            receivedAt: new Date().toISOString(),
            pollIteration: pollCount
          }))

          // Only add messages up to the limit
          const messagesToAdd = formattedMessages.slice(0, remainingMessages)
          allMessages.push(...messagesToAdd)
          
          // If we've reached the limit, break out of the loop
          if (allMessages.length >= maxTotalMessages) {
            break
          }
        }

        // If no messages were received and we're using long polling, 
        // we can break early as the queue is likely empty
        if (messages.length === 0 && (params.waitTimeSeconds || 0) > 0) {
          break
        }

        // Small delay between polls if no wait time is set
        if (!params.waitTimeSeconds || params.waitTimeSeconds === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:PollMessages', true)

      return {
        success: true,
        messages: allMessages,
        totalMessages: allMessages.length,
        maxRequestedMessages: maxTotalMessages,
        pollIterations: pollCount,
        pollDurationSeconds: Math.round((Date.now() - startTime) / 1000),
        limitReached: allMessages.length >= maxTotalMessages,
        queueUrl: queueUrl
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'sqs:PollMessages', false)
      logger.error('Failed to poll messages from SQS queue', { 
        accountId: params.accountId,
        queueUrl: params.queueUrl,
        queueName: params.queueName,
        error: error.message
      })
      
      this.handleAWSError(error, 'SQS poll messages', params.queueUrl || params.queueName)
    }
  }
}
