import React, { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { SwapOutlined, SettingOutlined } from '@ant-design/icons'
import { Modal, Form, Select, Input, Button, Tooltip } from 'antd'

const { TextArea } = Input
const { Option } = Select

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

const TransformNode: React.FC<TransformNodeProps> = memo(({ data, selected, id, onConfigUpdate }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [form] = Form.useForm()

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
        width={800}
        okText="Save Configuration"
      >
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
