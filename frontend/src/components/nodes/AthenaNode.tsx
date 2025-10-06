import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert, Select, InputNumber, Switch, AutoComplete, Spin } from 'antd'
import AthenaIcon from '../icons/AthenaIcon'

const { Option } = Select
const { TextArea } = Input

interface AthenaNodeData {
  label: string
  config: {
    operation?: 'executeQuery' | 'getQueryExecution' | 'listQueryExecutions' | 'listDatabases' | 'listTables' | 'getQueryResults'
    queryString?: string
    database?: string
    outputLocation?: string
    workGroup?: string
    queryExecutionId?: string
    catalogName?: string
    databaseName?: string
    maxResults?: number
    nextToken?: string
  }
}

interface AthenaDatabase {
  name: string
  description?: string
}

interface AthenaTable {
  name: string
  tableType?: string
}

interface AthenaNodeProps {
  data: AthenaNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const AthenaNode: React.FC<AthenaNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form] = Form.useForm()
  const [availableDatabases, setAvailableDatabases] = useState<AthenaDatabase[]>([])
  const [availableTables, setAvailableTables] = useState<AthenaTable[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [databaseSearchOptions, setDatabaseSearchOptions] = useState<{ value: string; label: string }[]>([])
  const [tableSearchOptions, setTableSearchOptions] = useState<{ value: string; label: string }[]>([])

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available Athena databases
  const loadAthenaDatabases = useCallback(async () => {
    setLoadingDatabases(true)
    try {
      const response = await fetch('/api/aws/athena/databases/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'dev-account-1'
        })
      })
      const result = await response.json()
      
      if (response.ok && result.success) {
        setAvailableDatabases(result.databases || [])
        const options = result.databases?.map((db: AthenaDatabase) => ({
          value: db.name,
          label: `${db.name}${db.description ? ` - ${db.description}` : ''}`
        })) || []
        setDatabaseSearchOptions(options)
      } else {
        console.error('Failed to load Athena databases:', result.message)
      }
    } catch (error) {
      console.error('Error loading Athena databases:', error)
    } finally {
      setLoadingDatabases(false)
    }
  }, [])

  // Load available tables for a database
  const loadAthenaTables = useCallback(async (databaseName: string) => {
    if (!databaseName) return
    
    setLoadingTables(true)
    try {
      const response = await fetch('/api/aws/athena/tables/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'dev-account-1',
          databaseName: databaseName
        })
      })
      const result = await response.json()
      
      if (response.ok && result.success) {
        setAvailableTables(result.tables || [])
        const options = result.tables?.map((table: AthenaTable) => ({
          value: table.name,
          label: `${table.name}${table.tableType ? ` (${table.tableType})` : ''}`
        })) || []
        setTableSearchOptions(options)
      } else {
        console.error('Failed to load Athena tables:', result.message)
      }
    } catch (error) {
      console.error('Error loading Athena tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }, [])

  const handleDatabaseSearch = useCallback((searchText: string) => {
    const filteredOptions = availableDatabases
      .filter(db => 
        db.name.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(db => ({
        value: db.name,
        label: `${db.name}${db.description ? ` - ${db.description}` : ''}`
      }))
    
    setDatabaseSearchOptions(filteredOptions)
  }, [availableDatabases])

  const handleTableSearch = useCallback((searchText: string) => {
    const filteredOptions = availableTables
      .filter(table => 
        table.name.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(table => ({
        value: table.name,
        label: `${table.name}${table.tableType ? ` (${table.tableType})` : ''}`
      }))
    
    setTableSearchOptions(filteredOptions)
  }, [availableTables])

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Load databases when modal opens
    loadAthenaDatabases()
    
    // Set form values from current config
    form.setFieldsValue({
      operation: data.config.operation || 'executeQuery',
      queryString: data.config.queryString || '',
      database: data.config.database || '',
      outputLocation: data.config.outputLocation || '',
      workGroup: data.config.workGroup || '',
      queryExecutionId: data.config.queryExecutionId || '',
      catalogName: data.config.catalogName || '',
      databaseName: data.config.databaseName || '',
      maxResults: data.config.maxResults || 50,
      nextToken: data.config.nextToken || ''
    })
  }, [data.config, form, loadAthenaDatabases])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate based on operation
      if (values.operation === 'executeQuery') {
        if (!values.queryString) {
          showErrorModal('Query string is required for execute query operation')
          return
        }
        if (!values.database) {
          showErrorModal('Database is required for execute query operation')
          return
        }
        if (!values.outputLocation) {
          showErrorModal('Output location (S3 path) is required for execute query operation')
          return
        }
      }
      
      if (values.operation === 'getQueryExecution' && !values.queryExecutionId) {
        showErrorModal('Query execution ID is required for get query execution operation')
        return
      }
      
      if (values.operation === 'listTables' && !values.databaseName) {
        showErrorModal('Database name is required for list tables operation')
        return
      }
      
      // Update node data with new configuration
      const newConfig = {
        operation: values.operation,
        queryString: values.queryString,
        database: values.database,
        outputLocation: values.outputLocation,
        workGroup: values.workGroup,
        queryExecutionId: values.queryExecutionId,
        catalogName: values.catalogName,
        databaseName: values.databaseName,
        maxResults: values.maxResults,
        nextToken: values.nextToken
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('Athena configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    if (!data.config.operation) {
      message.warning('Please configure Athena operation first')
      return
    }

    const startTime = Date.now()

    // Show immediate progress indication in execution panel
    const progressResult = {
      nodeId: id,
      status: 'running' as const,
      output: `Executing Athena ${data.config.operation}...${data.config.operation === 'executeQuery' ? ' (This may take several minutes)' : ''}`,
      duration: 0,
      timestamp: new Date().toISOString(),
    }

    if (onNodeExecute) {
      onNodeExecute(progressResult)
    }

    try {
      let requestBody: any = {
        accountId: 'dev-account-1', // This should come from selected account
        operation: data.config.operation
      }

      let endpoint = ''
      
      // Build request based on operation
      switch (data.config.operation) {
        case 'executeQuery':
          endpoint = '/api/aws/athena/query/execute'
          if (!data.config.queryString || !data.config.database || !data.config.outputLocation) {
            message.error('Query string, database, and output location are required for execute query')
            return
          }
          requestBody.queryString = data.config.queryString
          requestBody.database = data.config.database
          requestBody.outputLocation = data.config.outputLocation
          if (data.config.workGroup) {
            requestBody.workGroup = data.config.workGroup
          }
          break
          
        case 'getQueryExecution':
          endpoint = '/api/aws/athena/query/execution'
          if (!data.config.queryExecutionId) {
            message.error('Query execution ID is required for get query execution')
            return
          }
          requestBody.queryExecutionId = data.config.queryExecutionId
          break
          
        case 'listQueryExecutions':
          endpoint = '/api/aws/athena/query/executions/list'
          if (data.config.workGroup) {
            requestBody.workGroup = data.config.workGroup
          }
          if (data.config.maxResults) {
            requestBody.maxResults = data.config.maxResults
          }
          break
          
        case 'listDatabases':
          endpoint = '/api/aws/athena/databases/list'
          if (data.config.catalogName) {
            requestBody.catalogName = data.config.catalogName
          }
          if (data.config.maxResults) {
            requestBody.maxResults = data.config.maxResults
          }
          break
          
        case 'listTables':
          endpoint = '/api/aws/athena/tables/list'
          if (!data.config.databaseName) {
            message.error('Database name is required for list tables')
            return
          }
          requestBody.databaseName = data.config.databaseName
          if (data.config.catalogName) {
            requestBody.catalogName = data.config.catalogName
          }
          if (data.config.maxResults) {
            requestBody.maxResults = data.config.maxResults
          }
          break
          
        case 'getQueryResults':
          endpoint = '/api/aws/athena/query/results'
          if (!data.config.queryExecutionId) {
            message.error('Query execution ID is required for get query results')
            return
          }
          requestBody.queryExecutionId = data.config.queryExecutionId
          if (data.config.maxResults) {
            requestBody.maxResults = data.config.maxResults
          }
          break
          
        default:
          message.error('Unknown Athena operation')
          return
      }
      
      // Call backend API to execute Athena operation
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `Athena ${data.config.operation} Results:\n`
        
        if (data.config.operation === 'executeQuery') {
          output += `Query Execution ID: ${result.queryExecutionId}\n`
          output += `Status: ${result.status}\n`
          output += `Database: ${result.database}\n`
          output += `Execution Time: ${result.executionTimeMs}ms\n`
          output += `Data Scanned: ${(result.dataScannedBytes / 1024 / 1024).toFixed(2)} MB\n`
          output += `Output Location: ${result.outputLocation}\n`
          output += `Results Count: ${result.resultCount}\n\n`
          
          if (result.results && result.results.length > 0) {
            output += `Query Results (first 10 rows):\n`
            output += `${'='.repeat(50)}\n`
            
            // Show column headers
            if (result.columnInfo && result.columnInfo.length > 0) {
              const headers = result.columnInfo.map((col: any) => col.name).join(' | ')
              output += `${headers}\n`
              output += `${'-'.repeat(headers.length)}\n`
            }
            
            // Show data rows (limit to first 10)
            result.results.slice(0, 10).forEach((row: any) => {
              const values = Object.values(row.data).join(' | ')
              output += `${values}\n`
            })
            
            if (result.results.length > 10) {
              output += `... and ${result.results.length - 10} more rows\n`
            }
          }
        } else if (data.config.operation === 'getQueryExecution') {
          const exec = result.queryExecution
          output += `Query Execution Details:\n`
          output += `${'='.repeat(50)}\n`
          output += `Execution ID: ${exec.queryExecutionId}\n`
          output += `Status: ${exec.status}\n`
          output += `Database: ${exec.database}\n`
          output += `Work Group: ${exec.workGroup}\n`
          output += `Execution Time: ${exec.executionTimeMs}ms\n`
          output += `Data Scanned: ${(exec.dataScannedBytes / 1024 / 1024).toFixed(2)} MB\n`
          output += `Output Location: ${exec.outputLocation}\n`
          if (exec.stateChangeReason) {
            output += `State Change Reason: ${exec.stateChangeReason}\n`
          }
          output += `\nQuery:\n${exec.query}\n`
        } else if (data.config.operation === 'listQueryExecutions') {
          output += `Query Executions Found: ${result.totalCount}\n\n`
          if (result.queryExecutionIds && result.queryExecutionIds.length > 0) {
            output += `Execution IDs:\n`
            output += `${'='.repeat(50)}\n`
            result.queryExecutionIds.forEach((id: string) => {
              output += `${id}\n`
            })
          }
        } else if (data.config.operation === 'listDatabases') {
          output += `Databases Found: ${result.totalCount}\n`
          output += `Catalog: ${result.catalogName}\n\n`
          if (result.databases && result.databases.length > 0) {
            output += `Database Details:\n`
            output += `${'='.repeat(50)}\n`
            result.databases.forEach((db: any) => {
              output += `Name: ${db.name}\n`
              if (db.description) {
                output += `Description: ${db.description}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
          }
        } else if (data.config.operation === 'listTables') {
          output += `Tables Found: ${result.totalCount}\n`
          output += `Database: ${result.databaseName}\n`
          output += `Catalog: ${result.catalogName}\n\n`
          if (result.tables && result.tables.length > 0) {
            output += `Table Details:\n`
            output += `${'='.repeat(50)}\n`
            result.tables.forEach((table: any) => {
              output += `Name: ${table.name}\n`
              output += `Type: ${table.tableType}\n`
              output += `Columns: ${table.columns.length}\n`
              if (table.partitionKeys && table.partitionKeys.length > 0) {
                output += `Partition Keys: ${table.partitionKeys.length}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
          }
        } else if (data.config.operation === 'getQueryResults') {
          output += `Query Results Retrieved: ${result.resultCount}\n`
          output += `Query Execution ID: ${result.queryExecutionId}\n\n`
          
          if (result.results && result.results.length > 0) {
            output += `Results (first 10 rows):\n`
            output += `${'='.repeat(50)}\n`
            
            // Show column headers
            if (result.columnInfo && result.columnInfo.length > 0) {
              const headers = result.columnInfo.map((col: any) => col.name).join(' | ')
              output += `${headers}\n`
              output += `${'-'.repeat(headers.length)}\n`
            }
            
            // Show data rows (limit to first 10)
            result.results.slice(0, 10).forEach((row: any) => {
              const values = Object.values(row.data).join(' | ')
              output += `${values}\n`
            })
            
            if (result.results.length > 10) {
              output += `... and ${result.results.length - 10} more rows\n`
            }
          }
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

        message.success(`Athena ${data.config.operation} completed successfully`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `Athena ${data.config.operation} failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }

        // Add result to execution panel
        if (onNodeExecute) {
          onNodeExecute(executionResult)
        }

        message.error(`Operation failed: ${result.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      const executionResult = {
        nodeId: id,
        status: 'error' as const,
        output: `Athena operation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute Athena operation')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const getOperationLabel = () => {
    switch (data.config.operation) {
      case 'executeQuery': return 'Execute Query'
      case 'getQueryExecution': return 'Get Query Execution'
      case 'listQueryExecutions': return 'List Query Executions'
      case 'listDatabases': return 'List Databases'
      case 'listTables': return 'List Tables'
      case 'getQueryResults': return 'Get Query Results'
      default: return 'Not configured'
    }
  }

  return (
    <>
      <div className={`aws-node node-athena ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <AthenaIcon className="aws-node-icon" size={20} />
          <span>Athena</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          <div className="text-xs mb-1">
            <strong>Operation:</strong> {getOperationLabel()}
          </div>
          
          {data.config.database && (
            <div className="text-xs mb-1">
              <strong>Database:</strong> {data.config.database}
            </div>
          )}
          
          {data.config.queryExecutionId && (
            <div className="text-xs mb-1">
              <strong>Query ID:</strong> 
              <div className="break-words whitespace-normal mt-1">
                {data.config.queryExecutionId.substring(0, 20)}...
              </div>
            </div>
          )}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={!data.config.operation}
            className="w-full"
          >
            Execute
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure Athena Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'executeQuery',
            maxResults: 50,
            catalogName: 'AwsDataCatalog'
          }}
        >
          <Alert
            message="AWS Athena Operations"
            description="Configure Athena operations to query data in S3 using SQL. Athena is serverless and you pay only for the queries you run."
            type="info"
            showIcon
            className="mb-4"
          />

          {loadingDatabases && (
            <div className="text-center mb-4">
              <Spin size="small" /> Loading available databases...
            </div>
          )}

          <Form.Item
            label="Operation"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation' }]}
          >
            <Select placeholder="Select Athena operation">
              <Option value="executeQuery">Execute Query</Option>
              <Option value="getQueryExecution">Get Query Execution</Option>
              <Option value="listQueryExecutions">List Query Executions</Option>
              <Option value="listDatabases">List Databases</Option>
              <Option value="listTables">List Tables</Option>
              <Option value="getQueryResults">Get Query Results</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}
          >
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'executeQuery') {
                return (
                  <>
                    <Form.Item
                      label="SQL Query"
                      name="queryString"
                      rules={[{ required: true, message: 'Please enter SQL query' }]}
                    >
                      <TextArea 
                        rows={6} 
                        placeholder="SELECT * FROM my_table WHERE date >= '2023-01-01' LIMIT 100"
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Database"
                      name="database"
                      rules={[{ required: true, message: 'Please select database' }]}
                    >
                      <AutoComplete
                        placeholder="default"
                        options={databaseSearchOptions}
                        onSearch={handleDatabaseSearch}
                        notFoundContent={loadingDatabases ? <Spin size="small" /> : 'No databases found'}
                        filterOption={false}
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Output Location (S3 Path)"
                      name="outputLocation"
                      rules={[{ required: true, message: 'Please enter S3 output location' }]}
                    >
                      <Input placeholder="s3://my-bucket/athena-results/" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Work Group (Optional)"
                      name="workGroup"
                    >
                      <Input placeholder="primary" />
                    </Form.Item>
                  </>
                )
              }
              
              if (['getQueryExecution', 'getQueryResults'].includes(operation)) {
                return (
                  <Form.Item
                    label="Query Execution ID"
                    name="queryExecutionId"
                    rules={[{ required: true, message: 'Please enter query execution ID' }]}
                  >
                    <Input placeholder="12345678-1234-1234-1234-123456789012" />
                  </Form.Item>
                )
              }
              
              if (operation === 'listQueryExecutions') {
                return (
                  <>
                    <Form.Item
                      label="Work Group (Optional)"
                      name="workGroup"
                    >
                      <Input placeholder="primary" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Max Results"
                      name="maxResults"
                    >
                      <InputNumber min={1} max={50} placeholder="50" />
                    </Form.Item>
                  </>
                )
              }
              
              if (operation === 'listDatabases') {
                return (
                  <>
                    <Form.Item
                      label="Catalog Name"
                      name="catalogName"
                    >
                      <Input placeholder="AwsDataCatalog" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Max Results"
                      name="maxResults"
                    >
                      <InputNumber min={1} max={50} placeholder="50" />
                    </Form.Item>
                  </>
                )
              }
              
              if (operation === 'listTables') {
                return (
                  <>
                    <Form.Item
                      label="Database Name"
                      name="databaseName"
                      rules={[{ required: true, message: 'Please select database' }]}
                    >
                      <AutoComplete
                        placeholder="default"
                        options={databaseSearchOptions}
                        onSearch={handleDatabaseSearch}
                        onChange={(value) => {
                          if (value) {
                            loadAthenaTables(value)
                          }
                        }}
                        notFoundContent={loadingDatabases ? <Spin size="small" /> : 'No databases found'}
                        filterOption={false}
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Catalog Name"
                      name="catalogName"
                    >
                      <Input placeholder="AwsDataCatalog" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Max Results"
                      name="maxResults"
                    >
                      <InputNumber min={1} max={50} placeholder="50" />
                    </Form.Item>
                  </>
                )
              }
              
              return null
            }}
          </Form.Item>
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
    </>
  )
})

AthenaNode.displayName = 'AthenaNode'

export default AthenaNode
