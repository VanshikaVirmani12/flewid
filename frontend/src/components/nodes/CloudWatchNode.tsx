import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { CloudOutlined, SettingOutlined } from '@ant-design/icons'
import { Modal, Form, Input, DatePicker, Button, Space, message } from 'antd'
import dayjs from 'dayjs'

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
  const [form] = Form.useForm()

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
      
      // Update node data with new configuration
      const newConfig = {
        logGroup: values.logGroup,
        keyword: values.keyword,
        startTime: values.timeRange?.[0]?.toISOString(),
        endTime: values.timeRange?.[1]?.toISOString()
      }

      console.log('CloudWatch node - saving config:', newConfig)
      console.log('CloudWatch node - onConfigUpdate function:', onConfigUpdate)
      console.log('CloudWatch node - node id:', id)

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
        console.log('CloudWatch node - config update called')
      } else {
        console.error('CloudWatch node - onConfigUpdate is not available')
      }
      
      setIsConfigModalVisible(false)
      message.success('CloudWatch configuration updated')
    } catch (error) {
      console.error('Failed to save configuration:', error)
      message.error('Failed to save configuration')
    }
  }, [form, onConfigUpdate, id])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    console.log('CloudWatch node - handleExecute called with config:', data.config)
    
    if (!data.config.logGroup || !data.config.keyword) {
      console.log('CloudWatch node - missing config:', { logGroup: data.config.logGroup, keyword: data.config.keyword })
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
      
      console.log('CloudWatch node - making API request with body:', requestBody)
      
      // Call backend API to execute CloudWatch query
      const response = await fetch('/api/aws/cloudwatch/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('CloudWatch node - API response status:', response.status)
      
      const result = await response.json()
      console.log('CloudWatch node - API response body:', result)
      
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
          events.slice(0, 10).forEach((event: any, index: number) => {
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
        console.log('CloudWatch query result:', result)
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

        console.error('CloudWatch node - API error:', result)
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

      console.error('CloudWatch query error:', error)
      message.error('Failed to execute CloudWatch query')
    }
  }, [data.config, id, onNodeExecute])

  return (
    <>
      <div className={`aws-node node-cloudwatch ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <CloudOutlined className="aws-node-icon" />
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
    </>
  )
})

CloudWatchNode.displayName = 'CloudWatchNode'

export default CloudWatchNode
