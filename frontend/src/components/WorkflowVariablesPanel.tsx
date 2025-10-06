import React, { useState, useEffect } from 'react'
import { 
  Form, 
  Input, 
  InputNumber, 
  Switch, 
  Select, 
  Button, 
  Card, 
  Space, 
  Modal, 
  Tooltip, 
  Tag,
  Divider,
  Alert
} from 'antd'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SettingOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons'

const { TextArea } = Input
const { Option } = Select

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

interface WorkflowVariablesPanelProps {
  variables: WorkflowVariable[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  onVariablesChange?: (variables: WorkflowVariable[]) => void
  editable?: boolean
}

const WorkflowVariablesPanel: React.FC<WorkflowVariablesPanelProps> = ({
  variables,
  values,
  onChange,
  onVariablesChange,
  editable = false
}) => {
  const [form] = Form.useForm()
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingVariable, setEditingVariable] = useState<WorkflowVariable | null>(null)
  const [editForm] = Form.useForm()

  useEffect(() => {
    // Apply default values when variables change
    const newValues = { ...values }
    let hasChanges = false

    variables.forEach(variable => {
      if (variable.defaultValue !== undefined && (newValues[variable.name] === undefined || newValues[variable.name] === null)) {
        newValues[variable.name] = variable.defaultValue
        hasChanges = true
      }
    })

    if (hasChanges) {
      onChange(newValues)
    }

    // Update form values
    form.setFieldsValue(newValues)
  }, [variables, form])

  const handleValuesChange = (changedValues: any, allValues: any) => {
    onChange(allValues)
  }

  const handleAddVariable = () => {
    setEditingVariable(null)
    editForm.resetFields()
    setEditModalVisible(true)
  }

  const handleEditVariable = (variable: WorkflowVariable) => {
    setEditingVariable(variable)
    editForm.setFieldsValue({
      ...variable,
      validationOptions: variable.validation?.options?.join('\n') || ''
    })
    setEditModalVisible(true)
  }

  const handleDeleteVariable = (variableName: string) => {
    if (!onVariablesChange) return

    Modal.confirm({
      title: 'Delete Variable',
      content: `Are you sure you want to delete the variable "${variableName}"?`,
      onOk: () => {
        const newVariables = variables.filter(v => v.name !== variableName)
        onVariablesChange(newVariables)
        
        // Remove from values
        const newValues = { ...values }
        delete newValues[variableName]
        onChange(newValues)
      }
    })
  }

  const handleSaveVariable = async () => {
    try {
      const formValues = await editForm.validateFields()
      
      const newVariable: WorkflowVariable = {
        name: formValues.name,
        type: formValues.type,
        description: formValues.description,
        required: formValues.required || false,
        defaultValue: formValues.defaultValue,
        validation: {
          pattern: formValues.pattern,
          min: formValues.min,
          max: formValues.max,
          options: formValues.validationOptions 
            ? formValues.validationOptions.split('\n').map((s: string) => s.trim()).filter((s: string) => s)
            : undefined
        }
      }

      if (!onVariablesChange) return

      let newVariables
      if (editingVariable) {
        // Update existing variable
        newVariables = variables.map(v => 
          v.name === editingVariable.name ? newVariable : v
        )
      } else {
        // Add new variable
        newVariables = [...variables, newVariable]
      }

      onVariablesChange(newVariables)
      setEditModalVisible(false)
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const renderVariableInput = (variable: WorkflowVariable) => {
    const commonProps = {
      placeholder: variable.description
    }

    switch (variable.type) {
      case 'string':
        if (variable.validation?.options) {
          return (
            <Select {...commonProps} placeholder={`Select ${variable.name}`}>
              {variable.validation.options.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          )
        }
        return variable.validation?.pattern ? (
          <Input {...commonProps} />
        ) : (
          <Input {...commonProps} />
        )
      
      case 'number':
        return (
          <InputNumber
            {...commonProps}
            min={variable.validation?.min}
            max={variable.validation?.max}
            style={{ width: '100%' }}
          />
        )
      
      case 'boolean':
        return <Switch />
      
      case 'array':
        if (variable.validation?.options) {
          return (
            <Select mode="tags" {...commonProps} placeholder="Select or enter values">
              {variable.validation.options.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          )
        }
        return (
          <Select mode="tags" {...commonProps} placeholder="Enter values and press Enter" />
        )
      
      case 'object':
        return (
          <TextArea 
            {...commonProps} 
            placeholder="Enter JSON object"
            rows={3}
          />
        )
      
      default:
        return <Input {...commonProps} />
    }
  }

  const getValidationRules = (variable: WorkflowVariable) => {
    const rules: any[] = []
    
    if (variable.required) {
      rules.push({ required: true, message: `${variable.name} is required` })
    }
    
    if (variable.validation?.pattern && variable.type === 'string') {
      rules.push({
        pattern: new RegExp(variable.validation.pattern),
        message: 'Invalid format'
      })
    }
    
    if (variable.type === 'object') {
      rules.push({
        validator: (_: any, value: string) => {
          if (!value) return Promise.resolve()
          try {
            JSON.parse(value)
            return Promise.resolve()
          } catch {
            return Promise.reject(new Error('Must be valid JSON'))
          }
        }
      })
    }
    
    return rules
  }

  if (variables.length === 0 && !editable) {
    return (
      <Card size="small" title="Workflow Variables">
        <Alert 
          message="No variables defined" 
          description="This workflow doesn't use any variables."
          type="info" 
          showIcon 
        />
      </Card>
    )
  }

  return (
    <>
      <Card 
        size="small" 
        title={
          <Space>
            <SettingOutlined />
            Workflow Variables
            {variables.length > 0 && (
              <Tag color="blue">{variables.length}</Tag>
            )}
          </Space>
        }
        extra={editable && (
          <Button 
            type="primary" 
            size="small" 
            icon={<PlusOutlined />}
            onClick={handleAddVariable}
          >
            Add Variable
          </Button>
        )}
      >
        {variables.length > 0 ? (
          <Form
            form={form}
            layout="vertical"
            initialValues={values}
            onValuesChange={handleValuesChange}
            size="small"
          >
            {variables.map(variable => (
              <Form.Item
                key={variable.name}
                label={
                  <Space>
                    <span>{variable.name}</span>
                    {variable.required && <Tag color="red">Required</Tag>}
                    <Tag color="geekblue">{variable.type}</Tag>
                    {editable && (
                      <Space size="small">
                        <Tooltip title="Edit Variable">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditVariable(variable)}
                          />
                        </Tooltip>
                        <Tooltip title="Delete Variable">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteVariable(variable.name)}
                          />
                        </Tooltip>
                      </Space>
                    )}
                  </Space>
                }
                name={variable.name}
                help={variable.description}
                rules={getValidationRules(variable)}
              >
                {renderVariableInput(variable)}
              </Form.Item>
            ))}
          </Form>
        ) : (
          <Alert 
            message="No variables defined" 
            description="Click 'Add Variable' to create workflow variables."
            type="info" 
            showIcon 
          />
        )}
      </Card>

      <Modal
        title={editingVariable ? 'Edit Variable' : 'Add Variable'}
        open={editModalVisible}
        onOk={handleSaveVariable}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="Variable Name"
            name="name"
            rules={[
              { required: true, message: 'Variable name is required' },
              { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid variable name format' }
            ]}
            help="Must start with letter or underscore, contain only letters, numbers, and underscores"
          >
            <Input placeholder="myVariable" disabled={!!editingVariable} />
          </Form.Item>

          <Form.Item
            label="Type"
            name="type"
            rules={[{ required: true, message: 'Type is required' }]}
          >
            <Select placeholder="Select variable type">
              <Option value="string">String</Option>
              <Option value="number">Number</Option>
              <Option value="boolean">Boolean</Option>
              <Option value="array">Array</Option>
              <Option value="object">Object</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            help="Optional description of what this variable is used for"
          >
            <Input placeholder="Description of the variable" />
          </Form.Item>

          <Form.Item name="required" valuePropName="checked">
            <Space>
              <Switch />
              <span>Required</span>
              <Tooltip title="If checked, this variable must be provided when executing the workflow">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          </Form.Item>

          <Form.Item
            label="Default Value"
            name="defaultValue"
            help="Optional default value used when variable is not provided"
          >
            <Input placeholder="Default value" />
          </Form.Item>

          <Divider orientation="left">Validation</Divider>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              
              return (
                <>
                  {type === 'string' && (
                    <Form.Item
                      label="Pattern (Regex)"
                      name="pattern"
                      help="Optional regular expression pattern for validation"
                    >
                      <Input placeholder="^[A-Z][a-z]+$" />
                    </Form.Item>
                  )}

                  {type === 'number' && (
                    <>
                      <Form.Item label="Minimum Value" name="min">
                        <InputNumber placeholder="0" style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item label="Maximum Value" name="max">
                        <InputNumber placeholder="100" style={{ width: '100%' }} />
                      </Form.Item>
                    </>
                  )}

                  {(type === 'string' || type === 'array') && (
                    <Form.Item
                      label="Allowed Options"
                      name="validationOptions"
                      help="Optional list of allowed values (one per line)"
                    >
                      <TextArea 
                        placeholder="option1&#10;option2&#10;option3"
                        rows={4}
                      />
                    </Form.Item>
                  )}
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default WorkflowVariablesPanel
