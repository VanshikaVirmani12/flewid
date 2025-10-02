import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, DatePicker, Button, message, Alert } from 'antd'
import dayjs from 'dayjs'
import CloudWatchIcon from '../icons/CloudWatchIcon'

const { RangePicker } = DatePicker

interface CloudWatchNodeData {
  label: string
  config: {
    logGroup?: string
    keyword?: string
    startTime?: string
    endTime?: string
  }
}

interface CloudWatchNodeProps {
  data: CloudWatchNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const CloudWatchNode: React.FC<CloudWatchNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form] = Form.useForm()

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  const validateLogGroup = (logGroup: string): { isValid: boolean; error?: string } => {
    if (!logGroup || logGroup.trim() === '') {
      return { isValid: false, error: 'Log group name cannot be empty.' }
    }

    const trimmedLogGroup = logGroup.trim()

    // CloudWatch log group names must start with a forward slash
    if (!trimmedLogGroup.startsWith('/')) {
      return { 
        isValid: false, 
        error: `Log group name must start with a forward slash (/). 

Examples:
• /aws/lambda/my-function
• /aws/apigateway/my-api
• /my-application/logs` 
      }
    }

    // Check for valid characters (alphanumeric, hyphens, underscores, periods, forward slashes)
    if (!/^[a-zA-Z0-9/_.-]+$/.test(trimmedLogGroup)) {
      return { 
        isValid: false, 
        error: `Log group name contains invalid characters. Only letters, numbers, hyphens (-), underscores (_), periods (.), and forward slashes (/) are allowed.

Current value: "${trimmedLogGroup}"` 
      }
    }

    // Check length (CloudWatch log group names can be up to 512 characters)
    if (trimmedLogGroup.length > 512) {
      return { 
        isValid: false, 
        error: `Log group name is too long. Maximum length is 512 characters.

Current length: ${trimmedLogGroup.length} characters` 
      }
    }

    // Check for consecutive forward slashes
    if (trimmedLogGroup.includes('//')) {
      return { 
        isValid: false, 
        error: `Log group name cannot contain consecutive forward slashes (//).

Current value: "${trimmedLogGroup}"` 
      }
    }

    return { isValid: true }
  }

  const validateKeyword = (keyword: string): { isValid: boolean; error?: string } => {
    if (!keyword || keyword.trim() === '') {
      return { isValid: false, error: 'Search keyword cannot be empty.' }
    }

    const trimmedKeyword = keyword.trim()

    // Check length (reasonable limit for search patterns)
    if (trimmedKeyword.length > 1000) {
      return { 
        isValid: false, 
        error: `Search keyword is too long. Maximum length is 1000 characters.

Current length: ${trimmedKeyword.length} characters` 
      }
    }

    return { isValid: true }
  }

  const validateTimeRange = (timeRange: any): { isValid: boolean; error?: string } => {
    if (!timeRange || !Array.isArray(timeRange) || timeRange.length !== 2) {
      return { isValid: true } // Time range is optional
    }

    const [startTime, endTime] = timeRange

    if (!startTime || !endTime) {
      return { 
        isValid: false, 
        error: 'Both start time and end time must be specified when using a time range.' 
      }
    }

    const startTimestamp = startTime.valueOf()
    const endTimestamp = endTime.valueOf()
    const now = Date.now()

    // Check if start time is before end time
    if (startTimestamp >= endTimestamp) {
      return { 
        isValid: false, 
        error: 'Start time must be before end time.' 
      }
    }

    // Check if the time range is not too far in the future
    if (startTimestamp > now + 24 * 60 * 60 * 1000) { // 24 hours in the future
      return { 
        isValid: false, 
        error: 'Start time cannot be more than 24 hours in the future.' 
      }
    }

    // Check if the time range is not too far in the past (CloudWatch retention limits)
    const maxPastTime = now - 14 * 24 * 60 * 60 * 1000 // 14 days ago
    if (endTimestamp < maxPastTime) {
      return { 
        isValid: false, 
        error: 'Time range cannot be more than 14 days in the past due to CloudWatch log retention limits.' 
      }
    }

    // Check if the time range is not too large (performance consideration)
    const timeRangeDuration = endTimestamp - startTimestamp
    const maxDuration = 7 * 24 * 60 * 60 * 1000 // 7 days
    if (timeRangeDuration > maxDuration) {
      return { 
        isValid: false, 
        error: 'Time range cannot exceed 7 days for performance reasons. Please use a smaller time window.' 
      }
    }

    return { isValid: true }
  }

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Set form values from current config
    form.setFieldsValue({
      logGroup: data.config.logGroup || '',
      keyword: data.config.keyword || '',
      timeRange: data.config.startTime && data.config.endTime ? [
        dayjs(data.config.startTime),
        dayjs(data.config.endTime)
      ] : null
    })
  }, [data.config, form])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate log group
      if (values.logGroup) {
        const logGroupValidation = validateLogGroup(values.logGroup)
        if (!logGroupValidation.isValid) {
          showErrorModal(`Log Group Validation Error:\n\n${logGroupValidation.error}`)
          return
        }
      }

      // Validate keyword
      if (values.keyword) {
        const keywordValidation = validateKeyword(values.keyword)
        if (!keywordValidation.isValid) {
          showErrorModal(`Search Keyword Validation Error:\n\n${keywordValidation.error}`)
          return
        }
      }

      // Validate time range
      if (values.timeRange) {
        const timeRangeValidation = validateTimeRange(values.timeRange)
        if (!timeRangeValidation.isValid) {
          showErrorModal(`Time Range Validation Error:\n\n${timeRangeValidation.error}`)
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        logGroup: values.logGroup,
        keyword: values.keyword,
        startTime: values.timeRange?.[0]?.toISOString(),
        endTime: values.timeRange?.[1]?.toISOString()
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('CloudWatch configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal, validateLogGroup, validateKeyword, validateTimeRange])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    if (!data.config.logGroup || !data.config.keyword) {
      message.warning('Please configure log group and keyword first')
      return
    }

    const startTime = Date.now()

    try {
      const requestBody = {
        accountId: 'dev-account-1', // This should come from selected account
        logGroup: data.config.logGroup,
        filterPattern: data.config.keyword,
        startTime: data.config.startTime ? new Date(data.config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
        endTime: data.config.endTime ? new Date(data.config.endTime).getTime() : Date.now()
      }
      
      // Call backend API to execute CloudWatch query
      const response = await fetch('/api/aws/cloudwatch/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        const events = result.events || []
        const summary = result.summary || {}
        
        let output = `CloudWatch Query Results:\n`
        output += `Log Group: ${summary.logGroup || data.config.logGroup}\n`
        output += `Filter Pattern: ${summary.filterPattern || data.config.keyword}\n`
        output += `Time Range: ${summary.timeRange?.start || 'N/A'} to ${summary.timeRange?.end || 'N/A'}\n`
        output += `Total Events Found: ${events.length}\n\n`
        
        if (events.length > 0) {
          output += `Recent Log Entries:\n`
          output += `${'='.repeat(50)}\n`
          events.slice(0, 10).forEach((event: any) => {
            output += `[${event.timestamp}] ${event.logStream}\n`
            output += `${event.message}\n`
            output += `${'-'.repeat(30)}\n`
          })
          
          if (events.length > 10) {
            output += `... and ${events.length - 10} more entries\n`
          }
        } else {
          output += `No log entries found matching the filter pattern "${data.config.keyword}"\n`
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

        message.success(`Found ${events.length} log entries`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `CloudWatch query failed: ${result.message || 'Unknown error'}`,
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
        output: `CloudWatch query error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute CloudWatch query')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  return (
    <>
      <div className={`aws-node node-cloudwatch ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <CloudWatchIcon className="aws-node-icon" size={20} />
          <span>CloudWatch</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          {data.config.logGroup ? (
            <div className="text-xs mb-1">
              <strong>Log Group:</strong> {data.config.logGroup}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No log group configured</div>
          )}
          
          {data.config.keyword ? (
            <div className="text-xs mb-1">
              <strong>Keyword:</strong> {data.config.keyword}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No keyword configured</div>
          )}
          
          {data.config.startTime && data.config.endTime ? (
            <div className="text-xs mb-2">
              <strong>Time Range:</strong><br />
              {dayjs(data.config.startTime).format('MM/DD HH:mm')} - {dayjs(data.config.endTime).format('MM/DD HH:mm')}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-2">No time range configured</div>
          )}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={!data.config.logGroup || !data.config.keyword}
            className="w-full"
          >
            Execute Query
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure CloudWatch Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            logGroup: data.config.logGroup || '',
            keyword: data.config.keyword || '',
            timeRange: null
          }}
        >
          <Form.Item
            label="Log Group Name"
            name="logGroup"
            rules={[{ required: true, message: 'Please enter a log group name' }]}
            help="Enter the CloudWatch log group name (e.g., /aws/lambda/my-function)"
          >
            <Input placeholder="/aws/lambda/my-function" />
          </Form.Item>

          <Form.Item
            label="Search Keyword"
            name="keyword"
            rules={[{ required: true, message: 'Please enter a keyword to search for' }]}
            help="Enter the keyword to filter logs (e.g., ERROR, WARN, specific text)"
          >
            <Input placeholder="ERROR" />
          </Form.Item>

          <Form.Item
            label="Time Range"
            name="timeRange"
            help="Select the time range for log search. If not specified, last 24 hours will be used."
          >
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              className="w-full"
            />
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

CloudWatchNode.displayName = 'CloudWatchNode'

export default CloudWatchNode
