# Implementation Plan for Workflow Enhancements

## Phase 1: Missing AWS Service Nodes

### 1. Athena Node Implementation

#### Backend Service
```typescript
// backend/src/services/aws/AthenaService.ts
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena'
import { BaseAWSService } from './BaseAWSService'

export class AthenaService extends BaseAWSService {
  async executeQuery(params: {
    accountId: string
    queryString: string
    database: string
    outputLocation: string
    workGroup?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    // Implementation similar to other AWS services
    const credentials = await this.getCredentials(params.accountId, accounts)
    const client = new AthenaClient({ region: credentials.region, credentials })
    
    // Start query execution
    const startCommand = new StartQueryExecutionCommand({
      QueryString: params.queryString,
      QueryExecutionContext: { Database: params.database },
      ResultConfiguration: { OutputLocation: params.outputLocation },
      WorkGroup: params.workGroup
    })
    
    const startResponse = await client.send(startCommand)
    const queryExecutionId = startResponse.QueryExecutionId
    
    // Poll for completion
    let status = 'RUNNING'
    while (status === 'RUNNING' || status === 'QUEUED') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
      const statusResponse = await client.send(statusCommand)
      status = statusResponse.QueryExecution?.Status?.State || 'FAILED'
    }
    
    if (status === 'SUCCEEDED') {
      // Get results
      const resultsCommand = new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId })
      const resultsResponse = await client.send(resultsCommand)
      
      return {
        success: true,
        queryExecutionId,
        results: resultsResponse.ResultSet?.Rows || [],
        columnInfo: resultsResponse.ResultSet?.ResultSetMetadata?.ColumnInfo || []
      }
    } else {
      throw new Error(`Query failed with status: ${status}`)
    }
  }
}
```

#### Frontend Node Component
```typescript
// frontend/src/components/nodes/AthenaNode.tsx
interface AthenaNodeConfig {
  operation: 'executeQuery' | 'getQueryResults'
  queryString: string
  database: string
  outputLocation: string
  workGroup?: string
}

const AthenaNode: React.FC<AthenaNodeProps> = ({ data, selected, id, onConfigUpdate }) => {
  // Similar structure to existing nodes
  // Form fields for query string, database, output location
  // Syntax highlighting for SQL queries
  // Variable substitution support in query string
}
```

### 2. SNS Node Implementation

#### Backend Service
```typescript
// backend/src/services/aws/SNSService.ts
import { SNSClient, PublishCommand, ListTopicsCommand, CreateTopicCommand } from '@aws-sdk/client-sns'

export class SNSService extends BaseAWSService {
  async publishMessage(params: {
    accountId: string
    topicArn?: string
    phoneNumber?: string
    message: string
    subject?: string
    messageAttributes?: Record<string, any>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    const credentials = await this.getCredentials(params.accountId, accounts)
    const client = new SNSClient({ region: credentials.region, credentials })
    
    const command = new PublishCommand({
      TopicArn: params.topicArn,
      PhoneNumber: params.phoneNumber,
      Message: params.message,
      Subject: params.subject,
      MessageAttributes: params.messageAttributes
    })
    
    const response = await client.send(command)
    
    return {
      success: true,
      messageId: response.MessageId,
      sequenceNumber: response.SequenceNumber
    }
  }
}
```

## Phase 2: Enhanced Existing Nodes

### 1. Enhanced DynamoDB Node

#### Add Update/Delete Operations
```typescript
// backend/src/services/aws/DynamoDBService.ts - Add methods
async updateItem(params: {
  accountId: string
  tableName: string
  key: Record<string, any>
  updateExpression: string
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, any>
}, accounts: Map<string, AWSAccount>): Promise<any> {
  const credentials = await this.getCredentials(params.accountId, accounts)
  const client = new DynamoDBClient({ region: credentials.region, credentials })
  
  const command = new UpdateItemCommand({
    TableName: params.tableName,
    Key: marshall(params.key),
    UpdateExpression: params.updateExpression,
    ConditionExpression: params.conditionExpression,
    ExpressionAttributeNames: params.expressionAttributeNames,
    ExpressionAttributeValues: params.expressionAttributeValues ? marshall(params.expressionAttributeValues) : undefined,
    ReturnValues: 'ALL_NEW'
  })
  
  const response = await client.send(command)
  
  return {
    success: true,
    attributes: response.Attributes ? unmarshall(response.Attributes) : null
  }
}
```

#### Frontend Enhancement
```typescript
// frontend/src/components/nodes/DynamoDBNode.tsx - Add to form
<Form.Item
  noStyle
  shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}
>
  {({ getFieldValue }) => {
    const operation = getFieldValue('operation')
    
    if (operation === 'updateItem') {
      return (
        <>
          <Form.Item label="Update Expression" name="updateExpression" rules={[{ required: true }]}>
            <Input placeholder="SET #attr = :val" />
          </Form.Item>
          <Form.Item label="Condition Expression" name="conditionExpression">
            <Input placeholder="attribute_exists(#attr)" />
          </Form.Item>
          <Form.Item label="Expression Attribute Values" name="expressionAttributeValues">
            <TextArea placeholder='{"#attr": "value"}' />
          </Form.Item>
        </>
      )
    }
    return null
  }}
</Form.Item>
```

### 2. Enhanced CloudWatch Node

#### Add Metrics and Alarms Support
```typescript
// backend/src/services/aws/CloudWatchService.ts - Add methods
async getMetricStatistics(params: {
  accountId: string
  namespace: string
  metricName: string
  dimensions?: Array<{ Name: string; Value: string }>
  startTime: Date
  endTime: Date
  period: number
  statistics: string[]
}, accounts: Map<string, AWSAccount>): Promise<any> {
  const credentials = await this.getCredentials(params.accountId, accounts)
  const client = new CloudWatchClient({ region: credentials.region, credentials })
  
  const command = new GetMetricStatisticsCommand({
    Namespace: params.namespace,
    MetricName: params.metricName,
    Dimensions: params.dimensions,
    StartTime: params.startTime,
    EndTime: params.endTime,
    Period: params.period,
    Statistics: params.statistics
  })
  
  const response = await client.send(command)
  
  return {
    success: true,
    datapoints: response.Datapoints || [],
    label: response.Label
  }
}
```

## Phase 3: Enhanced Transform Node

### Advanced Data Processing Capabilities
```typescript
// backend/src/services/TransformService.ts
export class TransformService {
  /**
   * Execute transformation script on input data
   */
  async executeTransform(params: {
    script: string
    inputData: any
    scriptType: 'javascript' | 'jsonpath' | 'regex'
  }): Promise<any> {
    switch (params.scriptType) {
      case 'javascript':
        return this.executeJavaScript(params.script, params.inputData)
      case 'jsonpath':
        return this.executeJSONPath(params.script, params.inputData)
      case 'regex':
        return this.executeRegex(params.script, params.inputData)
      default:
        throw new Error(`Unsupported script type: ${params.scriptType}`)
    }
  }
  
  private executeJavaScript(script: string, data: any): any {
    // Safe JavaScript execution with limited context
    const context = {
      data,
      console: { log: () => {} }, // Disabled for security
      // Add utility functions
      extractPattern: (text: string, pattern: string) => {
        const regex = new RegExp(pattern, 'g')
        const matches = []
        let match
        while ((match = regex.exec(text)) !== null) {
          matches.push(match[1] || match[0])
        }
        return matches
      },
      parseJSON: (text: string) => {
        try { return JSON.parse(text) } catch { return null }
      },
      formatDate: (date: string | Date) => new Date(date).toISOString(),
      // Add more utility functions as needed
    }
    
    // Use vm2 or similar for safe execution
    const { VM } = require('vm2')
    const vm = new VM({
      timeout: 5000,
      sandbox: context
    })
    
    return vm.run(`
      (function() {
        ${script}
      })()
    `)
  }
}
```

### Enhanced Transform Node UI
```typescript
// frontend/src/components/nodes/TransformNode.tsx
const TransformNode: React.FC<TransformNodeProps> = ({ data, selected, id, onConfigUpdate }) => {
  const [scriptType, setScriptType] = useState('javascript')
  
  return (
    <Modal title="Configure Transform Node" open={isConfigModalVisible}>
      <Form form={form} layout="vertical">
        <Form.Item label="Script Type" name="scriptType">
          <Select onChange={setScriptType}>
            <Option value="javascript">JavaScript</Option>
            <Option value="jsonpath">JSONPath</Option>
            <Option value="regex">Regular Expression</Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="Input Data Source" name="inputSource">
          <Select placeholder="Select data source">
            {availableNodes.map(node => (
              <Option key={node.id} value={`{{${node.id}.extractedData}}`}>
                {node.label} - Extracted Data
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        {scriptType === 'javascript' && (
          <Form.Item label="JavaScript Code" name="script">
            <CodeEditor
              language="javascript"
              placeholder={`// Transform the input data
// Available: data (input data), extractPattern, parseJSON, formatDate
// Return the transformed result

const messages = data.messages || []
const clusterIds = messages
  .map(msg => extractPattern(msg.body, 'cluster-id: ([a-zA-Z0-9-]+)'))
  .flat()
  .filter(id => id)

return {
  clusterId: clusterIds[0],
  allClusterIds: [...new Set(clusterIds)],
  messageCount: messages.length
}`}
            />
          </Form.Item>
        )}
        
        {scriptType === 'jsonpath' && (
          <Form.Item label="JSONPath Expression" name="script">
            <Input placeholder="$.messages[*].body" />
          </Form.Item>
        )}
        
        {scriptType === 'regex' && (
          <>
            <Form.Item label="Regular Expression" name="script">
              <Input placeholder="cluster-id: ([a-zA-Z0-9-]+)" />
            </Form.Item>
            <Form.Item label="Input Field Path" name="inputField">
              <Input placeholder="messages[0].body" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}
```

## Phase 4: Workflow Variables System

### Backend Variables Service
```typescript
// backend/src/services/WorkflowVariableService.ts
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
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
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
}
```

### Frontend Variables Panel
```typescript
// frontend/src/components/WorkflowVariablesPanel.tsx
const WorkflowVariablesPanel: React.FC<{
  variables: WorkflowVariable[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
}> = ({ variables, values, onChange }) => {
  return (
    <div className="workflow-variables-panel">
      <h3>Workflow Variables</h3>
      <Form
        layout="vertical"
        initialValues={values}
        onValuesChange={(_, allValues) => onChange(allValues)}
      >
        {variables.map(variable => (
          <Form.Item
            key={variable.name}
            label={variable.name}
            name={variable.name}
            help={variable.description}
            rules={[
              { required: variable.required, message: `${variable.name} is required` },
              variable.validation?.pattern && {
                pattern: new RegExp(variable.validation.pattern),
                message: 'Invalid format'
              }
            ].filter(Boolean)}
          >
            {renderVariableInput(variable)}
          </Form.Item>
        ))}
      </Form>
    </div>
  )
}

const renderVariableInput = (variable: WorkflowVariable) => {
  switch (variable.type) {
    case 'string':
      if (variable.validation?.options) {
        return (
          <Select placeholder={`Select ${variable.name}`}>
            {variable.validation.options.map(option => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
        )
      }
      return <Input placeholder={variable.description} />
    
    case 'number':
      return (
        <InputNumber
          min={variable.validation?.min}
          max={variable.validation?.max}
          placeholder={variable.description}
        />
      )
    
    case 'boolean':
      return <Switch />
    
    case 'array':
      return (
        <Select mode="tags" placeholder="Enter values and press Enter">
          {variable.validation?.options?.map(option => (
            <Option key={option} value={option}>{option}</Option>
          ))}
        </Select>
      )
    
    default:
      return <TextArea placeholder={variable.description} />
  }
}
```

## Phase 5: Workflow Templates

### Template System
```typescript
// backend/src/services/WorkflowTemplateService.ts
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
}

export class WorkflowTemplateService {
  private templates: Map<string, WorkflowTemplate> = new Map()
  
  constructor() {
    this.loadBuiltInTemplates()
  }
  
  private loadBuiltInTemplates() {
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
          description: 'Name of the DLQ to monitor'
        },
        {
          name: 'keywords',
          type: 'array',
          defaultValue: ['ERROR', 'FAILED', 'TIMEOUT'],
          description: 'Keywords to search for in messages'
        },
        {
          name: 'timeWindow',
          type: 'string',
          defaultValue: '24h',
          validation: { options: ['1h', '6h', '12h', '24h', '7d'] },
          description: 'Time window for log analysis'
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
              pollDurationSeconds: 60
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
                
                return {
                  relevantMessages,
                  clusterIds: [...new Set(clusterIds)],
                  primaryClusterId: clusterIds[0]
                }
              `
            }
          }
        }
        // Add more nodes...
      ],
      edges: [
        {
          id: 'e1',
          source: 'sqs-poll',
          target: 'parse-messages'
        }
        // Add more edges...
      ],
      tags: ['dlq', 'monitoring', 'emr'],
      version: '1.0.0'
    })
    
    // Add more templates...
  }
  
  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id)
  }
  
  listTemplates(category?: string): WorkflowTemplate[] {
    const templates = Array.from(this.templates.values())
    return category ? templates.filter(t => t.category === category) : templates
  }
  
  instantiateTemplate(templateId: string, variables: Record<string, any>): {
    nodes: any[]
    edges: any[]
  } {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }
    
    // Validate variables
    const validation = new WorkflowVariableService().validateVariables(variables, template.variables)
    if (!validation.isValid) {
      throw new Error(`Variable validation failed: ${validation.errors.join(', ')}`)
    }
    
    // Substitute variables in template
    const dataPassingService = new DataPassingService()
    
    // Add workflow variables to context
    const workflowContext = { workflow: variables }
    
    const processedNodes = template.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        config: this.substituteTemplateVariables(node.data.config, workflowContext)
      }
    }))
    
    return {
      nodes: processedNodes,
      edges: template.edges
    }
  }
  
  private substituteTemplateVariables(config: any, context: any): any {
    const configStr = JSON.stringify(config)
    const substituted = configStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path)
      return JSON.stringify(value)
    })
    return JSON.parse(substituted)
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}
```

## Implementation Priority

1. **Phase 1** (Week 1-2): Implement Athena and SNS nodes
2. **Phase 2** (Week 3): Enhance existing DynamoDB and CloudWatch nodes  
3. **Phase 3** (Week 4): Enhanced Transform node with JavaScript execution
4. **Phase 4** (Week 5): Workflow variables system
5. **Phase 5** (Week 6): Template system and built-in templates

This implementation plan provides the foundation to build all your workflow examples and many more complex scenarios.
