import express from 'express'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { DataPassingService } from '../services/DataPassingService'

const router = express.Router()
const dataPassingService = new DataPassingService()

/**
 * Get available variables for workflow execution
 */
router.get('/available', async (req, res, next) => {
  try {
    logger.info('Getting available variables')
    
    const variables = dataPassingService.getAvailableVariables()
    
    res.json({
      success: true,
      variables,
      count: Object.keys(variables).length
    })
  } catch (error: any) {
    logger.error('Failed to get available variables', { error: error.message })
    next(createError('Failed to get available variables', 500))
  }
})

/**
 * Validate variable references in a configuration
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { config, availableNodes } = req.body
    
    if (!config) {
      return next(createError('Configuration is required', 400))
    }
    
    if (!Array.isArray(availableNodes)) {
      return next(createError('Available nodes array is required', 400))
    }
    
    logger.info('Validating variable references', { 
      configKeys: Object.keys(config),
      availableNodes 
    })
    
    const validation = dataPassingService.validateVariableReferences(config, availableNodes)
    
    res.json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors
    })
  } catch (error: any) {
    logger.error('Failed to validate variable references', { error: error.message })
    next(createError('Failed to validate variable references', 500))
  }
})

/**
 * Parse variable references from a string
 */
router.post('/parse', async (req, res, next) => {
  try {
    const { input } = req.body
    
    if (typeof input !== 'string') {
      return next(createError('Input string is required', 400))
    }
    
    logger.info('Parsing variable references', { input })
    
    const references = dataPassingService.parseVariableReferences(input)
    
    res.json({
      success: true,
      references,
      count: references.length
    })
  } catch (error: any) {
    logger.error('Failed to parse variable references', { error: error.message })
    next(createError('Failed to parse variable references', 500))
  }
})

/**
 * Substitute variables in a string or configuration
 */
router.post('/substitute', async (req, res, next) => {
  try {
    const { input, type = 'string' } = req.body
    
    if (!input) {
      return next(createError('Input is required', 400))
    }
    
    logger.info('Substituting variables', { type, inputType: typeof input })
    
    let result: any
    
    if (type === 'config' && typeof input === 'object') {
      result = dataPassingService.substituteVariablesInConfig(input)
    } else if (type === 'string' && typeof input === 'string') {
      result = dataPassingService.substituteVariables(input)
    } else {
      return next(createError('Invalid input type for substitution', 400))
    }
    
    res.json({
      success: true,
      result,
      originalInput: input
    })
  } catch (error: any) {
    logger.error('Failed to substitute variables', { error: error.message })
    next(createError('Failed to substitute variables', 500))
  }
})

/**
 * Get node output by ID
 */
router.get('/node/:nodeId', async (req, res, next) => {
  try {
    const { nodeId } = req.params
    
    logger.info('Getting node output', { nodeId })
    
    const nodeOutput = dataPassingService.getNodeOutput(nodeId)
    
    if (!nodeOutput) {
      return next(createError(`Node output not found for node: ${nodeId}`, 404))
    }
    
    res.json({
      success: true,
      nodeOutput
    })
  } catch (error: any) {
    logger.error('Failed to get node output', { 
      nodeId: req.params.nodeId,
      error: error.message 
    })
    next(createError('Failed to get node output', 500))
  }
})

/**
 * Clear all stored node outputs
 */
router.delete('/clear', async (req, res, next) => {
  try {
    logger.info('Clearing all node outputs')
    
    dataPassingService.clearNodeOutputs()
    
    res.json({
      success: true,
      message: 'All node outputs cleared'
    })
  } catch (error: any) {
    logger.error('Failed to clear node outputs', { error: error.message })
    next(createError('Failed to clear node outputs', 500))
  }
})

/**
 * Get variable extraction preview for a node type and sample data
 */
router.post('/extract-preview', async (req, res, next) => {
  try {
    const { nodeType, sampleData } = req.body
    
    if (!nodeType || !sampleData) {
      return next(createError('Node type and sample data are required', 400))
    }
    
    logger.info('Generating variable extraction preview', { nodeType })
    
    const extractedData = dataPassingService.extractVariables('preview', nodeType, sampleData)
    
    res.json({
      success: true,
      nodeType,
      extractedData,
      availableVariables: Object.keys(extractedData)
    })
  } catch (error: any) {
    logger.error('Failed to generate extraction preview', { 
      nodeType: req.body.nodeType,
      error: error.message 
    })
    next(createError('Failed to generate extraction preview', 500))
  }
})

export default router
