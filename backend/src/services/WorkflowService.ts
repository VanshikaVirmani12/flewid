import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { ExecutionEngine } from '../engines/ExecutionEngine'

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    config: Record<string, any>
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  inputs: Record<string, any>
  outputs?: Record<string, any>
  error?: string
}

export class WorkflowService {
  private workflows: Map<string, Workflow> = new Map()
  private executionEngine: ExecutionEngine

  constructor() {
    this.executionEngine = new ExecutionEngine()
    this.initializeMockData()
  }

  private initializeMockData() {
    // Add some mock workflows for development
    const mockWorkflow: Workflow = {
      id: '1',
      name: 'Lambda Error Investigation',
      description: 'Trace Lambda errors across CloudWatch and DynamoDB',
      nodes: [
        {
          id: 'start',
          type: 'input',
          position: { x: 250, y: 25 },
          data: { label: 'Start', config: {} }
        },
        {
          id: 'cloudwatch-1',
          type: 'cloudwatch',
          position: { x: 250, y: 150 },
          data: {
            label: 'Query CloudWatch Logs',
            config: {
              logGroup: '/aws/lambda/my-function',
              query: 'fields @timestamp, @message | filter @message like /ERROR/',
              timeRange: '1h'
            }
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'start',
          target: 'cloudwatch-1'
        }
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.workflows.set(mockWorkflow.id, mockWorkflow)
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    logger.info('Getting all workflows')
    return Array.from(this.workflows.values())
  }

  async getWorkflowById(id: string): Promise<Workflow> {
    logger.info('Getting workflow by ID', { workflowId: id })
    
    const workflow = this.workflows.get(id)
    if (!workflow) {
      throw createError(`Workflow with ID ${id} not found`, 404)
    }
    
    return workflow
  }

  async createWorkflow(workflowData: Partial<Workflow>): Promise<Workflow> {
    logger.info('Creating new workflow', { name: workflowData.name })
    
    const workflow: Workflow = {
      id: uuidv4(),
      name: workflowData.name || 'Untitled Workflow',
      description: workflowData.description,
      nodes: workflowData.nodes || [],
      edges: workflowData.edges || [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: workflowData.createdBy
    }
    
    this.workflows.set(workflow.id, workflow)
    
    logger.info('Workflow created successfully', { workflowId: workflow.id })
    return workflow
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    logger.info('Updating workflow', { workflowId: id })
    
    const workflow = await this.getWorkflowById(id)
    
    const updatedWorkflow: Workflow = {
      ...workflow,
      ...updates,
      id: workflow.id, // Ensure ID cannot be changed
      updatedAt: new Date().toISOString()
    }
    
    this.workflows.set(id, updatedWorkflow)
    
    logger.info('Workflow updated successfully', { workflowId: id })
    return updatedWorkflow
  }

  async deleteWorkflow(id: string): Promise<void> {
    logger.info('Deleting workflow', { workflowId: id })
    
    if (!this.workflows.has(id)) {
      throw createError(`Workflow with ID ${id} not found`, 404)
    }
    
    this.workflows.delete(id)
    
    logger.info('Workflow deleted successfully', { workflowId: id })
  }

  async executeWorkflow(id: string, inputs: Record<string, any> = {}): Promise<WorkflowExecution> {
    logger.info('Executing workflow', { workflowId: id, inputs })
    
    const workflow = await this.getWorkflowById(id)
    
    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId: id,
      status: 'pending',
      startTime: new Date().toISOString(),
      inputs
    }
    
    // Start execution asynchronously
    this.executionEngine.execute(workflow, execution)
      .then((result) => {
        logger.info('Workflow execution completed', { 
          executionId: execution.id,
          status: result.status 
        })
      })
      .catch((error) => {
        logger.error('Workflow execution failed', { 
          executionId: execution.id,
          error: error.message 
        })
      })
    
    return execution
  }
}
