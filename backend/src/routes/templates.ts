import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { WorkflowTemplateService } from '../services/WorkflowTemplateService'

const router = Router()
const templateService = new WorkflowTemplateService()

// GET /api/templates - List all templates
router.get('/', asyncHandler(async (req, res) => {
  const { category, search } = req.query

  let templates
  if (search) {
    templates = templateService.searchTemplates(search as string)
  } else if (category) {
    templates = templateService.listTemplates(category as string)
  } else {
    templates = templateService.listTemplates()
  }

  res.json({
    success: true,
    templates,
    count: templates.length
  })
}))

// GET /api/templates/categories - Get available categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = templateService.getCategories()
  
  res.json({
    success: true,
    categories
  })
}))

// GET /api/templates/:id - Get template by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const template = templateService.getTemplate(req.params.id)
  
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    })
  }

  res.json({
    success: true,
    template
  })
}))

// POST /api/templates/:id/instantiate - Instantiate template with variables
router.post('/:id/instantiate', asyncHandler(async (req, res) => {
  const { variables = {} } = req.body
  
  const result = templateService.instantiateTemplate(req.params.id, variables)
  
  res.json({
    success: true,
    ...result
  })
}))

// POST /api/templates - Create new template
router.post('/', asyncHandler(async (req, res) => {
  const template = templateService.createTemplate(req.body)
  
  res.status(201).json({
    success: true,
    template
  })
}))

// PUT /api/templates/:id - Update template
router.put('/:id', asyncHandler(async (req, res) => {
  const template = templateService.updateTemplate(req.params.id, req.body)
  
  res.json({
    success: true,
    template
  })
}))

// DELETE /api/templates/:id - Delete template
router.delete('/:id', asyncHandler(async (req, res) => {
  templateService.deleteTemplate(req.params.id)
  
  res.status(204).send()
}))

// GET /api/templates/:id/export - Export template as JSON
router.get('/:id/export', asyncHandler(async (req, res) => {
  const templateJson = templateService.exportTemplate(req.params.id)
  
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="template-${req.params.id}.json"`)
  res.send(templateJson)
}))

// POST /api/templates/import - Import template from JSON
router.post('/import', asyncHandler(async (req, res) => {
  const { templateJson } = req.body
  
  if (!templateJson) {
    return res.status(400).json({
      success: false,
      error: 'Template JSON is required'
    })
  }
  
  const template = templateService.importTemplate(templateJson)
  
  res.status(201).json({
    success: true,
    template
  })
}))

export default router
