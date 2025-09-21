import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts'
import { createCipher, createDecipher } from 'crypto'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

export interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  expiration?: Date
  region: string
}

export interface AWSAccount {
  id: string
  name: string
  roleArn: string
  externalId: string
  region: string
  encryptedCredentials?: string
  lastUsed?: Date
  isActive: boolean
}

export class AWSCredentialService {
  private stsClient: STSClient
  private encryptionKey: string
  private credentialsCache: Map<string, { credentials: AWSCredentials; expiry: Date }> = new Map()

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
    this.stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' })
  }

  /**
   * Get local AWS credentials from environment/profile
   * For development and same-account deployments
   */
  async getLocalCredentials(region: string = 'us-east-1'): Promise<AWSCredentials> {
    logger.info('Using local AWS credentials')

    try {
      // Use default credential provider chain
      const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers')
      const credentialProvider = fromNodeProviderChain()
      const credentials = await credentialProvider()

      return {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        region: region
      }

    } catch (error: any) {
      logger.error('Failed to get local AWS credentials', { error: error.message })
      throw createError(`Failed to get local AWS credentials: ${error.message}`, 403)
    }
  }

  /**
   * Check if we should use local credentials
   */
  shouldUseLocalCredentials(): boolean {
    return process.env.AWS_USE_LOCAL_CREDENTIALS === 'true'
  }

  /**
   * Assume role and get temporary credentials
   */
  async assumeRole(account: AWSAccount): Promise<AWSCredentials> {
    logger.info('Assuming AWS role', { 
      accountId: account.id, 
      roleArn: account.roleArn 
    })

    try {
      // Check cache first
      const cached = this.credentialsCache.get(account.id)
      if (cached && cached.expiry > new Date()) {
        logger.info('Using cached credentials', { accountId: account.id })
        return cached.credentials
      }

      const command = new AssumeRoleCommand({
        RoleArn: account.roleArn,
        RoleSessionName: `flowid-session-${Date.now()}`,
        ExternalId: account.externalId,
        DurationSeconds: 3600, // 1 hour
      })

      const response = await this.stsClient.send(command)
      
      if (!response.Credentials) {
        throw createError('Failed to assume role - no credentials returned', 500)
      }

      const credentials: AWSCredentials = {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!,
        expiration: response.Credentials.Expiration,
        region: account.region
      }

      // Cache credentials (expire 5 minutes before AWS expiry)
      const cacheExpiry = new Date(credentials.expiration!.getTime() - 5 * 60 * 1000)
      this.credentialsCache.set(account.id, {
        credentials,
        expiry: cacheExpiry
      })

      logger.info('Successfully assumed role', { 
        accountId: account.id,
        expiration: credentials.expiration 
      })

      return credentials

    } catch (error: any) {
      logger.error('Failed to assume role', { 
        accountId: account.id,
        error: error.message 
      })
      throw createError(`Failed to assume role: ${error.message}`, 403)
    }
  }

  /**
   * Encrypt AWS credentials for storage
   */
  encryptCredentials(credentials: AWSCredentials): string {
    try {
      const cipher = createCipher('aes-256-cbc', this.encryptionKey)
      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return encrypted
    } catch (error: any) {
      logger.error('Failed to encrypt credentials', { error: error.message })
      throw createError('Failed to encrypt credentials', 500)
    }
  }

  /**
   * Decrypt AWS credentials from storage
   */
  decryptCredentials(encryptedCredentials: string): AWSCredentials {
    try {
      const decipher = createDecipher('aes-256-cbc', this.encryptionKey)
      let decrypted = decipher.update(encryptedCredentials, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return JSON.parse(decrypted)
    } catch (error: any) {
      logger.error('Failed to decrypt credentials', { error: error.message })
      throw createError('Failed to decrypt credentials', 500)
    }
  }

  /**
   * Validate AWS credentials by making a test call
   */
  async validateCredentials(credentials: AWSCredentials): Promise<boolean> {
    try {
      const testSts = new STSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Test credentials with GetCallerIdentity
      const { GetCallerIdentityCommand } = await import('@aws-sdk/client-sts')
      await testSts.send(new GetCallerIdentityCommand({}))
      
      logger.info('AWS credentials validated successfully')
      return true

    } catch (error: any) {
      logger.warn('AWS credentials validation failed', { error: error.message })
      return false
    }
  }

  /**
   * Refresh credentials if they're about to expire
   */
  async refreshCredentialsIfNeeded(account: AWSAccount): Promise<AWSCredentials> {
    const cached = this.credentialsCache.get(account.id)
    
    if (!cached || cached.expiry <= new Date()) {
      logger.info('Refreshing expired credentials', { accountId: account.id })
      return await this.assumeRole(account)
    }

    return cached.credentials
  }

  /**
   * Clear cached credentials (for security)
   */
  clearCredentialsCache(accountId?: string): void {
    if (accountId) {
      this.credentialsCache.delete(accountId)
      logger.info('Cleared cached credentials for account', { accountId })
    } else {
      this.credentialsCache.clear()
      logger.info('Cleared all cached credentials')
    }
  }

  /**
   * Get account information from role ARN
   */
  parseRoleArn(roleArn: string): { accountId: string; roleName: string } {
    const arnParts = roleArn.split(':')
    if (arnParts.length !== 6 || arnParts[0] !== 'arn' || arnParts[1] !== 'aws') {
      throw createError('Invalid role ARN format', 400)
    }

    const accountId = arnParts[4]
    const roleName = arnParts[5].split('/')[1]

    return { accountId, roleName }
  }

  /**
   * Generate secure external ID
   */
  generateExternalId(): string {
    const crypto = require('crypto')
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Audit log for credential usage
   */
  auditCredentialUsage(accountId: string, action: string, success: boolean): void {
    logger.info('AWS credential usage audit', {
      accountId,
      action,
      success,
      timestamp: new Date().toISOString(),
      userAgent: 'flowid-backend'
    })
  }
}
