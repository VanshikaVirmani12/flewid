import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { WorkflowService } from '../services/WorkflowService'

const router = Router()
const workflowService = new WorkflowService()

// GET /api/workflows - Get all workflows
router.get('/', asyncHandler(async (req, res) => {
  const workflows = await workflowService.getAllWorkflows()
  res.json(workflows)
}))

// GET /api/workflows/:id - Get workflow by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const workflow = await workflowService.getWorkflowById(req.params.id)
  res.json(workflow)
}))

// POST /api/workflows - Create new workflow
router.post('/', asyncHandler(async (req, res) => {
  const workflow = await workflowService.createWorkflow(req.body)
  res.status(201).json(workflow)
}))

// PUT /api/workflows/:id - Update workflow
router.put('/:id', asyncHandler(async (req, res) => {
  const workflow = await workflowService.updateWorkflow(req.params.id, req.body)
  res.json(workflow)
}))

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', asyncHandler(async (req, res) => {
  await workflowService.deleteWorkflow(req.params.id)
  res.status(204).send()
}))

// POST /api/workflows/:id/execute - Execute workflow
router.post('/:id/execute', asyncHandler(async (req, res) => {
  const execution = await workflowService.executeWorkflow(req.params.id, req.body.inputs || {})
  res.json(execution)
}))

export default router
