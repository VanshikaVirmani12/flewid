import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined, SearchOutlined, CloudUploadOutlined, TagOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert, Select, Space, AutoComplete, Spin, Tabs, Divider, Switch } from 'antd'
import LambdaIcon from '../icons/LambdaIcon'

const { TextArea } = Input
const { Option } = Select

// Code Source Tab Component
const CodeSourceTab: React.FC = () => {
  const [codeForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState<string>('')

  const handleUpdateCode = useCallback(async () => {
    try {
      const values = await codeForm.validateFields()
      setLoading(true)

      const requestBody = {
        accountId: 'dev-account-1',
        functionName: values.functionName,
        s3Bucket: values.s3Bucket,
        s3Key: values.s3Key,
        s3ObjectVersion: values.s3ObjectVersion || undefined,
        dryRun: values.dryRun || false
      }

      const response = await fetch('/api/aws/lambda/update-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        if (result.dryRun) {
          message.success(`Dry run successful: ${result.message}`)
        } else {
          message.success(`Function code updated successfully! New version: ${result.version}`)
        }
      } else {
        message.error(`Failed to update code: ${result.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      message.error(`Error updating code: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [codeForm])

  return (
    <div>
      <Alert
        message="Update Lambda Function Code from S3"
        description="Upload new code for your Lambda function from an S3 location. This will update the function's code and optionally publish a new version."
        type="info"
        showIcon
        className="mb-4"
      />

      <Form
        form={codeForm}
        layout="vertical"
        initialValues={{
          dryRun: false
        }}
      >
        <Form.Item
          label="Function Name"
          name="functionName"
          rules={[{ required: true, message: 'Please enter the Lambda function name' }]}
          help="Name of the Lambda function to update"
        >
          <Input placeholder="my-lambda-function" />
        </Form.Item>

        <Form.Item
          label="S3 Bucket"
          name="s3Bucket"
          rules={[{ required: true, message: 'Please enter the S3 bucket name' }]}
          help="S3 bucket containing the deployment package"
        >
          <Input placeholder="my-deployment-bucket" />
        </Form.Item>

        <Form.Item
          label="S3 Key"
          name="s3Key"
          rules={[{ required: true, message: 'Please enter the S3 object key' }]}
          help="S3 object key (path) to the deployment package (.zip file)"
        >
          <Input placeholder="lambda-functions/my-function.zip" />
        </Form.Item>

        <Form.Item
          label="S3 Object Version (Optional)"
          name="s3ObjectVersion"
          help="Specific version of the S3 object to use (leave empty for latest)"
        >
          <Input placeholder="Version ID (optional)" />
        </Form.Item>

        <Form.Item name="dryRun" valuePropName="checked">
          <Switch /> Dry Run (validate only, don't update)
        </Form.Item>

        <div className="flex justify-end gap-2 mt-4">
          <Button 
            type="primary" 
            onClick={handleUpdateCode}
            loading={loading}
            icon={<CloudUploadOutlined />}
          >
            {loading ? 'Updating...' : 'Update Code'}
          </Button>
        </div>
      </Form>

      <Divider />

      <Alert
        message="S3 Code Upload Requirements"
        description={
          <div>
            <div><strong>Deployment Package:</strong> Must be a .zip file containing your function code</div>
            <div><strong>S3 Location:</strong> The S3 object must be in the same region as your Lambda function</div>
            <div><strong>Permissions:</strong> Lambda must have permission to access the S3 object</div>
            <div><strong>Size Limit:</strong> Unzipped deployment package must be ≤ 250 MB</div>
          </div>
        }
        type="warning"
        className="mt-4"
      />
    </div>
  )
}

// Versions Tab Component
const VersionsTab: React.FC = () => {
  const [versionsForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [versions, setVersions] = useState<any[]>([])

  const handleListVersions = useCallback(async () => {
    try {
      const values = await versionsForm.validateFields(['functionName'])
      setLoading(true)

      const requestBody = {
        accountId: 'dev-account-1',
        functionName: values.functionName,
        maxItems: 50
      }

      const response = await fetch('/api/aws/lambda/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setVersions(result.versions || [])
        message.success(`Found ${result.count} versions`)
      } else {
        message.error(`Failed to list versions: ${result.message || 'Unknown error'}`)
        setVersions([])
      }
    } catch (error: any) {
      message.error(`Error listing versions: ${error.message}`)
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [versionsForm])

  const handlePublishVersion = useCallback(async () => {
    try {
      const values = await versionsForm.validateFields(['functionName'])
      setPublishLoading(true)

      const requestBody = {
        accountId: 'dev-account-1',
        functionName: values.functionName,
        description: values.description || undefined
      }

      const response = await fetch('/api/aws/lambda/publish-version', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        message.success(`Version ${result.version} published successfully!`)
        // Refresh the versions list
        handleListVersions()
      } else {
        message.error(`Failed to publish version: ${result.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      message.error(`Error publishing version: ${error.message}`)
    } finally {
      setPublishLoading(false)
    }
  }, [versionsForm, handleListVersions])

  return (
    <div>
      <Alert
        message="Lambda Function Versions"
        description="Manage versions of your Lambda function. Versions are immutable snapshots of your function code and configuration."
        type="info"
        showIcon
        className="mb-4"
      />

      <Form
        form={versionsForm}
        layout="vertical"
      >
        <Form.Item
          label="Function Name"
          name="functionName"
          rules={[{ required: true, message: 'Please enter the Lambda function name' }]}
          help="Name of the Lambda function to manage versions for"
        >
          <Input placeholder="my-lambda-function" />
        </Form.Item>

        <div className="flex gap-2 mb-4">
          <Button 
            onClick={handleListVersions}
            loading={loading}
            icon={<SearchOutlined />}
          >
            List Versions
          </Button>
        </div>

        <Divider orientation="left">Publish New Version</Divider>

        <Form.Item
          label="Version Description (Optional)"
          name="description"
          help="Description for the new version"
        >
          <TextArea 
            placeholder="Version description (optional)"
            rows={2}
          />
        </Form.Item>

        <div className="flex justify-end gap-2 mb-4">
          <Button 
            type="primary"
            onClick={handlePublishVersion}
            loading={publishLoading}
            icon={<TagOutlined />}
          >
            {publishLoading ? 'Publishing...' : 'Publish Version'}
          </Button>
        </div>

        {versions.length > 0 && (
          <>
            <Divider orientation="left">Existing Versions ({versions.length})</Divider>
            <div className="max-h-64 overflow-y-auto">
              {versions.map((version, index) => (
                <div key={index} className="border rounded p-3 mb-2 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        Version: {version.version}
                        {version.version === '$LATEST' && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            LATEST
                          </span>
                        )}
                      </div>
                      {version.description && (
                        <div className="text-sm text-gray-600 mt-1">
                          {version.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Last Modified: {version.lastModified}
                      </div>
                      <div className="text-xs text-gray-500">
                        Code Size: {version.codeSize ? `${(version.codeSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div>Runtime: {version.runtime}</div>
                      <div>Memory: {version.memorySize} MB</div>
                      <div>Timeout: {version.timeout}s</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Form>

      <Alert
        message="Version Management"
        description={
          <div>
            <div><strong>$LATEST:</strong> Always points to the most recent version of your function</div>
            <div><strong>Numbered Versions:</strong> Immutable snapshots that can be referenced by version number</div>
            <div><strong>Aliases:</strong> Pointers to specific versions (not shown here, managed separately)</div>
          </div>
        }
        type="info"
        className="mt-4"
      />
    </div>
  )
}

interface LambdaNodeData {
  label: string
  config: {
    functionName?: string
    payload?: string
    invocationType?: 'RequestResponse' | 'Event' | 'DryRun'
    logType?: 'None' | 'Tail'
  }
}

interface LambdaNodeProps {
  data: LambdaNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

interface LambdaFunction {
  functionName: string
  functionArn: string
  runtime: string
  description?: string
  timeout: number
  memorySize: number
  lastModified: string
}

const LambdaNode: React.FC<LambdaNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form] = Form.useForm()
  const [availableFunctions, setAvailableFunctions] = useState<LambdaFunction[]>([])
  const [loadingFunctions, setLoadingFunctions] = useState(false)
  const [functionSearchOptions, setFunctionSearchOptions] = useState<{ value: string; label: string }[]>([])

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available Lambda functions
  const loadLambdaFunctions = useCallback(async () => {
    setLoadingFunctions(true)
    try {
      const response = await fetch('/api/aws/lambda/functions?accountId=dev-account-1')
      const result = await response.json()
      
      if (response.ok && result.success) {
        setAvailableFunctions(result.functions || [])
        const options = result.functions?.map((func: LambdaFunction) => ({
          value: func.functionName,
          label: `${func.functionName} (${func.runtime})`
        })) || []
        setFunctionSearchOptions(options)
      } else {
        console.error('Failed to load Lambda functions:', result.message)
      }
    } catch (error) {
      console.error('Error loading Lambda functions:', error)
    } finally {
      setLoadingFunctions(false)
    }
  }, [])

  const validatePayload = (payload: string): { isValid: boolean; error?: string } => {
    if (!payload || payload.trim() === '') {
      return { isValid: true } // Empty payload is valid
    }

    try {
      JSON.parse(payload.trim())
      return { isValid: true }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid JSON payload format.\n\nPlease ensure your payload is valid JSON.\n\nExample:\n{\n  "key1": "value1",\n  "key2": 123,\n  "key3": true\n}\n\nCurrent payload:\n${payload.trim()}` 
      }
    }
  }

  const validateFunctionName = (functionName: string): { isValid: boolean; error?: string } => {
    if (!functionName || functionName.trim() === '') {
      return { isValid: false, error: 'Function name is required.' }
    }

    const trimmedName = functionName.trim()

    // Basic Lambda function name validation
    if (trimmedName.length < 1 || trimmedName.length > 64) {
      return { 
        isValid: false, 
        error: `Function name must be between 1 and 64 characters long.\n\nCurrent name: "${trimmedName}" (${trimmedName.length} characters)` 
      }
    }

    // Check for valid characters (letters, numbers, hyphens, underscores)
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmedName)) {
      return { 
        isValid: false, 
        error: `Function name contains invalid characters.\n\nFunction names can only contain:\n• Letters (a-z, A-Z)\n• Numbers (0-9)\n• Hyphens (-)\n• Underscores (_)\n\nCurrent name: "${trimmedName}"` 
      }
    }

    return { isValid: true }
  }

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Load functions when modal opens
    loadLambdaFunctions()
    
    // Set form values from current config
    form.setFieldsValue({
      functionName: data.config.functionName || '',
      payload: data.config.payload || '',
      invocationType: data.config.invocationType || 'RequestResponse',
      logType: data.config.logType || 'None'
    })
  }, [data.config, form, loadLambdaFunctions])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate function name
      const functionNameValidation = validateFunctionName(values.functionName)
      if (!functionNameValidation.isValid) {
        showErrorModal(`Function Name Validation Error:\n\n${functionNameValidation.error}`)
        return
      }
      
      // Validate payload if provided
      if (values.payload) {
        const payloadValidation = validatePayload(values.payload)
        if (!payloadValidation.isValid) {
          showErrorModal(`Payload Validation Error:\n\n${payloadValidation.error}`)
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        functionName: values.functionName.trim(),
        payload: values.payload?.trim() || '',
        invocationType: values.invocationType || 'RequestResponse',
        logType: values.logType || 'None'
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('Lambda configuration updated')
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
    
    if (!data.config.functionName) {
      message.warning('Please configure Lambda function name first')
      return
    }

    const startTime = Date.now()

    try {
      const requestBody = {
        accountId: 'dev-account-1', // This should come from selected account
        functionName: data.config.functionName,
        payload: data.config.payload || undefined,
        invocationType: data.config.invocationType || 'RequestResponse',
        logType: data.config.logType || 'None'
      }
      
      // Call backend API to invoke Lambda function
      const response = await fetch('/api/aws/lambda/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `Lambda Function Invocation Results:\n`
        output += `Function: ${data.config.functionName}\n`
        output += `Invocation Type: ${result.invocationType}\n`
        output += `Status Code: ${result.statusCode}\n`
        output += `Duration: ${result.duration}ms\n`
        
        if (result.functionError) {
          output += `Function Error: ${result.functionError}\n`
        }
        
        if (result.executedVersion) {
          output += `Executed Version: ${result.executedVersion}\n`
        }
        
        output += `\n${'='.repeat(50)}\n`
        
        if (result.payload !== null && result.payload !== undefined) {
          output += `Response Payload:\n`
          if (typeof result.payload === 'object') {
            output += JSON.stringify(result.payload, null, 2)
          } else {
            output += result.payload
          }
          output += `\n`
        }
        
        if (result.logResult && data.config.logType === 'Tail') {
          output += `\nExecution Logs:\n`
          output += `${'-'.repeat(30)}\n`
          output += result.logResult
        }

        const executionResult = {
          nodeId: id,
          status: result.functionError ? 'error' as const : 'success' as const,
          output,
          duration,
          timestamp: new Date().toISOString(),
        }

        // Add result to execution panel
        if (onNodeExecute) {
          onNodeExecute(executionResult)
        }

        if (result.functionError) {
          message.error(`Lambda function returned an error: ${result.functionError}`)
        } else {
          message.success(`Lambda function invoked successfully`)
        }
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `Lambda invocation failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }

        // Add result to execution panel
        if (onNodeExecute) {
          onNodeExecute(executionResult)
        }

        message.error(`Invocation failed: ${result.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      const executionResult = {
        nodeId: id,
        status: 'error' as const,
        output: `Lambda invocation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to invoke Lambda function')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const handleFunctionSearch = useCallback((searchText: string) => {
    const filteredOptions = availableFunctions
      .filter(func => 
        func.functionName.toLowerCase().includes(searchText.toLowerCase()) ||
        (func.description && func.description.toLowerCase().includes(searchText.toLowerCase()))
      )
      .map(func => ({
        value: func.functionName,
        label: `${func.functionName} (${func.runtime})`
      }))
    
    setFunctionSearchOptions(filteredOptions)
  }, [availableFunctions])

  return (
    <>
      <div className={`aws-node node-lambda ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <LambdaIcon className="aws-node-icon" size={20} />
          <span>Lambda</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          {data.config.functionName ? (
            <div className="text-xs mb-1">
              <strong>Function:</strong> 
              <div className="break-words whitespace-normal mt-1">
                {data.config.functionName}
              </div>
              {data.config.invocationType && data.config.invocationType !== 'RequestResponse' && (
                <div className="mt-1">
                  <strong>Type:</strong> {data.config.invocationType}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No function configured</div>
          )}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={!data.config.functionName}
            className="w-full"
          >
            Invoke
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure Lambda Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={800}
        footer={null}
      >
        <Tabs
          defaultActiveKey="invoke"
          items={[
            {
              key: 'invoke',
              label: 'Function Invocation',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    functionName: '',
                    payload: '',
                    invocationType: 'RequestResponse',
                    logType: 'None'
                  }}
                >
                  <Alert
                    message="Lambda Function Invocation"
                    description="Configure the Lambda function to invoke. You can specify the function name, payload, and invocation settings."
                    type="info"
                    showIcon
                    className="mb-4"
                  />

                  <Form.Item
                    label="Function Name"
                    name="functionName"
                    rules={[{ required: true, message: 'Please enter a Lambda function name' }]}
                    help="Enter the name of the Lambda function to invoke"
                  >
                    <AutoComplete
                      placeholder="my-lambda-function"
                      options={functionSearchOptions}
                      onSearch={handleFunctionSearch}
                      notFoundContent={loadingFunctions ? <Spin size="small" /> : 'No functions found'}
                      filterOption={false}
                    />
                  </Form.Item>

                  <Space direction="horizontal" style={{ width: '100%' }}>
                    <Form.Item
                      label="Invocation Type"
                      name="invocationType"
                      style={{ flex: 1 }}
                      help="How to invoke the function"
                    >
                      <Select>
                        <Option value="RequestResponse">Synchronous (RequestResponse)</Option>
                        <Option value="Event">Asynchronous (Event)</Option>
                        <Option value="DryRun">Validate parameters (DryRun)</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="Log Type"
                      name="logType"
                      style={{ flex: 1 }}
                      help="Include execution logs in response"
                    >
                      <Select>
                        <Option value="None">No Logs</Option>
                        <Option value="Tail">Include Logs</Option>
                      </Select>
                    </Form.Item>
                  </Space>

                  <Form.Item
                    label="Payload (JSON)"
                    name="payload"
                    help="Optional JSON payload to send to the function. Leave empty for no payload."
                  >
                    <TextArea 
                      placeholder={`{
  "key1": "value1",
  "key2": 123,
  "key3": true
}`}
                      rows={6}
                    />
                  </Form.Item>

                  <Alert
                    message="Invocation Types"
                    description={
                      <div>
                        <div><strong>RequestResponse:</strong> Synchronous invocation with immediate response</div>
                        <div><strong>Event:</strong> Asynchronous invocation (fire-and-forget)</div>
                        <div><strong>DryRun:</strong> Validate parameters without executing the function</div>
                      </div>
                    }
                    type="info"
                    className="mt-2"
                  />

                  {loadingFunctions && (
                    <div className="text-center mt-2">
                      <Spin size="small" /> Loading available functions...
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-6">
                    <Button onClick={() => setIsConfigModalVisible(false)}>
                      Cancel
                    </Button>
                    <Button type="primary" onClick={handleConfigSave}>
                      Save Configuration
                    </Button>
                  </div>
                </Form>
              )
            },
            {
              key: 'code-source',
              label: (
                <span>
                  <CloudUploadOutlined />
                  Code Source
                </span>
              ),
              children: <CodeSourceTab />
            },
            {
              key: 'versions',
              label: (
                <span>
                  <TagOutlined />
                  Versions
                </span>
              ),
              children: <VersionsTab />
            }
          ]}
        />
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

LambdaNode.displayName = 'LambdaNode'

export default LambdaNode
