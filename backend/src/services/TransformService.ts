import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

export class TransformService {
  /**
   * Execute transformation script on input data
   */
  async executeTransform(params: {
    script: string
    inputData: any
    scriptType: 'javascript' | 'jsonpath' | 'regex'
    inputField?: string
  }): Promise<any> {
    logger.info('Executing transform', { 
      scriptType: params.scriptType,
      hasInputData: !!params.inputData,
      inputField: params.inputField
    })

    try {
      switch (params.scriptType) {
        case 'javascript':
          return this.executeJavaScript(params.script, params.inputData)
        case 'jsonpath':
          return this.executeJSONPath(params.script, params.inputData)
        case 'regex':
          return this.executeRegex(params.script, params.inputData, params.inputField)
        default:
          throw new Error(`Unsupported script type: ${params.scriptType}`)
      }
    } catch (error: any) {
      logger.error('Transform execution failed', { 
        scriptType: params.scriptType,
        error: error.message 
      })
      throw createError(`Transform execution failed: ${error.message}`, 400)
    }
  }

  /**
   * Execute JavaScript transformation with safe execution context
   */
  private executeJavaScript(script: string, data: any): any {
    logger.info('Executing JavaScript transform')

    // Create safe execution context with utility functions
    const context = {
      data,
      console: { 
        log: (...args: any[]) => logger.info('Transform console.log', { args }) 
      },
      
      // Utility functions for common data transformations
      extractPattern: (text: string, pattern: string, flags?: string) => {
        try {
          const regex = new RegExp(pattern, flags || 'g')
          const matches = []
          let match
          while ((match = regex.exec(text)) !== null) {
            matches.push(match[1] || match[0])
            if (!flags?.includes('g')) break // Prevent infinite loop for non-global regex
          }
          return matches
        } catch (error) {
          logger.warn('Invalid regex pattern in extractPattern', { pattern, error })
          return []
        }
      },

      parseJSON: (text: string) => {
        try { 
          return JSON.parse(text) 
        } catch { 
          return null 
        }
      },

      formatDate: (date: string | Date, format?: string) => {
        try {
          const d = new Date(date)
          if (format === 'iso') return d.toISOString()
          if (format === 'date') return d.toDateString()
          if (format === 'time') return d.toTimeString()
          return d.toISOString() // Default to ISO
        } catch {
          return null
        }
      },

      filterArray: (arr: any[], predicate: string) => {
        if (!Array.isArray(arr)) return []
        try {
          // Simple predicate evaluation for common cases
          return arr.filter(item => {
            if (predicate.includes('!=')) {
              const [field, value] = predicate.split('!=').map(s => s.trim())
              return this.getNestedValue(item, field) != value.replace(/['"]/g, '')
            }
            if (predicate.includes('==')) {
              const [field, value] = predicate.split('==').map(s => s.trim())
              return this.getNestedValue(item, field) == value.replace(/['"]/g, '')
            }
            if (predicate.includes('contains')) {
              const match = predicate.match(/(\w+)\s+contains\s+['"]([^'"]+)['"]/)
              if (match) {
                const [, field, value] = match
                const fieldValue = this.getNestedValue(item, field)
                return typeof fieldValue === 'string' && fieldValue.includes(value)
              }
            }
            return true
          })
        } catch {
          return arr
        }
      },

      groupBy: (arr: any[], key: string) => {
        if (!Array.isArray(arr)) return {}
        return arr.reduce((groups, item) => {
          const groupKey = this.getNestedValue(item, key) || 'undefined'
          if (!groups[groupKey]) groups[groupKey] = []
          groups[groupKey].push(item)
          return groups
        }, {})
      },

      sortBy: (arr: any[], key: string, order: 'asc' | 'desc' = 'asc') => {
        if (!Array.isArray(arr)) return arr
        return [...arr].sort((a, b) => {
          const aVal = this.getNestedValue(a, key)
          const bVal = this.getNestedValue(b, key)
          
          if (aVal < bVal) return order === 'asc' ? -1 : 1
          if (aVal > bVal) return order === 'asc' ? 1 : -1
          return 0
        })
      },

      unique: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return arr
        if (key) {
          const seen = new Set()
          return arr.filter(item => {
            const value = this.getNestedValue(item, key)
            if (seen.has(value)) return false
            seen.add(value)
            return true
          })
        }
        return [...new Set(arr)]
      },

      sum: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return 0
        return arr.reduce((sum, item) => {
          const value = key ? this.getNestedValue(item, key) : item
          return sum + (typeof value === 'number' ? value : 0)
        }, 0)
      },

      count: (arr: any[], predicate?: string) => {
        if (!Array.isArray(arr)) return 0
        if (!predicate) return arr.length
        return context.filterArray(arr, predicate).length
      },

      flatten: (arr: any[], depth: number = 1) => {
        if (!Array.isArray(arr)) return arr
        return arr.flat(depth)
      },

      // String utilities
      slugify: (text: string) => {
        return text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      },

      capitalize: (text: string) => {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
      },

      // Math utilities
      Math: {
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        min: Math.min,
        max: Math.max,
        abs: Math.abs,
        random: Math.random
      },

      // Date utilities
      Date: {
        now: Date.now,
        parse: Date.parse
      }
    }

    try {
      // Use Function constructor for safer execution than eval
      // This still has security implications but is safer than eval
      const func = new Function(
        'data', 'extractPattern', 'parseJSON', 'formatDate', 'filterArray', 
        'groupBy', 'sortBy', 'unique', 'sum', 'count', 'flatten', 'slugify', 
        'capitalize', 'Math', 'Date', 'console',
        `
        "use strict";
        ${script}
        `
      )

      const result = func(
        context.data,
        context.extractPattern,
        context.parseJSON,
        context.formatDate,
        context.filterArray,
        context.groupBy,
        context.sortBy,
        context.unique,
        context.sum,
        context.count,
        context.flatten,
        context.slugify,
        context.capitalize,
        context.Math,
        context.Date,
        context.console
      )

      logger.info('JavaScript transform completed successfully')
      return result
    } catch (error: any) {
      logger.error('JavaScript execution error', { error: error.message })
      throw new Error(`JavaScript execution error: ${error.message}`)
    }
  }

  /**
   * Execute JSONPath expression
   */
  private executeJSONPath(expression: string, data: any): any {
    logger.info('Executing JSONPath transform', { expression })

    try {
      // Simple JSONPath implementation for basic cases
      // This is a simplified version - in production you'd use a proper JSONPath library
      
      if (expression.startsWith('$.')) {
        const path = expression.substring(2)
        return this.getNestedValue(data, path)
      }

      // Handle array operations like $[*].field
      if (expression.includes('[*]')) {
        const parts = expression.split('[*]')
        let current = data
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].replace(/^\$\.?/, '').replace(/^\./, '')
          
          if (part) {
            if (i === 0) {
              current = this.getNestedValue(current, part)
            } else {
              if (Array.isArray(current)) {
                current = current.map(item => this.getNestedValue(item, part))
              }
            }
          } else if (i === 0) {
            // Root array access
            current = data
          }
        }
        
        return current
      }

      // Fallback to simple property access
      return this.getNestedValue(data, expression.replace(/^\$\./, ''))
    } catch (error: any) {
      logger.error('JSONPath execution error', { expression, error: error.message })
      throw new Error(`JSONPath execution error: ${error.message}`)
    }
  }

  /**
   * Execute regex transformation
   */
  private executeRegex(pattern: string, data: any, inputField?: string): any {
    logger.info('Executing regex transform', { pattern, inputField })

    try {
      let targetText: string

      if (inputField) {
        targetText = this.getNestedValue(data, inputField)
      } else if (typeof data === 'string') {
        targetText = data
      } else {
        targetText = JSON.stringify(data)
      }

      if (typeof targetText !== 'string') {
        throw new Error('Target data is not a string and no input field specified')
      }

      const regex = new RegExp(pattern, 'g')
      const matches = []
      let match

      while ((match = regex.exec(targetText)) !== null) {
        if (match.length > 1) {
          // If there are capture groups, return them
          matches.push(match.slice(1))
        } else {
          // Otherwise return the full match
          matches.push(match[0])
        }
      }

      return {
        matches,
        matchCount: matches.length,
        originalText: targetText,
        pattern
      }
    } catch (error: any) {
      logger.error('Regex execution error', { pattern, error: error.message })
      throw new Error(`Regex execution error: ${error.message}`)
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return obj
    
    return path.split('.').reduce((current, key) => {
      // Handle array indexing
      const arrayMatch = key.match(/^([^[]+)\[(\d+)\]$/)
      if (arrayMatch) {
        const [, arrayKey, indexStr] = arrayMatch
        const index = parseInt(indexStr, 10)
        return current?.[arrayKey]?.[index]
      }
      
      return current?.[key]
    }, obj)
  }

  /**
   * Validate transform script syntax
   */
  validateScript(script: string, scriptType: 'javascript' | 'jsonpath' | 'regex'): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    try {
      switch (scriptType) {
        case 'javascript':
          // Basic syntax check by creating function
          new Function(script)
          break
          
        case 'jsonpath':
          if (!script.startsWith('$')) {
            errors.push('JSONPath expressions must start with $')
          }
          break
          
        case 'regex':
          new RegExp(script)
          break
      }
    } catch (error: any) {
      errors.push(`Syntax error: ${error.message}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
