import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert, Select, Switch, AutoComplete, Spin } from 'antd'
import SNSIcon from '../icons/SNSIcon'

const { Option } = Select
const { TextArea } = Input

interface SNSNodeData {
  label: string
  config: {
    operation?: 'publishMessage' | 'publishBatch' | 'listTopics' | 'createTopic' | 'deleteTopic' | 'subscribe' | 'listSubscriptionsByTopic' | 'getTopicAttributes'
    topicArn?: string
    phoneNumber?: string
    targetArn?: string
    message?: string
    subject?: string
    messageAttributes?: string
    messageStructure?: string
    messageDeduplicationId?: string
    messageGroupId?: string
    topicName?: string
    protocol?: 'email' | 'email-json' | 'sms' | 'sqs' | 'application' | 'lambda' | 'firehose' | 'http' | 'https'
    endpoint?: string
    attributes?: string
    tags?: string
    batchMessages?: string
  }
}

interface SNSTopic {
  topicArn: string
  name: string
}

interface SNSNodeProps {
  data: SNSNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const SNSNode: React.FC<SNSNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form] = Form.useForm()
  const [availableTopics, setAvailableTopics] = useState<SNSTopic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [topicSearchOptions, setTopicSearchOptions] = useState<{ value: string; label: string }[]>([])

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available SNS topics
  const loadSNSTopics = useCallback(async () => {
    setLoadingTopics(true)
    try {
      const response = await fetch('/api/aws/sns/topics/list', {
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
        setAvailableTopics(result.topics || [])
        const options = result.topics?.map((topic: SNSTopic) => ({
          value: topic.topicArn,
          label: `${topic.name} (${topic.topicArn})`
        })) || []
        setTopicSearchOptions(options)
      } else {
        console.error('Failed to load SNS topics:', result.message)
      }
    } catch (error) {
      console.error('Error loading SNS topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }, [])

  const handleTopicSearch = useCallback((searchText: string) => {
    const filteredOptions = availableTopics
      .filter(topic => 
        topic.name.toLowerCase().includes(searchText.toLowerCase()) ||
        topic.topicArn.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(topic => ({
        value: topic.topicArn,
        label: `${topic.name} (${topic.topicArn})`
      }))
    
    setTopicSearchOptions(filteredOptions)
  }, [availableTopics])

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Load topics when modal opens
    loadSNSTopics()
    
    // Set form values from current config
    form.setFieldsValue({
      operation: data.config.operation || 'publishMessage',
      topicArn: data.config.topicArn || '',
      phoneNumber: data.config.phoneNumber || '',
      targetArn: data.config.targetArn || '',
      message: data.config.message || '',
      subject: data.config.subject || '',
      messageAttributes: data.config.messageAttributes || '',
      messageStructure: data.config.messageStructure || '',
      messageDeduplicationId: data.config.messageDeduplicationId || '',
      messageGroupId: data.config.messageGroupId || '',
      topicName: data.config.topicName || '',
      protocol: data.config.protocol || 'email',
      endpoint: data.config.endpoint || '',
      attributes: data.config.attributes || '',
      tags: data.config.tags || '',
      batchMessages: data.config.batchMessages || ''
    })
  }, [data.config, form, loadSNSTopics])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate based on operation
      if (values.operation === 'publishMessage') {
        if (!values.topicArn && !values.phoneNumber && !values.targetArn) {
          showErrorModal('Either Topic ARN, Phone Number, or Target ARN is required for publish message operation')
          return
        }
        if (!values.message) {
          showErrorModal('Message is required for publish message operation')
          return
        }
      }
      
      if (values.operation === 'publishBatch') {
        if (!values.topicArn) {
          showErrorModal('Topic ARN is required for publish batch operation')
          return
        }
        if (!values.batchMessages) {
          showErrorModal('Batch messages JSON is required for publish batch operation')
          return
        }
      }
      
      if (values.operation === 'createTopic' && !values.topicName) {
        showErrorModal('Topic name is required for create topic operation')
        return
      }
      
      if (['deleteTopic', 'listSubscriptionsByTopic', 'getTopicAttributes'].includes(values.operation) && !values.topicArn) {
        showErrorModal('Topic ARN is required for this operation')
        return
      }
      
      if (values.operation === 'subscribe') {
        if (!values.topicArn || !values.protocol || !values.endpoint) {
          showErrorModal('Topic ARN, protocol, and endpoint are required for subscribe operation')
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        operation: values.operation,
        topicArn: values.topicArn,
        phoneNumber: values.phoneNumber,
        targetArn: values.targetArn,
        message: values.message,
        subject: values.subject,
        messageAttributes: values.messageAttributes,
        messageStructure: values.messageStructure,
        messageDeduplicationId: values.messageDeduplicationId,
        messageGroupId: values.messageGroupId,
        topicName: values.topicName,
        protocol: values.protocol,
        endpoint: values.endpoint,
        attributes: values.attributes,
        tags: values.tags,
        batchMessages: values.batchMessages
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('SNS configuration updated')
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
      message.warning('Please configure SNS operation first')
      return
    }

    const startTime = Date.now()

    // Show immediate progress indication in execution panel
    const progressResult = {
      nodeId: id,
      status: 'running' as const,
      output: `Executing SNS ${data.config.operation}...`,
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
        case 'publishMessage':
          endpoint = '/api/aws/sns/message/publish'
          if (!data.config.topicArn && !data.config.phoneNumber && !data.config.targetArn) {
            message.error('Either Topic ARN, Phone Number, or Target ARN is required for publish message')
            return
          }
          if (!data.config.message) {
            message.error('Message is required for publish message')
            return
          }
          requestBody.topicArn = data.config.topicArn
          requestBody.phoneNumber = data.config.phoneNumber
          requestBody.targetArn = data.config.targetArn
          requestBody.message = data.config.message
          requestBody.subject = data.config.subject
          if (data.config.messageAttributes) {
            try {
              requestBody.messageAttributes = JSON.parse(data.config.messageAttributes)
            } catch (e) {
              message.error('Invalid JSON format for message attributes')
              return
            }
          }
          requestBody.messageStructure = data.config.messageStructure
          requestBody.messageDeduplicationId = data.config.messageDeduplicationId
          requestBody.messageGroupId = data.config.messageGroupId
          break
          
        case 'publishBatch':
          endpoint = '/api/aws/sns/message/publish-batch'
          if (!data.config.topicArn) {
            message.error('Topic ARN is required for publish batch')
            return
          }
          if (!data.config.batchMessages) {
            message.error('Batch messages JSON is required for publish batch')
            return
          }
          requestBody.topicArn = data.config.topicArn
          try {
            requestBody.messages = JSON.parse(data.config.batchMessages)
          } catch (e) {
            message.error('Invalid JSON format for batch messages')
            return
          }
          break
          
        case 'listTopics':
          endpoint = '/api/aws/sns/topics/list'
          break
          
        case 'createTopic':
          endpoint = '/api/aws/sns/topic/create'
          if (!data.config.topicName) {
            message.error('Topic name is required for create topic')
            return
          }
          requestBody.name = data.config.topicName
          if (data.config.attributes) {
            try {
              requestBody.attributes = JSON.parse(data.config.attributes)
            } catch (e) {
              message.error('Invalid JSON format for attributes')
              return
            }
          }
          if (data.config.tags) {
            try {
              requestBody.tags = JSON.parse(data.config.tags)
            } catch (e) {
              message.error('Invalid JSON format for tags')
              return
            }
          }
          break
          
        case 'deleteTopic':
          endpoint = '/api/aws/sns/topic/delete'
          if (!data.config.topicArn) {
            message.error('Topic ARN is required for delete topic')
            return
          }
          requestBody.topicArn = data.config.topicArn
          break
          
        case 'subscribe':
          endpoint = '/api/aws/sns/topic/subscribe'
          if (!data.config.topicArn || !data.config.protocol || !data.config.endpoint) {
            message.error('Topic ARN, protocol, and endpoint are required for subscribe')
            return
          }
          requestBody.topicArn = data.config.topicArn
          requestBody.protocol = data.config.protocol
          requestBody.endpoint = data.config.endpoint
          if (data.config.attributes) {
            try {
              requestBody.attributes = JSON.parse(data.config.attributes)
            } catch (e) {
              message.error('Invalid JSON format for attributes')
              return
            }
          }
          break
          
        case 'listSubscriptionsByTopic':
          endpoint = '/api/aws/sns/topic/subscriptions'
          if (!data.config.topicArn) {
            message.error('Topic ARN is required for list subscriptions')
            return
          }
          requestBody.topicArn = data.config.topicArn
          break
          
        case 'getTopicAttributes':
          endpoint = '/api/aws/sns/topic/attributes'
          if (!data.config.topicArn) {
            message.error('Topic ARN is required for get topic attributes')
            return
          }
          requestBody.topicArn = data.config.topicArn
          break
          
        default:
          message.error('Unknown SNS operation')
          return
      }
      
      // Call backend API to execute SNS operation
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
        let output = `SNS ${data.config.operation} Results:\n`
        
        if (data.config.operation === 'publishMessage') {
          output += `Message ID: ${result.messageId}\n`
          output += `Target: ${result.target}\n`
          output += `Message Length: ${result.messageLength} characters\n`
          if (result.subject) {
            output += `Subject: ${result.subject}\n`
          }
          if (result.sequenceNumber) {
            output += `Sequence Number: ${result.sequenceNumber}\n`
          }
        } else if (data.config.operation === 'publishBatch') {
          output += `Total Messages: ${result.totalMessages}\n`
          output += `Successful: ${result.successCount}\n`
          output += `Failed: ${result.failureCount}\n`
          output += `Topic ARN: ${result.topicArn}\n\n`
          
          if (result.successful && result.successful.length > 0) {
            output += `Successful Messages:\n`
            output += `${'='.repeat(30)}\n`
            result.successful.forEach((msg: any) => {
              output += `ID: ${msg.Id}, Message ID: ${msg.MessageId}\n`
            })
          }
          
          if (result.failed && result.failed.length > 0) {
            output += `\nFailed Messages:\n`
            output += `${'='.repeat(30)}\n`
            result.failed.forEach((msg: any) => {
              output += `ID: ${msg.Id}, Error: ${msg.Message}\n`
            })
          }
        } else if (data.config.operation === 'listTopics') {
          output += `Topics Found: ${result.totalCount}\n\n`
          if (result.topics && result.topics.length > 0) {
            output += `Topic Details:\n`
            output += `${'='.repeat(50)}\n`
            result.topics.forEach((topic: any) => {
              output += `Name: ${topic.name}\n`
              output += `ARN: ${topic.topicArn}\n`
              output += `${'-'.repeat(30)}\n`
            })
          }
        } else if (data.config.operation === 'createTopic') {
          output += `Topic Created Successfully!\n`
          output += `Name: ${result.name}\n`
          output += `ARN: ${result.topicArn}\n`
        } else if (data.config.operation === 'deleteTopic') {
          output += `Topic Deleted Successfully!\n`
          output += `ARN: ${result.topicArn}\n`
        } else if (data.config.operation === 'subscribe') {
          output += `Subscription Created Successfully!\n`
          output += `Subscription ARN: ${result.subscriptionArn}\n`
          output += `Topic ARN: ${result.topicArn}\n`
          output += `Protocol: ${result.protocol}\n`
          output += `Endpoint: ${result.endpoint}\n`
        } else if (data.config.operation === 'listSubscriptionsByTopic') {
          output += `Subscriptions Found: ${result.totalCount}\n`
          output += `Topic ARN: ${result.topicArn}\n\n`
          if (result.subscriptions && result.subscriptions.length > 0) {
            output += `Subscription Details:\n`
            output += `${'='.repeat(50)}\n`
            result.subscriptions.forEach((sub: any) => {
              output += `Protocol: ${sub.protocol}\n`
              output += `Endpoint: ${sub.endpoint}\n`
              output += `Subscription ARN: ${sub.subscriptionArn}\n`
              output += `Owner: ${sub.owner}\n`
              output += `${'-'.repeat(30)}\n`
            })
          }
        } else if (data.config.operation === 'getTopicAttributes') {
          output += `Topic Attributes:\n`
          output += `Name: ${result.name}\n`
          output += `ARN: ${result.topicArn}\n`
          output += `Subscriptions Confirmed: ${result.subscriptionsConfirmed}\n`
          output += `Subscriptions Pending: ${result.subscriptionsPending}\n`
          output += `Subscriptions Deleted: ${result.subscriptionsDeleted}\n\n`
          
          if (result.attributes && Object.keys(result.attributes).length > 0) {
            output += `All Attributes:\n`
            output += `${'='.repeat(30)}\n`
            Object.entries(result.attributes).forEach(([key, value]) => {
              output += `${key}: ${value}\n`
            })
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

        message.success(`SNS ${data.config.operation} completed successfully`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `SNS ${data.config.operation} failed: ${result.message || 'Unknown error'}`,
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
        output: `SNS operation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute SNS operation')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const getOperationLabel = () => {
    switch (data.config.operation) {
      case 'publishMessage': return 'Publish Message'
      case 'publishBatch': return 'Publish Batch'
      case 'listTopics': return 'List Topics'
      case 'createTopic': return 'Create Topic'
      case 'deleteTopic': return 'Delete Topic'
      case 'subscribe': return 'Subscribe'
      case 'listSubscriptionsByTopic': return 'List Subscriptions'
      case 'getTopicAttributes': return 'Get Topic Attributes'
      default: return 'Not configured'
    }
  }

  return (
    <>
      <div className={`aws-node node-sns ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <SNSIcon className="aws-node-icon" size={20} />
          <span>SNS</span>
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
          
          {data.config.topicArn && (
            <div className="text-xs mb-1">
              <strong>Topic:</strong> 
              <div className="break-words whitespace-normal mt-1">
                {data.config.topicArn.split(':').pop()}
              </div>
            </div>
          )}
          
          {data.config.phoneNumber && (
            <div className="text-xs mb-1">
              <strong>Phone:</strong> {data.config.phoneNumber}
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
        title="Configure SNS Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'publishMessage',
            protocol: 'email'
          }}
        >
          <Alert
            message="AWS SNS Operations"
            description="Configure SNS operations to send notifications via email, SMS, or other protocols. SNS is a fully managed messaging service."
            type="info"
            showIcon
            className="mb-4"
          />

          {loadingTopics && (
            <div className="text-center mb-4">
              <Spin size="small" /> Loading available topics...
            </div>
          )}

          <Form.Item
            label="Operation"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation' }]}
          >
            <Select placeholder="Select SNS operation">
              <Option value="publishMessage">Publish Message</Option>
              <Option value="publishBatch">Publish Batch</Option>
              <Option value="listTopics">List Topics</Option>
              <Option value="createTopic">Create Topic</Option>
              <Option value="deleteTopic">Delete Topic</Option>
              <Option value="subscribe">Subscribe</Option>
              <Option value="listSubscriptionsByTopic">List Subscriptions by Topic</Option>
              <Option value="getTopicAttributes">Get Topic Attributes</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}
          >
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'publishMessage') {
                return (
                  <>
                    <Form.Item
                      label="Topic ARN (Optional if using Phone Number)"
                      name="topicArn"
                    >
                      <AutoComplete
                        placeholder="arn:aws:sns:us-east-1:123456789012:MyTopic"
                        options={topicSearchOptions}
                        onSearch={handleTopicSearch}
                        notFoundContent={loadingTopics ? <Spin size="small" /> : 'No topics found'}
                        filterOption={false}
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Phone Number (Optional if using Topic ARN)"
                      name="phoneNumber"
                    >
                      <Input placeholder="+1234567890" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Target ARN (Optional)"
                      name="targetArn"
                    >
                      <Input placeholder="arn:aws:sns:us-east-1:123456789012:endpoint/..." />
                    </Form.Item>
                    
                    <Form.Item
                      label="Message"
                      name="message"
                      rules={[{ required: true, message: 'Please enter message' }]}
                    >
                      <TextArea 
                        rows={4} 
                        placeholder="Your notification message here..."
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Subject (Optional)"
                      name="subject"
                    >
                      <Input placeholder="Notification subject" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Message Attributes (JSON, Optional)"
                      name="messageAttributes"
                    >
                      <TextArea 
                        rows={3} 
                        placeholder='{"priority": "high", "source": "workflow"}'
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Message Structure (Optional)"
                      name="messageStructure"
                    >
                      <Select placeholder="Select message structure">
                        <Option value="json">JSON</Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item
                      label="Message Deduplication ID (FIFO only)"
                      name="messageDeduplicationId"
                    >
                      <Input placeholder="unique-message-id" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Message Group ID (FIFO only)"
                      name="messageGroupId"
                    >
                      <Input placeholder="message-group-1" />
                    </Form.Item>
                  </>
                )
              }
              
              if (operation === 'publishBatch') {
                return (
                  <>
                    <Form.Item
                      label="Topic ARN"
                      name="topicArn"
                      rules={[{ required: true, message: 'Please select topic ARN' }]}
                    >
                      <AutoComplete
                        placeholder="arn:aws:sns:us-east-1:123456789012:MyTopic"
                        options={topicSearchOptions}
                        onSearch={handleTopicSearch}
                        notFoundContent={loadingTopics ? <Spin size="small" /> : 'No topics found'}
                        filterOption={false}
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Batch Messages (JSON Array)"
                      name="batchMessages"
                      rules={[{ required: true, message: 'Please enter batch messages JSON' }]}
                    >
                      <TextArea 
                        rows={8} 
                        placeholder={`[
  {
    "id": "msg1",
    "message": "First message",
    "subject": "Subject 1"
  },
  {
    "id": "msg2", 
    "message": "Second message",
    "messageGroupId": "group1"
  }
]`}
                      />
                    </Form.Item>
                  </>
                )
              }
              
              if (operation === 'createTopic') {
                return (
                  <>
                    <Form.Item
                      label="Topic Name"
                      name="topicName"
                      rules={[{ required: true, message: 'Please enter topic name' }]}
                    >
                      <Input placeholder="MyNewTopic" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Attributes (JSON, Optional)"
                      name="attributes"
                    >
                      <TextArea 
                        rows={4} 
                        placeholder='{"DisplayName": "My Topic", "FifoTopic": "true"}'
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Tags (JSON, Optional)"
                      name="tags"
                    >
                      <TextArea 
                        rows={3} 
                        placeholder='{"Environment": "prod", "Team": "backend"}'
                      />
                    </Form.Item>
                  </>
                )
              }
              
              if (['deleteTopic', 'listSubscriptionsByTopic', 'getTopicAttributes'].includes(operation)) {
                return (
                  <Form.Item
                    label="Topic ARN"
                    name="topicArn"
                    rules={[{ required: true, message: 'Please select topic ARN' }]}
                  >
                    <AutoComplete
                      placeholder="arn:aws:sns:us-east-1:123456789012:MyTopic"
                      options={topicSearchOptions}
                      onSearch={handleTopicSearch}
                      notFoundContent={loadingTopics ? <Spin size="small" /> : 'No topics found'}
                      filterOption={false}
                    />
                  </Form.Item>
                )
              }
              
              if (operation === 'subscribe') {
                return (
                  <>
                    <Form.Item
                      label="Topic ARN"
                      name="topicArn"
                      rules={[{ required: true, message: 'Please select topic ARN' }]}
                    >
                      <AutoComplete
                        placeholder="arn:aws:sns:us-east-1:123456789012:MyTopic"
                        options={topicSearchOptions}
                        onSearch={handleTopicSearch}
                        notFoundContent={loadingTopics ? <Spin size="small" /> : 'No topics found'}
                        filterOption={false}
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="Protocol"
                      name="protocol"
                      rules={[{ required: true, message: 'Please select protocol' }]}
                    >
                      <Select placeholder="Select protocol">
                        <Option value="email">Email</Option>
                        <Option value="email-json">Email (JSON)</Option>
                        <Option value="sms">SMS</Option>
                        <Option value="sqs">SQS</Option>
                        <Option value="application">Application</Option>
                        <Option value="lambda">Lambda</Option>
                        <Option value="firehose">Firehose</Option>
                        <Option value="http">HTTP</Option>
                        <Option value="https">HTTPS</Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item
                      label="Endpoint"
                      name="endpoint"
                      rules={[{ required: true, message: 'Please enter endpoint' }]}
                    >
                      <Input placeholder="user@example.com or https://example.com/webhook" />
                    </Form.Item>
                    
                    <Form.Item
                      label="Attributes (JSON, Optional)"
                      name="attributes"
                    >
                      <TextArea 
                        rows={3} 
                        placeholder='{"FilterPolicy": "{\"store\":[\"example_corp\"]}"}'
                      />
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

SNSNode.displayName = 'SNSNode'

export default SNSNode
