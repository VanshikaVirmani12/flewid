import React, { useState, useEffect } from 'react'
import { Modal, Input, Button, List, Tag, Typography, Collapse, message, Tooltip } from 'antd'
import { CopyOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text, Title } = Typography
const { Panel } = Collapse
const { TextArea } = Input

interface VariableHelperProps {
  visible: boolean
  onClose: () => void
  onInsertVariable: (variable: string) => void
  availableNodes?: string[]
}

interface AvailableVariable {
  nodeId: string
  nodeType: string
  variables: string[]
  sampleData?: any
}

const VariableHelper: React.FC<VariableHelperProps> = ({
  visible,
  onClose,
  onInsertVariable,
  availableNodes = []
}) => {
  const [availableVariables, setAvailableVariables] = useState<AvailableVariable[]>([])
  const [loading, setLoading] = useState(false)
  const [previewInput, setPreviewInput] = useState('')
  const [previewResult, setPreviewResult] = useState<any>(null)

  useEffect(() => {
    if (visible) {
      loadAvailableVariables()
    }
  }, [visible])

  const loadAvailableVariables = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/variables/available')
      const result = await response.json()
      
      if (result.success) {
        const variables: AvailableVariable[] = Object.entries(result.variables).map(([nodeId, data]: [string, any]) => ({
          nodeId,
          nodeType: data.nodeType,
          variables: Object.keys(data.extractedData || {}),
          sampleData: data.extractedData
        }))
        
        setAvailableVariables(variables)
      }
    } catch (error) {
      message.error('Failed to load available variables')
    } finally {
      setLoading(false)
    }
  }

  const handleVariableClick = (nodeId: string, variableName: string) => {
    const variableExpression = `{{${nodeId}.extractedData.${variableName}}}`
    onInsertVariable(variableExpression)
    message.success(`Inserted variable: ${variableExpression}`)
  }

  const handleArrayVariableClick = (nodeId: string, variableName: string, index: number = 0) => {
    const variableExpression = `{{${nodeId}.extractedData.${variableName}[${index}]}}`
    onInsertVariable(variableExpression)
    message.success(`Inserted array variable: ${variableExpression}`)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Copied to clipboard')
  }

  const previewSubstitution = async () => {
    if (!previewInput.trim()) {
      message.warning('Please enter some text to preview')
      return
    }

    try {
      const response = await fetch('/api/variables/substitute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: previewInput,
          type: 'string'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setPreviewResult(result.result)
      } else {
        message.error('Failed to preview substitution')
      }
    } catch (error) {
      message.error('Failed to preview substitution')
    }
  }

  const renderVariableValue = (value: any, nodeId: string, variableName: string) => {
    if (Array.isArray(value)) {
      return (
        <div>
          <Text type="secondary">Array ({value.length} items)</Text>
          <div style={{ marginTop: 4 }}>
            <Button 
              size="small" 
              type="link" 
              onClick={() => handleArrayVariableClick(nodeId, variableName, 0)}
              style={{ padding: '0 4px' }}
            >
              [0] - First item
            </Button>
            {value.length > 1 && (
              <Button 
                size="small" 
                type="link" 
                onClick={() => handleArrayVariableClick(nodeId, variableName, value.length - 1)}
                style={{ padding: '0 4px' }}
              >
                [{value.length - 1}] - Last item
              </Button>
            )}
          </div>
          <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
            Sample: {JSON.stringify(value.slice(0, 3))}
            {value.length > 3 && '...'}
          </div>
        </div>
      )
    } else if (typeof value === 'object' && value !== null) {
      return (
        <div>
          <Text type="secondary">Object</Text>
          <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
            {JSON.stringify(value).substring(0, 100)}
            {JSON.stringify(value).length > 100 && '...'}
          </div>
        </div>
      )
    } else {
      return (
        <div>
          <Text>{String(value)}</Text>
        </div>
      )
    }
  }

  return (
    <Modal
      title="Variable Helper"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
    >
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <Collapse defaultActiveKey={['syntax', 'available']}>
          <Panel header="Variable Syntax" key="syntax">
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>How to use variables:</Title>
              <List size="small">
                <List.Item>
                  <Text code>{'{{nodeId.extractedData.variableName}}'}</Text> - Access a simple variable
                </List.Item>
                <List.Item>
                  <Text code>{'{{nodeId.extractedData.arrayName[0]}}'}</Text> - Access first item in array
                </List.Item>
                <List.Item>
                  <Text code>{'{{nodeId.extractedData.arrayName[1]}}'}</Text> - Access second item in array
                </List.Item>
                <List.Item>
                  <Text code>{'{{nodeId.data.rawField}}'}</Text> - Access raw output data
                </List.Item>
              </List>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>Examples:</Title>
              <List size="small">
                <List.Item>
                  <Text>Table name: </Text>
                  <Tag color="blue">{'{{cloudwatch.extractedData.userIds[0]}}'}</Tag>
                </List.Item>
                <List.Item>
                  <Text>Filter expression: </Text>
                  <Tag color="green">userId={'={{dynamodb.extractedData.userIdValues[0]}}'}</Tag>
                </List.Item>
                <List.Item>
                  <Text>Log group: </Text>
                  <Tag color="orange">/aws/lambda/{'{{lambda.extractedData.functionName}}'}</Tag>
                </List.Item>
              </List>
            </div>
          </Panel>

          <Panel header={`Available Variables (${availableVariables.length} nodes)`} key="available">
            {loading ? (
              <div>Loading available variables...</div>
            ) : availableVariables.length === 0 ? (
              <div>
                <Text type="secondary">
                  No variables available yet. Execute some nodes first to see their output variables here.
                </Text>
              </div>
            ) : (
              <Collapse size="small">
                {availableVariables.map((nodeVar) => (
                  <Panel 
                    header={
                      <div>
                        <Tag color="blue">{nodeVar.nodeType}</Tag>
                        <Text strong>{nodeVar.nodeId}</Text>
                        <Text type="secondary"> ({nodeVar.variables.length} variables)</Text>
                      </div>
                    } 
                    key={nodeVar.nodeId}
                  >
                    {nodeVar.variables.length === 0 ? (
                      <Text type="secondary">No extracted variables from this node</Text>
                    ) : (
                      <List
                        size="small"
                        dataSource={nodeVar.variables}
                        renderItem={(variableName) => (
                          <List.Item
                            actions={[
                              <Tooltip title="Click to insert variable">
                                <Button
                                  size="small"
                                  type="link"
                                  icon={<CopyOutlined />}
                                  onClick={() => handleVariableClick(nodeVar.nodeId, variableName)}
                                >
                                  Insert
                                </Button>
                              </Tooltip>
                            ]}
                          >
                            <div style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <Text strong>{variableName}</Text>
                                  <div style={{ marginTop: 4 }}>
                                    {renderVariableValue(
                                      nodeVar.sampleData?.[variableName], 
                                      nodeVar.nodeId, 
                                      variableName
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </Panel>
                ))}
              </Collapse>
            )}
          </Panel>

          <Panel header="Preview Substitution" key="preview">
            <div style={{ marginBottom: 16 }}>
              <Text>Enter text with variables to see how they will be substituted:</Text>
              <TextArea
                rows={3}
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                placeholder="Enter text like: userId={{cloudwatch.extractedData.userIds[0]}}"
                style={{ marginTop: 8 }}
              />
              <Button 
                type="primary" 
                onClick={previewSubstitution}
                style={{ marginTop: 8 }}
                disabled={!previewInput.trim()}
              >
                Preview Substitution
              </Button>
            </div>
            
            {previewResult !== null && (
              <div>
                <Text strong>Result:</Text>
                <div style={{ 
                  marginTop: 8, 
                  padding: 12, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 4,
                  fontFamily: 'monospace'
                }}>
                  {previewResult}
                </div>
              </div>
            )}
          </Panel>
        </Collapse>
      </div>
    </Modal>
  )
}

export default VariableHelper
