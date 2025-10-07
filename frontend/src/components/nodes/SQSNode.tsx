import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert, Select, InputNumber, Switch, AutoComplete, Spin } from 'antd'
import SQSIcon from '../icons/SQSIcon'

const { Option } = Select
const { TextArea } = Input

interface SQSNodeData {
  label: string
  config: {
    operation?: 'listQueues' | 'sendMessage' | 'receiveMessages' | 'pollMessages' | 'getQueueAttributes'
    queueUrl?: string
    queueName?: string
    messageBody?: string
    maxNumberOfMessages?: number
    visibilityTimeoutSeconds?: number
    waitTimeSeconds?: number
    pollDurationSeconds?: number
    delaySeconds?: number
    queueNamePrefix?: string
  }
}

interface SQSQueue {
  queueName: string
  queueUrl: string
  region: string
}

interface SQSNodeProps {
  data: SQSNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const SQSNode: React.FC<SQSNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form] = Form.useForm()
  const [availableQueues, setAvailableQueues] = useState<SQSQueue[]>([])
  const [loadingQueues, setLoadingQueues] = useState(false)
  const [queueSearchOptions, setQueueSearchOptions] = useState<{ value: string; label: string }[]>([])

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available SQS queues
  const loadSQSQueues = useCallback(async () => {
    setLoadingQueues(true)
    try {
      const response = await fetch('/api/aws/sqs/queues/list', {
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
        setAvailableQueues(result.queues || [])
        const options = result.queues?.map((queue: SQSQueue) => ({
          value: queue.queueName,
          label: `${queue.queueName} (${queue.region})`
        })) || []
        setQueueSearchOptions(options)
      } else {
        console.error('Failed to load SQS queues:', result.message)
      }
    } catch (error) {
      console.error('Error loading SQS queues:', error)
    } finally {
      setLoadingQueues(false)
    }
  }, [])

  const handleQueueSearch = useCallback((searchText: string) => {
    const filteredOptions = availableQueues
      .filter(queue => 
        queue.queueName.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(queue => ({
        value: queue.queueName,
        label: `${queue.queueName} (${queue.region})`
      }))
    
    setQueueSearchOptions(filteredOptions)
  }, [availableQueues])

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Load queues when modal opens
    loadSQSQueues()
    
    // Set form values from current config
    form.setFieldsValue({
      operation: data.config.operation || 'listQueues',
      queueUrl: data.config.queueUrl || '',
      queueName: data.config.queueName || '',
      messageBody: data.config.messageBody || '',
      maxNumberOfMessages: data.config.maxNumberOfMessages || 10,
      visibilityTimeoutSeconds: data.config.visibilityTimeoutSeconds || 30,
      waitTimeSeconds: data.config.waitTimeSeconds || 0,
      pollDurationSeconds: data.config.pollDurationSeconds || 30,
      delaySeconds: data.config.delaySeconds || 0,
      queueNamePrefix: data.config.queueNamePrefix || ''
    })
  }, [data.config, form, loadSQSQueues])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate based on operation
      if (values.operation === 'sendMessage' && !values.messageBody) {
        showErrorModal('Message body is required for send message operation')
        return
      }
      
      if ((values.operation === 'sendMessage' || values.operation === 'receiveMessages' || 
           values.operation === 'pollMessages') && !values.queueUrl && !values.queueName) {
        showErrorModal('Either Queue URL or Queue Name is required for this operation')
        return
      }
      
      // Update node data with new configuration
      const newConfig = {
        operation: values.operation,
        queueUrl: values.queueUrl,
        queueName: values.queueName,
        messageBody: values.messageBody,
        maxNumberOfMessages: values.maxNumberOfMessages,
        visibilityTimeoutSeconds: values.visibilityTimeoutSeconds,
        waitTimeSeconds: values.waitTimeSeconds,
        pollDurationSeconds: values.pollDurationSeconds,
        delaySeconds: values.delaySeconds,
        queueNamePrefix: values.queueNamePrefix
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('SQS configuration updated')
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
      message.warning('Please configure SQS operation first')
      return
    }

    const startTime = Date.now()

    // Pre-validate configuration before showing running status
    let validationError = ''
    
    switch (data.config.operation) {
      case 'sendMessage':
        if (!data.config.queueUrl && !data.config.queueName) {
          validationError = 'Queue URL or Queue Name is required for send message'
        }
        break
      case 'receiveMessages':
        if (!data.config.queueUrl && !data.config.queueName) {
          validationError = 'Queue URL or Queue Name is required for receive messages'
        }
        break
      case 'pollMessages':
        if (!data.config.queueUrl && !data.config.queueName) {
          validationError = 'Queue URL or Queue Name is required for poll messages'
        }
        break
      case 'getQueueAttributes':
        if (!data.config.queueUrl && !data.config.queueName) {
          validationError = 'Queue URL or Queue Name is required for get queue attributes'
        }
        break
    }

    // If validation fails, show error immediately without running status
    if (validationError) {
      message.error(validationError)
      if (onNodeExecute) {
        onNodeExecute({
          nodeId: id,
          status: 'error' as const,
          output: validationError,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      }
      return
    }

    // Show immediate progress indication in execution panel only after validation passes
    const progressResult = {
      nodeId: id,
      status: 'running' as const,
      output: `Executing SQS ${data.config.operation}...${data.config.operation === 'pollMessages' ? ' (This may take up to ' + (data.config.pollDurationSeconds || 30) + ' seconds)' : ''}`,
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
        case 'listQueues':
          endpoint = '/api/aws/sqs/queues/list'
          if (data.config.queueNamePrefix) {
            requestBody.queueNamePrefix = data.config.queueNamePrefix
          }
          break
          
        case 'sendMessage':
          endpoint = '/api/aws/sqs/message/send'
          requestBody.queueUrl = data.config.queueUrl
          requestBody.queueName = data.config.queueName
          requestBody.messageBody = data.config.messageBody
          if (data.config.delaySeconds) {
            requestBody.delaySeconds = data.config.delaySeconds
          }
          break
          
        case 'receiveMessages':
          endpoint = '/api/aws/sqs/messages/receive'
          requestBody.queueUrl = data.config.queueUrl
          requestBody.queueName = data.config.queueName
          requestBody.maxNumberOfMessages = data.config.maxNumberOfMessages || 10
          requestBody.visibilityTimeoutSeconds = data.config.visibilityTimeoutSeconds
          requestBody.waitTimeSeconds = data.config.waitTimeSeconds
          break
          
        case 'pollMessages':
          endpoint = '/api/aws/sqs/messages/poll'
          requestBody.queueUrl = data.config.queueUrl
          requestBody.queueName = data.config.queueName
          requestBody.maxNumberOfMessages = data.config.maxNumberOfMessages || 10
          requestBody.visibilityTimeoutSeconds = data.config.visibilityTimeoutSeconds
          requestBody.waitTimeSeconds = data.config.waitTimeSeconds
          requestBody.pollDurationSeconds = data.config.pollDurationSeconds || 30
          break
          
        case 'getQueueAttributes':
          endpoint = '/api/aws/sqs/queue/attributes'
          requestBody.queueUrl = data.config.queueUrl
          requestBody.queueName = data.config.queueName
          break
          
        default:
          message.error('Unknown SQS operation')
          if (onNodeExecute) {
            onNodeExecute({
              nodeId: id,
              status: 'error' as const,
              output: 'Unknown SQS operation',
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            })
          }
          return
      }
      
      // Call backend API to execute SQS operation
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
        let output = `SQS ${data.config.operation} Results:\n`
        
        if (data.config.operation === 'listQueues') {
          const queues = result.queues || []
          output += `Total Queues Found: ${queues.length}\n`
          output += `Region: ${result.region}\n\n`
          
          if (queues.length > 0) {
            output += `Queue Details:\n`
            output += `${'='.repeat(50)}\n`
            queues.forEach((queue: any) => {
              output += `Name: ${queue.queueName}\n`
              output += `URL: ${queue.queueUrl}\n`
              output += `Region: ${queue.region}\n`
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No queues found`
            if (data.config.queueNamePrefix) {
              output += ` with prefix "${data.config.queueNamePrefix}"`
            }
            output += `\n`
          }
        } else if (data.config.operation === 'sendMessage') {
          output += `Message sent successfully!\n`
          output += `Message ID: ${result.messageId}\n`
          output += `MD5 of Body: ${result.md5OfBody}\n`
          if (result.sequenceNumber) {
            output += `Sequence Number: ${result.sequenceNumber}\n`
          }
          output += `Queue URL: ${result.queueUrl}\n`
        } else if (data.config.operation === 'receiveMessages') {
          const messages = result.messages || []
          output += `Messages Received: ${messages.length}\n`
          output += `Queue URL: ${result.queueUrl}\n\n`
          
          if (messages.length > 0) {
            output += `Message Details:\n`
            output += `${'='.repeat(50)}\n`
            messages.forEach((msg: any, index: number) => {
              output += `Message ${index + 1}:\n`
              output += `  ID: ${msg.messageId}\n`
              output += `  Body: ${msg.body}\n`
              output += `  MD5: ${msg.md5OfBody}\n`
              output += `  Receipt Handle: ${msg.receiptHandle?.substring(0, 50)}...\n`
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No messages available in the queue\n`
          }
        } else if (data.config.operation === 'pollMessages') {
          const messages = result.messages || []
          output += `Polling completed!\n`
          output += `Total Messages Received: ${messages.length}\n`
          output += `Max Requested Messages: ${result.maxRequestedMessages || 'N/A'}\n`
          output += `Poll Iterations: ${result.pollIterations}\n`
          output += `Poll Duration: ${result.pollDurationSeconds} seconds\n`
          if (result.limitReached) {
            output += `Status: Message limit reached (${result.maxRequestedMessages} messages)\n`
          } else {
            output += `Status: Polling completed within time limit\n`
          }
          output += `Queue URL: ${result.queueUrl}\n\n`
          
          if (messages.length > 0) {
            messages.forEach((msg: any, index: number) => {
              output += `Message ${index + 1} (Poll ${msg.pollIteration}):\n`
              output += `  ID: ${msg.messageId}\n`
              output += `  Body: ${msg.body}\n`
              output += `  Received At: ${msg.receivedAt}\n`
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No messages received during polling period\n`
          }
        } else if (data.config.operation === 'getQueueAttributes') {
          const attributes = result.attributes || {}
          output += `Queue Attributes:\n`
          output += `Queue URL: ${result.queueUrl}\n\n`
          
          if (Object.keys(attributes).length > 0) {
            output += `Attributes:\n`
            output += `${'='.repeat(50)}\n`
            Object.entries(attributes).forEach(([key, value]) => {
              output += `${key}: ${value}\n`
            })
          } else {
            output += `No attributes found\n`
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

        message.success(`SQS ${data.config.operation} completed successfully`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `SQS ${data.config.operation} failed: ${result.message || 'Unknown error'}`,
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
        output: `SQS operation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute SQS operation')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const getOperationLabel = () => {
    switch (data.config.operation) {
      case 'listQueues': return 'List Queues'
      case 'sendMessage': return 'Send Message'
      case 'receiveMessages': return 'Receive Messages'
      case 'pollMessages': return 'Poll Messages'
      case 'getQueueAttributes': return 'Get Attributes'
      default: return 'Not configured'
    }
  }

  return (
    <>
      <div className={`aws-node node-sqs ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <SQSIcon className="aws-node-icon" size={20} />
          <span>SQS</span>
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
          
          {data.config.queueUrl && (
            <div className="text-xs mb-1">
              <strong>Queue:</strong> 
              <div className="break-words whitespace-normal mt-1">
                {data.config.queueUrl.split('/').pop()}
              </div>
            </div>
          )}
          
          {data.config.queueName && !data.config.queueUrl && (
            <div className="text-xs mb-1">
              <strong>Queue Name:</strong> {data.config.queueName}
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
        title="Configure SQS Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'listQueues',
            maxNumberOfMessages: 10,
            visibilityTimeoutSeconds: 30,
            waitTimeSeconds: 0,
            pollDurationSeconds: 30,
            delaySeconds: 0
          }}
        >
          <Alert
            message="SQS Operations"
            description="Configure SQS operations to interact with Amazon Simple Queue Service. You can list queues, send/receive messages, and poll for messages."
            type="info"
            showIcon
            className="mb-4"
          />

          {loadingQueues && (
            <div className="text-center mb-4">
              <Spin size="small" /> Loading available queues...
            </div>
          )}

          <Form.Item
            label="Operation"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation' }]}
          >
            <Select placeholder="Select SQS operation">
              <Option value="listQueues">List Queues</Option>
              <Option value="sendMessage">Send Message</Option>
              <Option value="receiveMessages">Receive Messages</Option>
              <Option value="pollMessages">Poll Messages</Option>
              <Option value="getQueueAttributes">Get Queue Attributes</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}
          >
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'listQueues') {
                return (
                  <Form.Item
                    label="Queue Name Prefix (Optional)"
                    name="queueNamePrefix"
                    help="Filter queues by name prefix"
                  >
                    <Input placeholder="e.g., prod-" />
                  </Form.Item>
                )
              }
              
              if (['sendMessage', 'receiveMessages', 'pollMessages', 'getQueueAttributes'].includes(operation)) {
                return (
                  <>
                    <Form.Item
                      label="Queue URL"
                      name="queueUrl"
                      help="Full SQS queue URL (preferred) or leave empty to use queue name"
                    >
                      <Input placeholder="https://sqs.region.amazonaws.com/account/queue-name" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Queue Name (Alternative)"
                      name="queueName"
                      help="Select from available queues or enter queue name manually"
                    >
                      <AutoComplete
                        placeholder="my-queue"
                        options={queueSearchOptions}
                        onSearch={handleQueueSearch}
                        notFoundContent={loadingQueues ? <Spin size="small" /> : 'No queues found'}
                        filterOption={false}
                      />
                    </Form.Item>
                  </>
                )
              }
              
              return null
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}
          >
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'sendMessage') {
                return (
                  <>
                    <Form.Item
                      label="Message Body"
                      name="messageBody"
                      rules={[{ required: true, message: 'Please enter message body' }]}
                    >
                      <TextArea 
                        rows={4} 
                        placeholder="Enter the message content to send to the queue"
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Delay Seconds (Optional)"
                      name="delaySeconds"
                      help="Delay message delivery (0-900 seconds)"
                    >
                      <InputNumber min={0} max={900} placeholder="0" />
                    </Form.Item>
                  </>
                )
              }
              
              if (['receiveMessages', 'pollMessages'].includes(operation)) {
                return (
                  <>
                    <Form.Item
                      label="Max Number of Messages"
                      name="maxNumberOfMessages"
                      help={operation === 'pollMessages' ? "Total maximum messages to receive across all polling iterations (1-10)" : "Maximum messages to receive (1-10)"}
                    >
                      <InputNumber min={1} max={10} placeholder="10" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Visibility Timeout (seconds)"
                      name="visibilityTimeoutSeconds"
                      help="Time messages are hidden from other consumers"
                    >
                      <InputNumber min={0} max={43200} placeholder="30" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Wait Time (seconds)"
                      name="waitTimeSeconds"
                      help="Long polling wait time (0-20 seconds)"
                    >
                      <InputNumber min={0} max={20} placeholder="0" />
                    </Form.Item>
                  </>
                )
              }
              
              if (operation === 'pollMessages') {
                return (
                  <Form.Item
                    label="Poll Duration (seconds)"
                    name="pollDurationSeconds"
                    help="How long to continuously poll for messages"
                  >
                    <InputNumber min={1} max={300} placeholder="30" />
                  </Form.Item>
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

SQSNode.displayName = 'SQSNode'

export default SQSNode
