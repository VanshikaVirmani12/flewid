import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

export interface WorkflowVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  defaultValue?: any
  description?: string
  required?: boolean
  validation?: {
    pattern?: string
    min?: number
    max?: number
    options?: any[]
  }
}

export class WorkflowVariableService {
  /**
   * Validate workflow variables against their definitions
   */
  validateVariables(variables: Record<string, any>, definitions: WorkflowVariable[]): {
    isValid: boolean
    errors: string[]
  } {
    logger.info('Validating workflow variables', { 
      variableCount: Object.keys(variables).length,
      definitionCount: definitions.length 
    })

    const errors: string[] = []
    
    for (const def of definitions) {
      const value = variables[def.name]
      
      // Check required
      if (def.required && (value === undefined || value === null)) {
        errors.push(`Variable '${def.name}' is required`)
        continue
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (!this.validateType(value, def.type)) {
          errors.push(`Variable '${def.name}' must be of type ${def.type}`)
        }
        
        // Pattern validation
        if (def.validation?.pattern && typeof value === 'string') {
          const regex = new RegExp(def.validation.pattern)
          if (!regex.test(value)) {
            errors.push(`Variable '${def.name}' does not match required pattern`)
          }
        }
        
        // Range validation
        if (typeof value === 'number') {
          if (def.validation?.min !== undefined && value < def.validation.min) {
            errors.push(`Variable '${def.name}' must be >= ${def.validation.min}`)
          }
          if (def.validation?.max !== undefined && value > def.validation.max) {
            errors.push(`Variable '${def.name}' must be <= ${def.validation.max}`)
          }
        }
        
        // Options validation
        if (def.validation?.options && !def.validation.options.includes(value)) {
          errors.push(`Variable '${def.name}' must be one of: ${def.validation.options.join(', ')}`)
        }
      }
    }
    
    const result = {
      isValid: errors.length === 0,
      errors
    }

    logger.info('Variable validation completed', { 
      isValid: result.isValid,
      errorCount: errors.length 
    })

    return result
  }
  
  /**
   * Validate variable type
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string'
      case 'number': return typeof value === 'number'
      case 'boolean': return typeof value === 'boolean'
      case 'array': return Array.isArray(value)
      case 'object': return typeof value === 'object' && !Array.isArray(value)
      default: return true
    }
  }

  /**
   * Apply default values to variables
   */
  applyDefaults(variables: Record<string, any>, definitions: WorkflowVariable[]): Record<string, any> {
    logger.info('Applying default values to variables')

    const result = { ...variables }
    
    for (const def of definitions) {
      if (def.defaultValue !== undefined && (result[def.name] === undefined || result[def.name] === null)) {
        result[def.name] = def.defaultValue
        logger.debug('Applied default value', { 
          variable: def.name, 
          defaultValue: def.defaultValue 
        })
      }
    }
    
    return result
  }

  /**
   * Get variable schema for frontend validation
   */
  getVariableSchema(definitions: WorkflowVariable[]): Record<string, any> {
    const schema: Record<string, any> = {}
    
    for (const def of definitions) {
      schema[def.name] = {
        type: def.type,
        required: def.required || false,
        description: def.description,
        defaultValue: def.defaultValue,
        validation: def.validation
      }
    }
    
    return schema
  }

  /**
   * Parse variable definitions from workflow configuration
   */
  parseVariableDefinitions(workflowConfig: any): WorkflowVariable[] {
    if (!workflowConfig.variables || !Array.isArray(workflowConfig.variables)) {
      return []
    }

    return workflowConfig.variables.map((varDef: any) => ({
      name: varDef.name,
      type: varDef.type || 'string',
      defaultValue: varDef.defaultValue,
      description: varDef.description,
      required: varDef.required || false,
      validation: varDef.validation || {}
    }))
  }

  /**
   * Substitute workflow variables in configuration
   */
  substituteWorkflowVariables(config: any, variables: Record<string, any>): any {
    if (typeof config === 'string') {
      return this.substituteVariablesInString(config, variables)
    } else if (Array.isArray(config)) {
      return config.map(item => this.substituteWorkflowVariables(item, variables))
    } else if (config && typeof config === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.substituteWorkflowVariables(value, variables)
      }
      return result
    }
    
    return config
  }

  /**
   * Substitute variables in a string using {{workflow.variableName}} syntax
   */
  private substituteVariablesInString(str: string, variables: Record<string, any>): string {
    return str.replace(/\{\{workflow\.([^}]+)\}\}/g, (match, variableName) => {
      if (variables.hasOwnProperty(variableName)) {
        const value = variables[variableName]
        return typeof value === 'string' ? value : JSON.stringify(value)
      }
      
      logger.warn('Workflow variable not found', { variableName, availableVars: Object.keys(variables) })
      return match // Keep original if variable not found
    })
  }

  /**
   * Extract workflow variable references from configuration
   */
  extractVariableReferences(config: any): string[] {
    const references = new Set<string>()
    
    const extractFromValue = (value: any) => {
      if (typeof value === 'string') {
        const matches = value.match(/\{\{workflow\.([^}]+)\}\}/g)
        if (matches) {
          matches.forEach(match => {
            const varName = match.replace(/\{\{workflow\.([^}]+)\}\}/, '$1')
            references.add(varName)
          })
        }
      } else if (Array.isArray(value)) {
        value.forEach(extractFromValue)
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(extractFromValue)
      }
    }
    
    extractFromValue(config)
    return Array.from(references)
  }

  /**
   * Validate that all referenced variables are defined
   */
  validateVariableReferences(config: any, definitions: WorkflowVariable[]): {
    isValid: boolean
    errors: string[]
  } {
    const references = this.extractVariableReferences(config)
    const definedVariables = new Set(definitions.map(def => def.name))
    const errors: string[] = []
    
    for (const ref of references) {
      if (!definedVariables.has(ref)) {
        errors.push(`Referenced variable '${ref}' is not defined in workflow variables`)
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Create variable definition from user input
   */
  createVariableDefinition(input: {
    name: string
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    required?: boolean
    defaultValue?: any
    validation?: {
      pattern?: string
      min?: number
      max?: number
      options?: any[]
    }
  }): WorkflowVariable {
    // Validate variable name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
      throw createError('Variable name must start with a letter or underscore and contain only letters, numbers, and underscores', 400)
    }

    // Validate default value type
    if (input.defaultValue !== undefined && !this.validateType(input.defaultValue, input.type)) {
      throw createError(`Default value does not match variable type '${input.type}'`, 400)
    }

    return {
      name: input.name,
      type: input.type,
      description: input.description,
      required: input.required || false,
      defaultValue: input.defaultValue,
      validation: input.validation || {}
    }
  }

  /**
   * Update variable definition
   */
  updateVariableDefinition(
    definitions: WorkflowVariable[], 
    variableName: string, 
    updates: Partial<WorkflowVariable>
  ): WorkflowVariable[] {
    const index = definitions.findIndex(def => def.name === variableName)
    
    if (index === -1) {
      throw createError(`Variable '${variableName}' not found`, 404)
    }

    const updated = { ...definitions[index], ...updates }
    
    // Validate updated definition
    if (updated.defaultValue !== undefined && !this.validateType(updated.defaultValue, updated.type)) {
      throw createError(`Default value does not match variable type '${updated.type}'`, 400)
    }

    const result = [...definitions]
    result[index] = updated
    
    return result
  }

  /**
   * Remove variable definition
   */
  removeVariableDefinition(definitions: WorkflowVariable[], variableName: string): WorkflowVariable[] {
    const filtered = definitions.filter(def => def.name !== variableName)
    
    if (filtered.length === definitions.length) {
      throw createError(`Variable '${variableName}' not found`, 404)
    }
    
    return filtered
  }
}
