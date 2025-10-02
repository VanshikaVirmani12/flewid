import { STSClient, AssumeRoleCommand, Credentials, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
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
    logger.info('Getting local AWS credentials')

    try {
      // Use default credential provider chain
      const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers')
      const credentialProvider = fromNodeProviderChain()
      const credentials = await credentialProvider()

      // Validate credentials before returning
      const awsCredentials: AWSCredentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        region: region
      }

      // Test the credentials to ensure they're valid
      const isValid = await this.validateCredentials(awsCredentials)
      if (!isValid) {
        throw new Error('Local credentials are invalid or expired')
      }

      logger.info('Successfully retrieved and validated local AWS credentials')
      return awsCredentials

    } catch (error: any) {
      logger.error('Failed to get local AWS credentials', { error: error.message })
      
      // Provide more specific error messages
      if (error.message.includes('ExpiredToken') || error.message.includes('TokenRefreshRequired')) {
        throw createError('AWS credentials have expired. Please refresh your AWS credentials using "aws sso login" or update your AWS credentials.', 401)
      } else if (error.message.includes('NoCredentialsError')) {
        throw createError('No AWS credentials found. Please configure AWS credentials using "aws configure" or set up AWS SSO.', 401)
      } else if (error.message.includes('invalid') || error.message.includes('expired')) {
        throw createError('AWS credentials are invalid or expired. Please refresh your credentials.', 401)
      } else {
        throw createError(`Failed to get local AWS credentials: ${error.message}`, 403)
      }
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
        
        // Validate cached credentials before using them
        const isValid = await this.validateCredentials(cached.credentials)
        if (isValid) {
          return cached.credentials
        } else {
          logger.warn('Cached credentials are invalid, removing from cache', { accountId: account.id })
          this.credentialsCache.delete(account.id)
        }
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
      
      if (error.message.includes('ExpiredToken')) {
        throw createError('Base AWS credentials have expired. Please refresh your AWS credentials.', 401)
      } else if (error.message.includes('AccessDenied')) {
        throw createError(`Access denied when assuming role ${account.roleArn}. Check IAM permissions.`, 403)
      } else {
        throw createError(`Failed to assume role: ${error.message}`, 403)
      }
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
      await testSts.send(new GetCallerIdentityCommand({}))
      
      logger.info('AWS credentials validated successfully')
      return true

    } catch (error: any) {
      logger.warn('AWS credentials validation failed', { 
        error: error.message,
        errorName: error.name 
      })
      
      // Log specific error types for debugging
      if (error.name === 'ExpiredToken' || error.name === 'TokenRefreshRequired') {
        logger.warn('Credentials have expired')
      } else if (error.name === 'InvalidClientTokenId') {
        logger.warn('Invalid access key ID')
      } else if (error.name === 'SignatureDoesNotMatch') {
        logger.warn('Invalid secret access key')
      }
      
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

    // Even if cached credentials aren't expired, validate them
    const isValid = await this.validateCredentials(cached.credentials)
    if (!isValid) {
      logger.info('Cached credentials are invalid, refreshing', { accountId: account.id })
      this.credentialsCache.delete(account.id)
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

  /**
   * Check credential status and provide helpful information
   */
  async checkCredentialStatus(): Promise<{
    isValid: boolean
    provider: string
    expiresAt?: Date
    identity?: any
    error?: string
  }> {
    try {
      if (this.shouldUseLocalCredentials()) {
        const credentials = await this.getLocalCredentials()
        
        // Get caller identity for additional info
        const testSts = new STSClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
          }
        })

        const identity = await testSts.send(new GetCallerIdentityCommand({}))
        
        return {
          isValid: true,
          provider: 'local',
          identity: {
            userId: identity.UserId,
            account: identity.Account,
            arn: identity.Arn
          }
        }
      } else {
        return {
          isValid: false,
          provider: 'role-based',
          error: 'Role-based credentials not implemented for status check'
        }
      }
    } catch (error: any) {
      return {
        isValid: false,
        provider: this.shouldUseLocalCredentials() ? 'local' : 'role-based',
        error: error.message
      }
    }
  }
}
