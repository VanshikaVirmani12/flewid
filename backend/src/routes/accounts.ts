import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AWSCredentialService, AWSAccount } from '../services/AWSCredentialService'
import { logger } from '../utils/logger'

const router = Router()
const credentialService = new AWSCredentialService()

// In-memory storage for demo (use database in production)
const accounts: Map<string, AWSAccount> = new Map()

// GET /api/accounts - Get all AWS accounts
router.get('/', asyncHandler(async (req, res) => {
  const accountList = Array.from(accounts.values()).map(account => ({
    ...account,
    encryptedCredentials: undefined // Don't expose encrypted credentials
  }))
  
  res.json({
    accounts: accountList,
    count: accountList.length
  })
}))

// POST /api/accounts - Add new AWS account
router.post('/', asyncHandler(async (req, res) => {
  const { name, roleArn, region } = req.body

  // Validate required fields
  if (!name || !roleArn || !region) {
    return res.status(400).json({
      error: 'Missing required fields: name, roleArn, region'
    })
  }

  // Validate role ARN format
  try {
    credentialService.parseRoleArn(roleArn)
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid role ARN format'
    })
  }

  // Generate secure external ID
  const externalId = credentialService.generateExternalId()
  
  const account: AWSAccount = {
    id: `account-${Date.now()}`,
    name,
    roleArn,
    externalId,
    region,
    isActive: true,
    lastUsed: new Date()
  }

  accounts.set(account.id, account)

  logger.info('AWS account added', { 
    accountId: account.id, 
    name: account.name,
    roleArn: account.roleArn 
  })

  res.status(201).json({
    account: {
      ...account,
      encryptedCredentials: undefined
    },
    setupInstructions: {
      message: 'Create an IAM role in your AWS account with the following trust policy',
      trustPolicy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              AWS: 'arn:aws:iam::FLOWID-ACCOUNT:role/FlowIdExecutionRole'
            },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: {
                'sts:ExternalId': externalId
              }
            }
          }
        ]
      }
    }
  })
}))

// POST /api/accounts/:id/test - Test AWS account connection
router.post('/:id/test', asyncHandler(async (req, res) => {
  const account = accounts.get(req.params.id)
  
  if (!account) {
    return res.status(404).json({
      error: 'Account not found'
    })
  }

  try {
    // Try to assume role and validate credentials
    const credentials = await credentialService.assumeRole(account)
    const isValid = await credentialService.validateCredentials(credentials)

    if (isValid) {
      // Update last used timestamp
      account.lastUsed = new Date()
      accounts.set(account.id, account)

      res.json({
        success: true,
        message: 'AWS account connection successful',
        accountInfo: {
          accountId: credentialService.parseRoleArn(account.roleArn).accountId,
          region: account.region,
          lastTested: account.lastUsed
        }
      })
    } else {
      res.status(403).json({
        success: false,
        error: 'Failed to validate AWS credentials'
      })
    }

  } catch (error: any) {
    logger.error('AWS account test failed', { 
      accountId: account.id,
      error: error.message 
    })

    res.status(500).json({
      success: false,
      error: error.message,
      troubleshooting: [
        'Verify the IAM role exists in your AWS account',
        'Check the trust policy includes the correct external ID',
        'Ensure the role has necessary permissions',
        'Verify the role ARN is correct'
      ]
    })
  }
}))

// PUT /api/accounts/:id - Update AWS account
router.put('/:id', asyncHandler(async (req, res) => {
  const account = accounts.get(req.params.id)
  
  if (!account) {
    return res.status(404).json({
      error: 'Account not found'
    })
  }

  const { name, roleArn, region, isActive } = req.body

  // Update account fields
  if (name) account.name = name
  if (roleArn) {
    try {
      credentialService.parseRoleArn(roleArn)
      account.roleArn = roleArn
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid role ARN format'
      })
    }
  }
  if (region) account.region = region
  if (typeof isActive === 'boolean') account.isActive = isActive

  accounts.set(account.id, account)

  // Clear cached credentials when account is updated
  credentialService.clearCredentialsCache(account.id)

  logger.info('AWS account updated', { 
    accountId: account.id,
    changes: { name, roleArn, region, isActive }
  })

  res.json({
    account: {
      ...account,
      encryptedCredentials: undefined
    }
  })
}))

// DELETE /api/accounts/:id - Remove AWS account
router.delete('/:id', asyncHandler(async (req, res) => {
  const account = accounts.get(req.params.id)
  
  if (!account) {
    return res.status(404).json({
      error: 'Account not found'
    })
  }

  // Clear cached credentials
  credentialService.clearCredentialsCache(account.id)
  
  // Remove account
  accounts.delete(req.params.id)

  logger.info('AWS account removed', { 
    accountId: account.id,
    name: account.name 
  })

  res.status(204).send()
}))

// GET /api/accounts/:id/permissions - Check account permissions
router.get('/:id/permissions', asyncHandler(async (req, res) => {
  const account = accounts.get(req.params.id)
  
  if (!account) {
    return res.status(404).json({
      error: 'Account not found'
    })
  }

  try {
    const credentials = await credentialService.refreshCredentialsIfNeeded(account)
    
    // Test various AWS service permissions
    const permissions = {
      cloudwatch: false,
      dynamodb: false,
      s3: false,
      lambda: false
    }

    // TODO: Implement actual permission checks
    // For now, return mock data
    permissions.cloudwatch = true
    permissions.dynamodb = true
    permissions.s3 = true
    permissions.lambda = true

    res.json({
      accountId: account.id,
      permissions,
      lastChecked: new Date().toISOString()
    })

  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to check permissions',
      message: error.message
    })
  }
}))

export default router
