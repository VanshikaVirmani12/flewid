import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { TransformService } from '../services/TransformService'

const router = Router()
const transformService = new TransformService()

// POST /api/transform/execute - Execute transformation
router.post('/execute', asyncHandler(async (req, res) => {
  const { script, inputData, scriptType, inputField } = req.body

  if (!script || !scriptType) {
    return res.status(400).json({
      success: false,
      error: 'Script and scriptType are required'
    })
  }

  if (!inputData) {
    return res.status(400).json({
      success: false,
      error: 'Input data is required'
    })
  }

  const result = await transformService.executeTransform({
    script,
    inputData,
    scriptType,
    inputField
  })

  res.json({
    success: true,
    result,
    scriptType,
    timestamp: new Date().toISOString()
  })
}))

// POST /api/transform/validate - Validate transformation script
router.post('/validate', asyncHandler(async (req, res) => {
  const { script, scriptType } = req.body

  if (!script || !scriptType) {
    return res.status(400).json({
      success: false,
      error: 'Script and scriptType are required'
    })
  }

  const validation = transformService.validateScript(script, scriptType)

  res.json({
    success: true,
    validation
  })
}))

export default router
