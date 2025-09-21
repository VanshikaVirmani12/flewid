import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

export interface ExecutionLog {
  id: string
  executionId: string
  nodeId: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  data?: any
}

export class ExecutionService {
  private executions: Map<string, any> = new Map()
  private logs: Map<string, ExecutionLog[]> = new Map()

  async getAllExecutions(): Promise<any[]> {
    logger.info('Getting all executions')
    return Array.from(this.executions.values())
  }

  async getExecutionById(id: string): Promise<any> {
    logger.info('Getting execution by ID', { executionId: id })
    
    const execution = this.executions.get(id)
    if (!execution) {
      throw createError(`Execution with ID ${id} not found`, 404)
    }
    
    return execution
  }

  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    logger.info('Getting execution logs', { executionId })
    
    const logs = this.logs.get(executionId) || []
    return logs
  }

  async stopExecution(executionId: string): Promise<void> {
    logger.info('Stopping execution', { executionId })
    
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw createError(`Execution with ID ${executionId} not found`, 404)
    }
    
    if (execution.status === 'running') {
      execution.status = 'cancelled'
      execution.endTime = new Date().toISOString()
      this.executions.set(executionId, execution)
    }
    
    logger.info('Execution stopped', { executionId })
  }

  addExecution(execution: any): void {
    this.executions.set(execution.id, execution)
  }

  addLog(log: ExecutionLog): void {
    const logs = this.logs.get(log.executionId) || []
    logs.push(log)
    this.logs.set(log.executionId, logs)
  }
}
