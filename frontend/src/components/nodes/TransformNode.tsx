import React, { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { SwapOutlined, SettingOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons'
import { Modal, Form, Select, Input, Button, Tooltip, Switch, Card, Badge, Collapse, message } from 'antd'

const { TextArea } = Input
const { Option } = Select
const { Panel } = Collapse

interface TransformNodeData {
  label: string
  config: {
    scriptType?: 'javascript' | 'jsonpath' | 'regex'
    script?: string
    inputSource?: string
    inputField?: string
    description?: string
  }
}

interface TransformNodeProps {
  data: TransformNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
}

interface AISuggestion {
  confidence: number
  description: string
  code: string
  reasoning: string
  expectedOutput?: any
  inputDataSource?: string
  validation?: {
    isValid: boolean
    errors: string[]
  }
}

const TransformNode: React.FC<TransformNodeProps> = memo(({ data, selected, id, onConfigUpdate }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [form] = Form.useForm()
  
  // AI Assistant State
  const [aiMode, setAiMode] = useState(false)
  const [userIntent, setUserIntent] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [sourceNodeType, setSourceNodeType] = useState('')
  const [targetNodeType, setTargetNodeType] = useState('')

  const handleConfigClick = () => {
    form.setFieldsValue(data.config)
    setIsConfigModalVisible(true)
  }

  const handleConfigSave = async () => {
    try {
      const values = await form.validateFields()
      onConfigUpdate?.(id, values)
      setIsConfigModalVisible(false)
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const getScriptPlaceholder = (scriptType: string) => {
    switch (scriptType) {
      case 'javascript':
        return `// Transform the input data
// Available: data (input data), extractPattern, parseJSON, formatDate
// Available: filterArray, groupBy, sortBy, unique, sum, count, flatten
// Available: slugify, capitalize, Math, Date
// Return the transformed result

const messages = data.messages || []
const clusterIds = messages
  .map(msg => extractPattern(msg.body, 'cluster-id: ([a-zA-Z0-9-]+)'))
  .flat()
  .filter(id => id)

return {
  clusterId: clusterIds[0],
  allClusterIds: unique(clusterIds),
  messageCount: messages.length,
  errorMessages: filterArray(messages, 'body contains "ERROR"')
}`

      case 'jsonpath':
        return `// JSONPath expression to extract data
// Examples:
// $.messages[*].body - Get all message bodies
// $.items[0].id - Get first item's ID
// $.events[*].timestamp - Get all timestamps

$.messages[*].body`

      case 'regex':
        return `// Regular expression pattern
// Use capture groups () to extract specific parts
// Examples:
// cluster-id: ([a-zA-Z0-9-]+) - Extract cluster ID
// error code: (\\d+) - Extract error codes
// user: (\\w+) - Extract usernames

cluster-id: ([a-zA-Z0-9-]+)`

      default:
        return ''
    }
  }

  const getScriptTypeDescription = (scriptType: string) => {
    switch (scriptType) {
      case 'javascript':
        return 'Execute JavaScript code with utility functions for data transformation'
      case 'jsonpath':
        return 'Use JSONPath expressions to extract specific data from JSON objects'
      case 'regex':
        return 'Apply regular expressions to extract patterns from text data'
      default:
        return ''
    }
  }

  // AI Assistant Functions
  const generateAITransformation = async () => {
    if (!userIntent.trim()) {
      message.warning('Please describe what you want to transform')
      return
    }

    if (!sourceNodeType || !targetNodeType) {
      message.warning('Please specify source and target node types')
      return
    }

    setIsGeneratingAI(true)
    try {
      const response = await fetch('/api/ai/generate-transformation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIntent,
          sourceNodeType,
          targetNodeType,
          sampleData: getSampleData(),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.suggestions) {
        setAiSuggestions(result.suggestions)
        message.success(`Generated ${result.suggestions.length} AI suggestion(s)`)
      } else {
        throw new Error(result.error || 'Failed to generate AI suggestions')
      }
    } catch (error: any) {
      console.error('AI generation failed:', error)
      message.error(`AI generation failed: ${error.message}`)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const getSampleData = () => {
    // Generate sample data based on source node type
    const sampleDataMap: Record<string, any> = {
      sqs: {
        messages: [
          {
            messageId: 'sample-123',
            body: '{"level":"ERROR","message":"Database connection failed","userId":"user-456"}',
            attributes: {
              SentTimestamp: Date.now().toString()
            }
          }
        ]
      },
      cloudwatch: {
        events: [
          {
            timestamp: Date.now(),
            message: 'user_id: user-123 action: login request_id: req-456',
            logStream: 'sample-log-stream'
          }
        ]
      },
      dynamodb: {
        items: [
          {
            id: 'item-123',
            userId: 'user-456',
            timestamp: new Date().toISOString(),
            data: { action: 'sample' }
          }
        ]
      }
    }

    return sampleDataMap[sourceNodeType.toLowerCase()] || {}
  }

  const acceptAISuggestion = (suggestion: AISuggestion) => {
    form.setFieldsValue({
      scriptType: 'javascript',
      script: suggestion.code,
      description: suggestion.description,
      inputSource: suggestion.inputDataSource
    })
    setAiSuggestions([])
    message.success('AI suggestion applied successfully')
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#52c41a'
    if (confidence >= 0.6) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <>
      <div className={`aws-node node-transform ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <SwapOutlined className="aws-node-icon" />
          Transform
          <Tooltip title="Configure Transform">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={handleConfigClick}
              className="aws-node-config-btn"
            />
          </Tooltip>
        </div>
        
        <div className="aws-node-content">
          {data.config.scriptType && (
            <div className="config-item">
              <strong>Type:</strong> {data.config.scriptType}
            </div>
          )}
          {data.config.inputSource && (
            <div className="config-item">
              <strong>Input:</strong> {data.config.inputSource}
            </div>
          )}
          {data.config.script && (
            <div className="config-item">
              <strong>Script:</strong> {data.config.script.substring(0, 50)}
              {data.config.script.length > 50 ? '...' : ''}
            </div>
          )}
          {data.config.description && (
            <div className="config-item description">
              {data.config.description}
            </div>
          )}
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure Transform Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={1000}
        okText="Save Configuration"
      >
        {/* AI Assistant Section */}
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f0f8ff', borderRadius: 8, border: '1px solid #d6f7ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ fontSize: 18, color: '#1890ff' }} />
              <span style={{ fontWeight: 600, fontSize: 16 }}>AI Assistant</span>
              <Badge count="NEW" style={{ backgroundColor: '#52c41a' }} />
            </div>
            <Switch
              checked={aiMode}
              onChange={setAiMode}
              checkedChildren="AI ON"
              unCheckedChildren="AI OFF"
            />
          </div>

          {aiMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Select
                  placeholder="Source Node Type"
                  value={sourceNodeType}
                  onChange={setSourceNodeType}
                  style={{ flex: 1 }}
                >
                  <Option value="sqs">SQS</Option>
                  <Option value="cloudwatch">CloudWatch</Option>
                  <Option value="dynamodb">DynamoDB</Option>
                  <Option value="s3">S3</Option>
                  <Option value="lambda">Lambda</Option>
                  <Option value="sns">SNS</Option>
                </Select>
                <span style={{ alignSelf: 'center', color: '#666' }}>→</span>
                <Select
                  placeholder="Target Node Type"
                  value={targetNodeType}
                  onChange={setTargetNodeType}
                  style={{ flex: 1 }}
                >
                  <Option value="sqs">SQS</Option>
                  <Option value="cloudwatch">CloudWatch</Option>
                  <Option value="dynamodb">DynamoDB</Option>
                  <Option value="s3">S3</Option>
                  <Option value="lambda">Lambda</Option>
                  <Option value="sns">SNS</Option>
                </Select>
              </div>

              <TextArea
                placeholder="Describe what you want to transform (e.g., 'Extract error messages from SQS and create CloudWatch metrics')"
                value={userIntent}
                onChange={(e) => setUserIntent(e.target.value)}
                rows={3}
                style={{ fontSize: 14 }}
              />

              <Button
                type="primary"
                icon={isGeneratingAI ? <LoadingOutlined /> : <RobotOutlined />}
                onClick={generateAITransformation}
                loading={isGeneratingAI}
                disabled={!userIntent.trim() || !sourceNodeType || !targetNodeType}
                style={{ alignSelf: 'flex-start' }}
              >
                {isGeneratingAI ? 'Generating...' : 'Generate AI Transformation'}
              </Button>

              {aiSuggestions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ marginBottom: 12, color: '#1890ff' }}>AI Suggestions:</h4>
                  {aiSuggestions.map((suggestion, index) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ marginBottom: 12 }}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{suggestion.description}</span>
                          <Badge
                            count={`${Math.round(suggestion.confidence * 100)}%`}
                            style={{ backgroundColor: getConfidenceColor(suggestion.confidence) }}
                          />
                        </div>
                      }
                      extra={
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => acceptAISuggestion(suggestion)}
                        >
                          Use This Code
                        </Button>
                      }
                    >
                      <Collapse size="small">
                        <Panel header="Generated Code" key="code">
                          <pre style={{ 
                            backgroundColor: '#f6f8fa', 
                            padding: 12, 
                            borderRadius: 4, 
                            fontSize: 12,
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                            overflow: 'auto',
                            maxHeight: 200
                          }}>
                            {suggestion.code}
                          </pre>
                        </Panel>
                        {suggestion.inputDataSource && (
                          <Panel header="Recommended Input Data Source" key="inputSource">
                            <div style={{ 
                              backgroundColor: '#f0f8ff', 
                              padding: 8, 
                              borderRadius: 4, 
                              fontSize: 13,
                              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                              border: '1px solid #d6f7ff'
                            }}>
                              {suggestion.inputDataSource}
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                              This will be automatically filled in the "Input Data Source" field when you use this code.
                            </div>
                          </Panel>
                        )}
                        <Panel header="AI Explanation" key="explanation">
                          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                            {suggestion.reasoning}
                          </div>
                        </Panel>
                        {suggestion.validation && !suggestion.validation.isValid && (
                          <Panel header="Validation Issues" key="validation">
                            <div style={{ color: '#ff4d4f' }}>
                              {suggestion.validation.errors.map((error, i) => (
                                <div key={i}>• {error}</div>
                              ))}
                            </div>
                          </Panel>
                        )}
                      </Collapse>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Form form={form} layout="vertical">
          <Form.Item
            label="Script Type"
            name="scriptType"
            rules={[{ required: true, message: 'Please select a script type' }]}
            help="Choose the type of transformation to perform"
          >
            <Select placeholder="Select script type">
              <Option value="javascript">JavaScript</Option>
              <Option value="jsonpath">JSONPath</Option>
              <Option value="regex">Regular Expression</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Input Data Source"
            name="inputSource"
            rules={[{ required: true, message: 'Please specify the input data source' }]}
            help="Reference data from previous nodes using {{nodeId.extractedData}} syntax"
          >
            <Input placeholder="{{cloudwatch-1.extractedData}}" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.scriptType !== currentValues.scriptType}
          >
            {({ getFieldValue }) => {
              const scriptType = getFieldValue('scriptType')
              
              if (!scriptType) return null

              return (
                <>
                  <Form.Item
                    label={`${scriptType.charAt(0).toUpperCase() + scriptType.slice(1)} ${scriptType === 'javascript' ? 'Code' : scriptType === 'jsonpath' ? 'Expression' : 'Pattern'}`}
                    name="script"
                    rules={[{ required: true, message: `Please enter the ${scriptType} ${scriptType === 'javascript' ? 'code' : scriptType === 'jsonpath' ? 'expression' : 'pattern'}` }]}
                    help={getScriptTypeDescription(scriptType)}
                  >
                    <TextArea
                      rows={scriptType === 'javascript' ? 12 : 4}
                      placeholder={getScriptPlaceholder(scriptType)}
                      style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
                    />
                  </Form.Item>

                  {scriptType === 'regex' && (
                    <Form.Item
                      label="Input Field Path"
                      name="inputField"
                      help="Specify which field to apply the regex to (e.g., 'messages[0].body')"
                    >
                      <Input placeholder="messages[0].body" />
                    </Form.Item>
                  )}
                </>
              )
            }}
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            help="Optional description of what this transformation does"
          >
            <Input placeholder="Extract cluster IDs from log messages" />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6f8fa', borderRadius: 6 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Available Utility Functions (JavaScript):</h4>
          <div style={{ fontSize: 12, color: '#666' }}>
            <strong>Data Processing:</strong> extractPattern, parseJSON, formatDate, filterArray, groupBy, sortBy, unique, sum, count, flatten<br/>
            <strong>String Utils:</strong> slugify, capitalize<br/>
            <strong>Built-ins:</strong> Math (round, floor, ceil, min, max, abs), Date (now, parse)
          </div>
        </div>
      </Modal>
    </>
  )
})

TransformNode.displayName = 'TransformNode'

export default TransformNode
