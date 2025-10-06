import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined, FunctionOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert, Select } from 'antd'
import DynamoDBIcon from '../icons/DynamoDBIcon'
import VariableHelper from '../VariableHelper'

const { Option } = Select

interface DynamoDBNodeData {
  label: string
  config: {
    tableName?: string
    operation?: string
    partitionKey?: string
    partitionKeyValue?: string
    sortKey?: string
    sortKeyValue?: string
    indexName?: string
    filterExpression?: string
    limit?: number
  }
}

interface DynamoDBNodeProps {
  data: DynamoDBNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const DynamoDBNode: React.FC<DynamoDBNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [isVariableHelperVisible, setIsVariableHelperVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeField, setActiveField] = useState<string>('')
  const [form] = Form.useForm()

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Set form values from current config
    form.setFieldsValue({
      tableName: data.config.tableName || '',
      operation: data.config.operation || 'scan',
      partitionKey: data.config.partitionKey || '',
      partitionKeyValue: data.config.partitionKeyValue || '',
      sortKey: data.config.sortKey || '',
      sortKeyValue: data.config.sortKeyValue || '',
      indexName: data.config.indexName || '',
      filterExpression: data.config.filterExpression || '',
      limit: data.config.limit || 25
    })
  }, [data.config, form])

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  const validateFilterExpression = (filterExpression: string): { isValid: boolean; error?: string } => {
    if (!filterExpression || filterExpression.trim() === '') {
      return { isValid: true } // Empty is allowed
    }

    const trimmedExpression = filterExpression.trim()

    // Handle simple equality filters like "Status=ACTIVE" or "attribute=value"
    const equalityMatch = trimmedExpression.match(/^(\w+)\s*=\s*(.+)$/)
    if (equalityMatch) {
      const [, attributeName, attributeValue] = equalityMatch
      
      // Validate attribute name (must be alphanumeric and underscores)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}'. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      // Validate attribute value (cannot be empty)
      const cleanValue = attributeValue.trim().replace(/^["']|["']$/g, '')
      if (cleanValue === '') {
        return { 
          isValid: false, 
          error: `Attribute value cannot be empty in '${trimmedExpression}'` 
        }
      }

      return { isValid: true }
    }

    // Handle attribute_exists function
    const attributeExistsMatch = trimmedExpression.match(/^attribute_exists\s*\(\s*([^)]+)\s*\)$/)
    if (attributeExistsMatch) {
      const attributeName = attributeExistsMatch[1].trim().replace(/["']/g, '')
      
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in attribute_exists function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      return { isValid: true }
    }

    // Handle contains function
    const containsMatch = trimmedExpression.match(/^contains\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/)
    if (containsMatch) {
      const attributeName = containsMatch[1].trim().replace(/["']/g, '')
      const searchValue = containsMatch[2].trim().replace(/["']/g, '')

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in contains function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      if (searchValue === '') {
        return { 
          isValid: false, 
          error: `Search value cannot be empty in contains function '${trimmedExpression}'` 
        }
      }

      return { isValid: true }
    }

    // Handle begins_with function
    const beginsWithMatch = trimmedExpression.match(/^begins_with\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/)
    if (beginsWithMatch) {
      const attributeName = beginsWithMatch[1].trim().replace(/["']/g, '')
      const prefixValue = beginsWithMatch[2].trim().replace(/["']/g, '')

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
        return { 
          isValid: false, 
          error: `Invalid attribute name '${attributeName}' in begins_with function. Attribute names must start with a letter or underscore and contain only letters, numbers, and underscores.` 
        }
      }

      if (prefixValue === '') {
        return { 
          isValid: false, 
          error: `Prefix value cannot be empty in begins_with function '${trimmedExpression}'` 
        }
      }

      return { isValid: true }
    }

    // If none of the patterns match, return error with helpful message
    return {
      isValid: false,
      error: `Invalid filter expression format '${trimmedExpression}'. Supported formats:
• Equality: attribute=value (e.g., Status=ACTIVE)
• Contains: contains(attribute,value) (e.g., contains(name,John))
• Begins with: begins_with(attribute,value) (e.g., begins_with(id,user))
• Attribute exists: attribute_exists(attribute) (e.g., attribute_exists(email))`
    }
  }

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate filter expression if provided
      if (values.filterExpression && values.filterExpression.trim() !== '') {
        const validation = validateFilterExpression(values.filterExpression)
        if (!validation.isValid) {
          showErrorModal(`Filter Expression Error:\n\n${validation.error}`)
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        tableName: values.tableName,
        operation: values.operation,
        partitionKey: values.partitionKey,
        partitionKeyValue: values.partitionKeyValue,
        sortKey: values.sortKey,
        sortKeyValue: values.sortKeyValue,
        indexName: values.indexName,
        filterExpression: values.filterExpression,
        limit: values.limit
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('DynamoDB configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal])

  const handleVariableHelperOpen = useCallback((fieldName: string) => {
    setActiveField(fieldName)
    setIsVariableHelperVisible(true)
  }, [])

  const handleVariableInsert = useCallback((variable: string) => {
    if (activeField) {
      const currentValue = form.getFieldValue(activeField) || ''
      const newValue = currentValue + variable
      form.setFieldValue(activeField, newValue)
    }
    setIsVariableHelperVisible(false)
  }, [form, activeField])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    if (!data.config.tableName) {
      message.warning('Please configure table name first')
      return
    }

    const startTime = Date.now()

    try {
      const requestBody = {
        accountId: 'dev-account-1', // This should come from selected account
        tableName: data.config.tableName,
        operation: data.config.operation || 'scan',
        partitionKey: data.config.partitionKey,
        partitionKeyValue: data.config.partitionKeyValue,
        sortKey: data.config.sortKey,
        sortKeyValue: data.config.sortKeyValue,
        indexName: data.config.indexName,
        filterExpression: data.config.filterExpression,
        limit: data.config.limit || 25
      }
      
      // Call backend API to execute DynamoDB operation
      const response = await fetch('/api/aws/dynamodb/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        const items = result.items || []
        const summary = result.summary || {}
        
        let output = `DynamoDB Query Results:\n`
        output += `Table: ${data.config.tableName}\n`
        output += `Operation: ${data.config.operation || 'scan'}\n`
        if (data.config.indexName) {
          output += `Index: ${data.config.indexName}\n`
        }
        if (data.config.partitionKey && data.config.partitionKeyValue) {
          output += `Partition Key: ${data.config.partitionKey} = ${data.config.partitionKeyValue}\n`
        }
        if (data.config.sortKey && data.config.sortKeyValue) {
          output += `Sort Key: ${data.config.sortKey} = ${data.config.sortKeyValue}\n`
        }
        if (data.config.filterExpression) {
          output += `Filter: ${data.config.filterExpression}\n`
        }
        output += `Items Found: ${items.length}\n`
        output += `Scanned Count: ${summary.scannedCount || 'N/A'}\n`
        output += `Consumed Capacity: ${summary.consumedCapacity || 'N/A'}\n\n`
        
        if (items.length > 0) {
          output += `Items:\n`
          output += `${'='.repeat(50)}\n`
          items.slice(0, 10).forEach((item: any, index: number) => {
            output += `Item ${index + 1}:\n`
            Object.entries(item).forEach(([key, value]) => {
              output += `  ${key}: ${JSON.stringify(value)}\n`
            })
            output += `${'-'.repeat(30)}\n`
          })
          
          if (items.length > 10) {
            output += `... and ${items.length - 10} more items\n`
          }
        } else {
          output += `No items found matching the query criteria\n`
        }

        const executionResult = {
          nodeId: id,
          status: 'success' as const,
          output,
          duration,
          timestamp: new Date().toISOString(),
        }

        // Add result to execution panel
        if (onNodeExecute) {
          onNodeExecute(executionResult)
        }

        message.success(`Found ${items.length} items`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `DynamoDB query failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }

        // Add result to execution panel
        if (onNodeExecute) {
          onNodeExecute(executionResult)
        }

        message.error(`Query failed: ${result.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      const executionResult = {
        nodeId: id,
        status: 'error' as const,
        output: `DynamoDB query error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute DynamoDB query')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  return (
    <>
      <div className={`aws-node node-dynamodb ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <DynamoDBIcon className="aws-node-icon" size={20} />
          <span>DynamoDB</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          {data.config.tableName ? (
            <div className="text-xs mb-1">
              <strong>Table:</strong> {data.config.tableName}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No table configured</div>
          )}
          
          {data.config.operation ? (
            <div className="text-xs mb-1">
              <strong>Operation:</strong> {data.config.operation}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">Operation: scan</div>
          )}
          
          {data.config.partitionKey && data.config.partitionKeyValue ? (
            <div className="text-xs mb-1">
              <strong>Key:</strong> {data.config.partitionKey}={data.config.partitionKeyValue}
            </div>
          ) : null}

          {data.config.indexName ? (
            <div className="text-xs mb-1">
              <strong>Index:</strong> {data.config.indexName}
            </div>
          ) : null}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={!data.config.tableName}
            className="w-full"
          >
            Execute Query
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure DynamoDB Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            tableName: '',
            operation: 'scan',
            partitionKey: '',
            partitionKeyValue: '',
            sortKey: '',
            sortKeyValue: '',
            indexName: '',
            filterExpression: '',
            limit: 25
          }}
        >
          <Alert
            message="DynamoDB Query Configuration"
            description="Configure your DynamoDB query parameters. Use 'scan' to retrieve all items or 'query' to search by partition key."
            type="info"
            showIcon
            className="mb-4"
          />

          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Table Name
                <Button
                  type="text"
                  size="small"
                  icon={<FunctionOutlined />}
                  onClick={() => handleVariableHelperOpen('tableName')}
                  title="Insert variable"
                />
              </div>
            }
            name="tableName"
            rules={[{ required: true, message: 'Please enter a table name' }]}
            help="Enter the DynamoDB table name or use variables like {{cloudwatch.extractedData.tableName}}"
          >
            <Input placeholder="my-table" />
          </Form.Item>

          <Form.Item
            label="Operation"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation' }]}
            help="Choose between scan (all items) or query (by partition key)"
          >
            <Select>
              <Option value="scan">Scan - Retrieve all items</Option>
              <Option value="query">Query - Search by partition key</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Partition Key Name"
            name="partitionKey"
            help="Required for query operations. The name of the partition key attribute."
          >
            <Input placeholder="id" />
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Partition Key Value
                <Button
                  type="text"
                  size="small"
                  icon={<FunctionOutlined />}
                  onClick={() => handleVariableHelperOpen('partitionKeyValue')}
                  title="Insert variable"
                />
              </div>
            }
            name="partitionKeyValue"
            help="Required for query operations. Use variables like {{cloudwatch.extractedData.userIds[0]}}"
          >
            <Input placeholder="user123 or {{cloudwatch.extractedData.userIds[0]}}" />
          </Form.Item>

          <Form.Item
            label="Sort Key Name (Optional)"
            name="sortKey"
            help="Optional. The name of the sort key attribute for more specific queries."
          >
            <Input placeholder="timestamp" />
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Sort Key Value (Optional)
                <Button
                  type="text"
                  size="small"
                  icon={<FunctionOutlined />}
                  onClick={() => handleVariableHelperOpen('sortKeyValue')}
                  title="Insert variable"
                />
              </div>
            }
            name="sortKeyValue"
            help="Optional. Use variables like {{cloudwatch.extractedData.timestamps[0]}}"
          >
            <Input placeholder="2024-01-01 or {{cloudwatch.extractedData.timestamps[0]}}" />
          </Form.Item>

          <Form.Item
            label="Index Name (Optional)"
            name="indexName"
            help="Optional. Global Secondary Index (GSI) or Local Secondary Index (LSI) name."
          >
            <Input placeholder="GSI1" />
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Filter Expression (Optional)
                <Button
                  type="text"
                  size="small"
                  icon={<FunctionOutlined />}
                  onClick={() => handleVariableHelperOpen('filterExpression')}
                  title="Insert variable"
                />
              </div>
            }
            name="filterExpression"
            help="Optional. Use variables in expressions like userId={{cloudwatch.extractedData.userIds[0]}}"
          >
            <Input placeholder="Status=ACTIVE or userId={{cloudwatch.extractedData.userIds[0]}}" />
          </Form.Item>

          <Form.Item
            label="Limit"
            name="limit"
            help="Maximum number of items to return (1-1000)."
          >
            <Input type="number" min={1} max={1000} placeholder="25" />
          </Form.Item>

          <Alert
            message="Query Examples"
            description={
              <div>
                <div><strong>Scan all items:</strong> Just specify table name and use 'scan' operation</div>
                <div><strong>Scan with filter:</strong> Use 'scan' operation with filter like "Status=ACTIVE"</div>
                <div><strong>Query by partition key:</strong> Set operation to 'query', specify partition key name and value</div>
                <div><strong>Query with sort key:</strong> Add sort key name and value for more specific results</div>
                <div><strong>Query GSI:</strong> Specify index name along with partition key</div>
                <div><strong>Filter examples:</strong> Status=ACTIVE, contains(name,John), attribute_exists(email), begins_with(id,user)</div>
              </div>
            }
            type="info"
            className="mt-2"
          />
        </Form>
      </Modal>

      {/* Persistent Error Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Configuration Error</span>
          </div>
        }
        open={isErrorModalVisible}
        onOk={handleErrorModalClose}
        onCancel={handleErrorModalClose}
        footer={[
          <Button key="ok" type="primary" onClick={handleErrorModalClose}>
            OK
          </Button>
        ]}
        width={500}
        maskClosable={false}
        closable={true}
      >
        <div style={{ whiteSpace: 'pre-line', marginTop: '16px' }}>
          {errorMessage}
        </div>
      </Modal>

      {/* Variable Helper Modal */}
      <VariableHelper
        visible={isVariableHelperVisible}
        onClose={() => setIsVariableHelperVisible(false)}
        onInsertVariable={handleVariableInsert}
      />
    </>
  )
})

DynamoDBNode.displayName = 'DynamoDBNode'

export default DynamoDBNode
