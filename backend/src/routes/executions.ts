import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { ExecutionService } from '../services/ExecutionService'

const router = Router()
const executionService = new ExecutionService()

// GET /api/executions - Get all executions
router.get('/', asyncHandler(async (req, res) => {
  const executions = await executionService.getAllExecutions()
  res.json(executions)
}))

// GET /api/executions/:id - Get execution by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const execution = await executionService.getExecutionById(req.params.id)
  res.json(execution)
}))

// GET /api/executions/:id/logs - Get execution logs
router.get('/:id/logs', asyncHandler(async (req, res) => {
  const logs = await executionService.getExecutionLogs(req.params.id)
  res.json(logs)
}))

// POST /api/executions/:id/stop - Stop execution
router.post('/:id/stop', asyncHandler(async (req, res) => {
  await executionService.stopExecution(req.params.id)
  res.json({ message: 'Execution stopped' })
}))

export default router
