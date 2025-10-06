import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { WorkflowVariable, WorkflowVariableService } from './WorkflowVariableService'
import { DataPassingService } from './DataPassingService'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  variables: WorkflowVariable[]
  nodes: any[]
  edges: any[]
  tags: string[]
  author?: string
  version: string
  createdAt?: string
  updatedAt?: string
}

export class WorkflowTemplateService {
  private templates: Map<string, WorkflowTemplate> = new Map()
  private workflowVariableService: WorkflowVariableService
  private dataPassingService: DataPassingService

  constructor() {
    this.workflowVariableService = new WorkflowVariableService()
    this.dataPassingService = new DataPassingService()
    this.loadBuiltInTemplates()
  }

  /**
   * Load built-in workflow templates
   */
  private loadBuiltInTemplates() {
    logger.info('Loading built-in workflow templates')

    // DLQ Investigation Template
    this.templates.set('dlq-investigation', {
      id: 'dlq-investigation',
      name: 'DLQ Message Investigation',
      description: 'Investigate DLQ messages and correlate with EMR cluster issues',
      category: 'monitoring',
      variables: [
        {
          name: 'dlqQueueName',
          type: 'string',
          required: true,
          description: 'Name of the DLQ to monitor',
          validation: {
            pattern: '^[a-zA-Z0-9_-]+$'
          }
        },
        {
          name: 'keywords',
          type: 'array',
          defaultValue: ['ERROR', 'FAILED', 'TIMEOUT'],
          description: 'Keywords to search for in messages',
          validation: {
            options: ['ERROR', 'FAILED', 'TIMEOUT', 'EXCEPTION', 'CRITICAL', 'WARNING']
          }
        },
        {
          name: 'timeWindow',
          type: 'string',
          defaultValue: '24h',
          validation: { 
            options: ['1h', '6h', 'h', '24h', '7d'] 
          },
          description: 'Time window for log analysis'
        },
        {
          name: 'maxMessages',
          type: 'number',
          defaultValue: 100,
          validation: {
            min: 1,
            max: 1000
          },
          description: 'Maximum number of messages to process'
        }
      ],
      nodes: [
        {
          id: 'sqs-poll',
          type: 'sqs',
          position: { x: 100, y: 100 },
          data: {
            label: 'Poll DLQ',
            config: {
              operation: 'pollMessages',
              queueName: '{{workflow.dlqQueueName}}',
              pollDurationSeconds: 60,
              maxMessages: '{{workflow.maxMessages}}'
            }
          }
        },
        {
          id: 'parse-messages',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: {
            label: 'Parse Messages',
            config: {
              scriptType: 'javascript',
              inputSource: '{{sqs-poll.extractedData}}',
              script: `
const messages = data.messages || []
const keywords = {{workflow.keywords}}

const relevantMessages = messages.filter(msg => 
  keywords.some(keyword => msg.body.includes(keyword))
)

const clusterIds = relevantMessages
  .map(msg => extractPattern(msg.body, 'cluster[_-]?id[:\\s=]+([a-zA-Z0-9-]+)'))
  .flat()
  .filter(id => id)

const errorTypes = relevantMessages
  .map(msg => extractPattern(msg.body, '(ERROR|FAILED|TIMEOUT|EXCEPTION)'))
  .flat()

return {
  relevantMessages,
  clusterIds: unique(clusterIds),
  primaryClusterId: clusterIds[0],
  errorTypes: unique(errorTypes),
  messageCount: relevantMessages.length,
  totalMessages: messages.length
}
              `
            }
          }
        },
        {
          id: 'cloudwatch-logs',
          type: 'cloudwatch',
          position: { x: 500, y: 100 },
          data: {
            label: 'Check EMR Logs',
            config: {
              operation: 'queryLogs',
              logGroup: '/aws/emr/{{parse-messages.extractedData.primaryClusterId}}',
              filterPattern: 'ERROR',
              timeWindow: '{{workflow.timeWindow}}'
            }
          }
        },
        {
          id: 'correlate-data',
          type: 'transform',
          position: { x: 700, y: 100 },
          data: {
            label: 'Correlate Issues',
            config: {
              scriptType: 'javascript',
              inputSource: '{{cloudwatch-logs.extractedData}}',
              script: `
const dlqData = {{parse-messages.extractedData}}
const logEvents = data.events || []

const correlatedIssues = dlqData.clusterIds.map(clusterId => {
  const clusterLogs = logEvents.filter(event => 
    event.message.includes(clusterId)
  )
  
  return {
    clusterId,
    dlqMessageCount: dlqData.relevantMessages.filter(msg => 
      msg.body.includes(clusterId)
    ).length,
    logErrorCount: clusterLogs.length,
    hasCorrelation: clusterLogs.length > 0,
    recentErrors: clusterLogs.slice(0, 5).map(log => ({
      timestamp: log.timestamp,
      message: log.message.substring(0, 200)
    }))
  }
})

return {
  summary: {
    totalClusters: dlqData.clusterIds.length,
    clustersWithErrors: correlatedIssues.filter(c => c.hasCorrelation).length,
    totalDlqMessages: dlqData.messageCount,
    totalLogErrors: logEvents.length
  },
  correlatedIssues,
  recommendations: correlatedIssues
    .filter(c => c.hasCorrelation)
    .map(c => \`Investigate cluster \${c.clusterId}: \${c.dlqMessageCount} DLQ messages, \${c.logErrorCount} log errors\`)
}
              `
            }
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'sqs-poll',
          target: 'parse-messages'
        },
        {
          id: 'e2',
          source: 'parse-messages',
          target: 'cloudwatch-logs'
        },
        {
          id: 'e3',
          source: 'cloudwatch-logs',
          target: 'correlate-data'
        }
      ],
      tags: ['dlq', 'monitoring', 'emr', 'troubleshooting'],
      author: 'Flewid Team',
      version: '1.0.0',
      createdAt: new Date().toISOString()
    })

    // CloudWatch Metrics Analysis Template
    this.templates.set('cloudwatch-metrics-analysis', {
      id: 'cloudwatch-metrics-analysis',
      name: 'CloudWatch Metrics Analysis',
      description: 'Analyze CloudWatch metrics for performance monitoring and alerting',
      category: 'monitoring',
      variables: [
        {
          name: 'namespace',
          type: 'string',
          required: true,
          description: 'CloudWatch namespace to monitor',
          validation: {
            options: ['AWS/EC2', 'AWS/RDS', 'AWS/Lambda', 'AWS/ELB', 'AWS/EMR', 'AWS/DynamoDB']
          }
        },
        {
          name: 'metricName',
          type: 'string',
          required: true,
          description: 'Metric name to analyze',
          validation: {
            options: ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadOps', 'DiskWriteOps']
          }
        },
        {
          name: 'timeRange',
          type: 'string',
          defaultValue: '1h',
          validation: {
            options: ['15m', '1h', '6h', '24h', '7d']
          },
          description: 'Time range for metric analysis'
        },
        {
          name: 'threshold',
          type: 'number',
          defaultValue: 80,
          validation: {
            min: 0,
            max: 100
          },
          description: 'Alert threshold percentage'
        }
      ],
      nodes: [
        {
          id: 'list-metrics',
          type: 'cloudwatch',
          position: { x: 100, y: 100 },
          data: {
            label: 'List Metrics',
            config: {
              operation: 'listMetrics',
              namespace: '{{workflow.namespace}}',
              metricName: '{{workflow.metricName}}'
            }
          }
        },
        {
          id: 'get-statistics',
          type: 'cloudwatch',
          position: { x: 300, y: 100 },
          data: {
            label: 'Get Statistics',
            config: {
              operation: 'getMetricStatistics',
              namespace: '{{workflow.namespace}}',
              metricName: '{{workflow.metricName}}',
              timeRange: '{{workflow.timeRange}}',
              statistics: ['Average', 'Maximum', 'Minimum']
            }
          }
        },
        {
          id: 'analyze-trends',
          type: 'transform',
          position: { x: 500, y: 100 },
          data: {
            label: 'Analyze Trends',
            config: {
              scriptType: 'javascript',
              inputSource: '{{get-statistics.extractedData}}',
              script: `
const datapoints = data.datapoints || []
const threshold = {{workflow.threshold}}

if (datapoints.length === 0) {
  return { error: 'No data points found' }
}

const values = datapoints.map(dp => dp.average || 0)
const maxValue = Math.max(...values)
const minValue = Math.min(...values)
const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length

const exceedsThreshold = values.filter(val => val > threshold)
const trend = values.length > 1 ? 
  (values[values.length - 1] - values[0]) / values[0] * 100 : 0

return {
  summary: {
    dataPointCount: datapoints.length,
    average: Math.round(avgValue * 100) / 100,
    maximum: maxValue,
    minimum: minValue,
    threshold: threshold,
    exceedsThresholdCount: exceedsThreshold.length,
    trendPercentage: Math.round(trend * 100) / 100
  },
  alerts: exceedsThreshold.length > 0 ? [
    \`Metric exceeded threshold \${exceedsThreshold.length} times\`,
    \`Maximum value: \${maxValue}, Threshold: \${threshold}\`
  ] : [],
  recommendations: [
    trend > 10 ? 'Increasing trend detected - consider scaling' : 
    trend < -10 ? 'Decreasing trend - potential cost optimization' :
    'Stable trend - monitor for changes'
  ]
}
              `
            }
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'list-metrics',
          target: 'get-statistics'
        },
        {
          id: 'e2',
          source: 'get-statistics',
          target: 'analyze-trends'
        }
      ],
      tags: ['cloudwatch', 'metrics', 'monitoring', 'performance'],
      author: 'Flewid Team',
      version: '1.0.0',
      createdAt: new Date().toISOString()
    })

    // Data Pipeline Monitoring Template
    this.templates.set('data-pipeline-monitoring', {
      id: 'data-pipeline-monitoring',
      name: 'Data Pipeline Monitoring',
      description: 'Monitor data pipeline health across S3, DynamoDB, and processing services',
      category: 'data-engineering',
      variables: [
        {
          name: 'bucketName',
          type: 'string',
          required: true,
          description: 'S3 bucket name to monitor'
        },
        {
          name: 'tableName',
          type: 'string',
          required: true,
          description: 'DynamoDB table name to check'
        },
        {
          name: 'expectedFilePattern',
          type: 'string',
          defaultValue: 'data-\\d{4}-\\d{2}-\\d{2}',
          description: 'Expected file naming pattern (regex)'
        }
      ],
      nodes: [
        {
          id: 's3-check',
          type: 's3',
          position: { x: 100, y: 100 },
          data: {
            label: 'Check S3 Files',
            config: {
              operation: 'listObjects',
              bucketName: '{{workflow.bucketName}}',
              prefix: 'data/'
            }
          }
        },
        {
          id: 'dynamodb-check',
          type: 'dynamodb',
          position: { x: 100, y: 250 },
          data: {
            label: 'Check DynamoDB',
            config: {
              operation: 'scan',
              tableName: '{{workflow.tableName}}',
              limit: 10
            }
          }
        },
        {
          id: 'validate-pipeline',
          type: 'transform',
          position: { x: 350, y: 175 },
          data: {
            label: 'Validate Pipeline',
            config: {
              scriptType: 'javascript',
              inputSource: '{{s3-check.extractedData}}',
              script: `
const s3Data = data
const dynamoData = {{dynamodb-check.extractedData}}
const expectedPattern = '{{workflow.expectedFilePattern}}'

const s3Objects = s3Data.objects || []
const dynamoItems = dynamoData.items || []

// Check for expected files
const expectedFiles = s3Objects.filter(obj => 
  new RegExp(expectedPattern).test(obj.key)
)

// Check file freshness (last 24 hours)
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
const recentFiles = s3Objects.filter(obj => 
  new Date(obj.lastModified) > oneDayAgo
)

// Pipeline health assessment
const health = {
  s3: {
    totalFiles: s3Objects.length,
    expectedFiles: expectedFiles.length,
    recentFiles: recentFiles.length,
    healthy: recentFiles.length > 0 && expectedFiles.length > 0
  },
  dynamodb: {
    recordCount: dynamoItems.length,
    healthy: dynamoItems.length > 0
  }
}

const overallHealth = health.s3.healthy && health.dynamodb.healthy

return {
  health,
  overallHealth,
  status: overallHealth ? 'HEALTHY' : 'UNHEALTHY',
  issues: [
    !health.s3.healthy ? 'S3 pipeline issues detected' : null,
    !health.dynamodb.healthy ? 'DynamoDB connectivity issues' : null,
    recentFiles.length === 0 ? 'No recent files in S3' : null
  ].filter(Boolean),
  summary: \`Pipeline Status: \${overallHealth ? 'HEALTHY' : 'UNHEALTHY'} - S3: \${s3Objects.length} files, DynamoDB: \${dynamoItems.length} records\`
}
              `
            }
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 's3-check',
          target: 'validate-pipeline'
        },
        {
          id: 'e2',
          source: 'dynamodb-check',
          target: 'validate-pipeline'
        }
      ],
      tags: ['data-pipeline', 'monitoring', 's3', 'dynamodb', 'health-check'],
      author: 'Flewid Team',
      version: '1.0.0',
      createdAt: new Date().toISOString()
    })

    logger.info('Built-in templates loaded', { count: this.templates.size })
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id)
  }

  /**
   * List all templates, optionally filtered by category
   */
  listTemplates(category?: string): WorkflowTemplate[] {
    const templates = Array.from(this.templates.values())
    return category ? templates.filter(t => t.category === category) : templates
  }

  /**
   * Get available template categories
   */
  getCategories(): string[] {
    const categories = new Set<string>()
    this.templates.forEach(template => categories.add(template.category))
    return Array.from(categories).sort()
  }

  /**
   * Search templates by name, description, or tags
   */
  searchTemplates(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.templates.values()).filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Instantiate a template with provided variables
   */
  instantiateTemplate(templateId: string, variables: Record<string, any>): {
    nodes: any[]
    edges: any[]
    variables: WorkflowVariable[]
  } {
    logger.info('Instantiating template', { templateId, variables })

    const template = this.getTemplate(templateId)
    if (!template) {
      throw createError(`Template ${templateId} not found`, 404)
    }

    // Apply default values
    const processedVariables = this.workflowVariableService.applyDefaults(variables, template.variables)

    // Validate variables
    const validation = this.workflowVariableService.validateVariables(processedVariables, template.variables)
    if (!validation.isValid) {
      throw createError(`Variable validation failed: ${validation.errors.join(', ')}`, 400)
    }

    // Substitute variables in template
    const processedNodes = template.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        config: this.workflowVariableService.substituteWorkflowVariables(node.data.config, processedVariables)
      }
    }))

    logger.info('Template instantiated successfully', { 
      templateId, 
      nodeCount: processedNodes.length,
      edgeCount: template.edges.length 
    })

    return {
      nodes: processedNodes,
      edges: template.edges,
      variables: template.variables
    }
  }

  /**
   * Create a custom template from workflow
   */
  createTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>): WorkflowTemplate {
    logger.info('Creating custom template', { name: template.name })

    const id = this.generateTemplateId(template.name)
    const now = new Date().toISOString()

    const newTemplate: WorkflowTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    }

    // Validate template structure
    this.validateTemplate(newTemplate)

    this.templates.set(id, newTemplate)

    logger.info('Custom template created', { id, name: template.name })
    return newTemplate
  }

  /**
   * Update an existing template
   */
  updateTemplate(id: string, updates: Partial<WorkflowTemplate>): WorkflowTemplate {
    const existing = this.templates.get(id)
    if (!existing) {
      throw createError(`Template ${id} not found`, 404)
    }

    const updated: WorkflowTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    }

    this.validateTemplate(updated)
    this.templates.set(id, updated)

    logger.info('Template updated', { id, name: updated.name })
    return updated
  }

  /**
   * Delete a template
   */
  deleteTemplate(id: string): void {
    if (!this.templates.has(id)) {
      throw createError(`Template ${id} not found`, 404)
    }

    this.templates.delete(id)
    logger.info('Template deleted', { id })
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: WorkflowTemplate): void {
    if (!template.name || template.name.trim() === '') {
      throw createError('Template name is required', 400)
    }

    if (!template.category || template.category.trim() === '') {
      throw createError('Template category is required', 400)
    }

    if (!Array.isArray(template.nodes)) {
      throw createError('Template nodes must be an array', 400)
    }

    if (!Array.isArray(template.edges)) {
      throw createError('Template edges must be an array', 400)
    }

    if (!Array.isArray(template.variables)) {
      throw createError('Template variables must be an array', 400)
    }

    // Validate variable references in nodes
    const variableValidation = this.workflowVariableService.validateVariableReferences(
      template.nodes,
      template.variables
    )

    if (!variableValidation.isValid) {
      throw createError(`Invalid variable references: ${variableValidation.errors.join(', ')}`, 400)
    }
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    let id = base
    let counter = 1
    
    while (this.templates.has(id)) {
      id = `${base}-${counter}`
      counter++
    }
    
    return id
  }

  /**
   * Export template as JSON
   */
  exportTemplate(id: string): string {
    const template = this.getTemplate(id)
    if (!template) {
      throw createError(`Template ${id} not found`, 404)
    }

    return JSON.stringify(template, null, 2)
  }

  /**
   * Import template from JSON
   */
  importTemplate(templateJson: string): WorkflowTemplate {
    try {
      const template = JSON.parse(templateJson)
      
      // Remove ID to generate new one
      delete template.id
      delete template.createdAt
      delete template.updatedAt
      
      return this.createTemplate(template)
    } catch (error: any) {
      throw createError(`Failed to import template: ${error.message}`, 400)
    }
  }
}
