import { AWSCredentialService, AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export abstract class BaseAWSService {
  protected credentialService: AWSCredentialService

  constructor(credentialService: AWSCredentialService) {
    this.credentialService = credentialService
  }

  /**
   * Get AWS account by ID
   */
  protected async getAccountById(accountId: string, accounts: Map<string, AWSAccount>): Promise<AWSAccount> {
    const account = accounts.get(accountId)
    if (!account) {
      throw createError(`AWS account ${accountId} not found`, 404)
    }
    return account
  }

  /**
   * Get AWS credentials for local or role-based access
   */
  protected async getCredentials(accountId: string, accounts: Map<string, AWSAccount>) {
    if (this.credentialService.shouldUseLocalCredentials()) {
      return await this.credentialService.getLocalCredentials()
    } else {
      const account = await this.getAccountById(accountId, accounts)
      return await this.credentialService.refreshCredentialsIfNeeded(account)
    }
  }

  /**
   * Handle common AWS errors
   */
  protected handleAWSError(error: any, operation: string, resourceName?: string): never {
    logger.error(`AWS ${operation} failed`, { error: error.message, resourceName })
    
    if (error.name === 'ResourceNotFoundException') {
      const message = resourceName ? `${resourceName} not found` : 'Resource not found'
      throw createError(message, 404)
    } else if (error.name === 'AccessDeniedException') {
      const message = resourceName ? `Access denied to ${resourceName}` : 'Access denied'
      throw createError(message, 403)
    } else if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidClientTokenId') {
      throw createError('AWS credentials are invalid or not configured', 401)
    } else if (error.name === 'ValidationException' || error.name === 'InvalidParameterValueException') {
      throw createError(`Invalid parameters: ${error.message}`, 400)
    } else if (error.name === 'TooManyRequestsException') {
      throw createError('Too many requests. Please try again later.', 429)
    } else {
      throw createError(`${operation} failed: ${error.message}`, 500)
    }
  }
}
