import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, DatePicker, Button, message, Alert, Select, Radio, Checkbox } from 'antd'
import dayjs from 'dayjs'
import CloudWatchIcon from '../icons/CloudWatchIcon'

const { RangePicker } = DatePicker
const { Option } = Select

interface CloudWatchNodeData {
  label: string
  config: {
    // Common config
    operation?: 'logs' | 'alarms' | 'metrics'
    
    // Log query config
    logGroup?: string
    keyword?: string
    startTime?: string
    endTime?: string
    
    // Alarm config
    alarmFilter?: 'all' | 'alarm' | 'ok' | 'insufficient_data'
    selectedAlarm?: string
    includeHistory?: boolean
    
    // Metrics config
    namespace?: string
    metricName?: string
    dimensions?: Array<{ name: string; value: string }>
    period?: number
    statistics?: string[]
    metricStartTime?: string
    metricEndTime?: string
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
  const [availableAlarms, setAvailableAlarms] = useState<any[]>([])
  const [loadingAlarms, setLoadingAlarms] = useState(false)
  const [form] = Form.useForm()

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available alarms when operation is set to 'alarms'
  const loadAlarms = useCallback(async (stateFilter?: string) => {
    setLoadingAlarms(true)
    try {
      const requestBody: any = {
        accountId: 'dev-account-1'
      }
      
      if (stateFilter && stateFilter !== 'all') {
        requestBody.stateValue = stateFilter.toUpperCase()
      }

      const response = await fetch('/api/aws/cloudwatch/alarms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setAvailableAlarms(result.alarms || [])
      } else {
        message.error(`Failed to load alarms: ${result.message || 'Unknown error'}`)
        setAvailableAlarms([])
      }
    } catch (error: any) {
      message.error('Failed to load CloudWatch alarms')
      setAvailableAlarms([])
    } finally {
      setLoadingAlarms(false)
    }
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
    const operation = data.config.operation || 'logs'
    form.setFieldsValue({
      operation,
      logGroup: data.config.logGroup || '',
      keyword: data.config.keyword || '',
      timeRange: data.config.startTime && data.config.endTime ? [
        dayjs(data.config.startTime),
        dayjs(data.config.endTime)
      ] : null,
      alarmFilter: data.config.alarmFilter || 'all',
      selectedAlarm: data.config.selectedAlarm || undefined,
      includeHistory: data.config.includeHistory || false
    })

    // Load alarms if operation is alarms
    if (operation === 'alarms') {
      loadAlarms(data.config.alarmFilter)
    }
  }, [data.config, form, loadAlarms])

  const handleOperationChange = useCallback((operation: string) => {
    if (operation === 'alarms') {
      loadAlarms(form.getFieldValue('alarmFilter') || 'all')
    }
  }, [form, loadAlarms])

  const handleAlarmFilterChange = useCallback((filter: string) => {
    loadAlarms(filter)
    // Clear selected alarm when filter changes
    form.setFieldValue('selectedAlarm', undefined)
  }, [form, loadAlarms])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      const operation = values.operation || 'logs'
      
      if (operation === 'logs') {
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
      }
      
      // Update node data with new configuration
      const newConfig: any = {
        operation,
      }

      if (operation === 'logs') {
        newConfig.logGroup = values.logGroup
        newConfig.keyword = values.keyword
        newConfig.startTime = values.timeRange?.[0]?.toISOString()
        newConfig.endTime = values.timeRange?.[1]?.toISOString()
      } else if (operation === 'alarms') {
        newConfig.alarmFilter = values.alarmFilter
        newConfig.selectedAlarm = values.selectedAlarm
        newConfig.includeHistory = values.includeHistory
      } else {
        // Metrics operation
        newConfig.namespace = values.namespace
        newConfig.metricName = values.metricName
        newConfig.statistics = values.statistics
        newConfig.period = values.period
        newConfig.metricStartTime = values.metricTimeRange?.[0]?.toISOString()
        newConfig.metricEndTime = values.metricTimeRange?.[1]?.toISOString()
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
    
    const operation = data.config.operation || 'logs'
    const startTime = Date.now()

    try {
      if (operation === 'logs') {
        // Execute log query
        if (!data.config.logGroup || !data.config.keyword) {
          message.warning('Please configure log group and keyword first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          logGroup: data.config.logGroup,
          filterPattern: data.config.keyword,
          startTime: data.config.startTime ? new Date(data.config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
          endTime: data.config.endTime ? new Date(data.config.endTime).getTime() : Date.now()
        }
        
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
          
          let output = `CloudWatch Log Query Results:\n`
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

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.success(`Found ${events.length} log entries`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `CloudWatch log query failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Query failed: ${result.message || 'Unknown error'}`)
        }
      } else if (operation === 'alarms') {
        // Execute alarm query
        if (!data.config.selectedAlarm) {
          message.warning('Please select an alarm first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          alarmName: data.config.selectedAlarm,
          includeHistory: data.config.includeHistory || false
        }
        
        const response = await fetch('/api/aws/cloudwatch/alarm/details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        const duration = Date.now() - startTime

        if (response.ok && result.success) {
          const alarm = result.alarm
          const history = result.history || []
          
          let output = `CloudWatch Alarm Details:\n`
          output += `${'='.repeat(50)}\n`
          output += `Alarm Name: ${alarm.alarmName}\n`
          output += `Description: ${alarm.alarmDescription || 'N/A'}\n`
          output += `State: ${alarm.stateValue}\n`
          output += `State Reason: ${alarm.stateReason || 'N/A'}\n`
          output += `State Updated: ${alarm.stateUpdatedTimestamp || 'N/A'}\n`
          output += `Actions Enabled: ${alarm.actionsEnabled ? 'Yes' : 'No'}\n`
          
          if (alarm.metricName) {
            output += `\nMetric Details:\n`
            output += `Metric Name: ${alarm.metricName}\n`
            output += `Namespace: ${alarm.namespace}\n`
            output += `Statistic: ${alarm.statistic || alarm.extendedStatistic}\n`
            output += `Period: ${alarm.period} seconds\n`
            output += `Threshold: ${alarm.threshold}\n`
            output += `Comparison: ${alarm.comparisonOperator}\n`
            output += `Evaluation Periods: ${alarm.evaluationPeriods}\n`
            
            if (alarm.dimensions && alarm.dimensions.length > 0) {
              output += `Dimensions:\n`
              alarm.dimensions.forEach((dim: any) => {
                output += `  ${dim.name}: ${dim.value}\n`
              })
            }
          }

          if (alarm.alarmActions && alarm.alarmActions.length > 0) {
            output += `\nAlarm Actions:\n`
            alarm.alarmActions.forEach((action: string) => {
              output += `  ${action}\n`
            })
          }

          if (data.config.includeHistory && history.length > 0) {
            output += `\nRecent History (${history.length} entries):\n`
            output += `${'='.repeat(50)}\n`
            history.slice(0, 5).forEach((item: any) => {
              output += `[${item.timestamp}] ${item.historyItemType}\n`
              output += `${item.historySummary}\n`
              output += `${'-'.repeat(30)}\n`
            })
            
            if (history.length > 5) {
              output += `... and ${history.length - 5} more history entries\n`
            }
          }

          const executionResult = {
            nodeId: id,
            status: 'success' as const,
            output,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.success(`Retrieved alarm details for ${alarm.alarmName}`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `CloudWatch alarm query failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Query failed: ${result.message || 'Unknown error'}`)
        }
      } else {
        // Execute metrics query
        if (!data.config.namespace || !data.config.metricName || !data.config.statistics || !data.config.period || !data.config.metricStartTime || !data.config.metricEndTime) {
          message.warning('Please configure all required metrics fields first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          namespace: data.config.namespace,
          metricName: data.config.metricName,
          statistics: data.config.statistics,
          period: data.config.period,
          startTime: new Date(data.config.metricStartTime),
          endTime: new Date(data.config.metricEndTime)
        }
        
        const response = await fetch('/api/aws/cloudwatch/metrics/statistics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        const duration = Date.now() - startTime

        if (response.ok && result.success) {
          const datapoints = result.datapoints || []
          
          let output = `CloudWatch Metrics Statistics:\n`
          output += `${'='.repeat(50)}\n`
          output += `Namespace: ${result.namespace}\n`
          output += `Metric Name: ${result.metricName}\n`
          output += `Statistics: ${result.statistics.join(', ')}\n`
          output += `Period: ${result.period} seconds\n`
          output += `Time Range: ${result.timeRange.start} to ${result.timeRange.end}\n`
          output += `Data Points Found: ${datapoints.length}\n\n`
          
          if (datapoints.length > 0) {
            output += `Data Points:\n`
            output += `${'='.repeat(50)}\n`
            datapoints.forEach((dp: any, index: number) => {
              output += `[${dp.timestamp}]\n`
              if (dp.average !== undefined) output += `  Average: ${dp.average}\n`
              if (dp.sum !== undefined) output += `  Sum: ${dp.sum}\n`
              if (dp.maximum !== undefined) output += `  Maximum: ${dp.maximum}\n`
              if (dp.minimum !== undefined) output += `  Minimum: ${dp.minimum}\n`
              if (dp.sampleCount !== undefined) output += `  Sample Count: ${dp.sampleCount}\n`
              if (dp.unit) output += `  Unit: ${dp.unit}\n`
              if (index < datapoints.length - 1) output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No data points found for the specified metric and time range.\n`
          }

          const executionResult = {
            nodeId: id,
            status: 'success' as const,
            output,
            duration,
            timestamp: new Date().toISOString(),
            extractedData: {
              datapoints,
              metricName: result.metricName,
              namespace: result.namespace,
              statistics: result.statistics,
              period: result.period,
              timeRange: result.timeRange
            }
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.success(`Retrieved ${datapoints.length} data points`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `CloudWatch metrics query failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Query failed: ${result.message || 'Unknown error'}`)
        }
      }
    } catch (error: any) {
      const executionResult = {
        nodeId: id,
        status: 'error' as const,
        output: `CloudWatch query error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute CloudWatch query')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const getNodeDisplayContent = () => {
    const operation = data.config.operation || 'logs'
    
    if (operation === 'logs') {
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Log Query
          </div>
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
        </>
      )
    } else if (operation === 'alarms') {
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Alarm Monitoring
          </div>
          <div className="text-xs mb-1">
            <strong>Filter:</strong> {data.config.alarmFilter === 'all' ? 'All Alarms' : 
              data.config.alarmFilter === 'alarm' ? 'In Alarm' :
              data.config.alarmFilter === 'ok' ? 'OK State' : 'Insufficient Data'}
          </div>
          
          {data.config.selectedAlarm ? (
            <div className="text-xs mb-1">
              <strong>Selected:</strong> {data.config.selectedAlarm}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No alarm selected</div>
          )}
          
          <div className="text-xs mb-2">
            <strong>Include History:</strong> {data.config.includeHistory ? 'Yes' : 'No'}
          </div>
        </>
      )
    } else {
      // Metrics operation
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Metrics Statistics
          </div>
          {data.config.namespace ? (
            <div className="text-xs mb-1">
              <strong>Namespace:</strong> {data.config.namespace}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No namespace configured</div>
          )}
          
          {data.config.metricName ? (
            <div className="text-xs mb-1">
              <strong>Metric:</strong> {data.config.metricName}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No metric configured</div>
          )}
          
          {data.config.statistics && data.config.statistics.length > 0 ? (
            <div className="text-xs mb-1">
              <strong>Statistics:</strong> {data.config.statistics.join(', ')}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No statistics configured</div>
          )}
          
          {data.config.period ? (
            <div className="text-xs mb-2">
              <strong>Period:</strong> {data.config.period}s
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-2">No period configured</div>
          )}
        </>
      )
    }
  }

  const isExecuteDisabled = () => {
    const operation = data.config.operation || 'logs'
    
    if (operation === 'logs') {
      return !data.config.logGroup || !data.config.keyword
    } else if (operation === 'alarms') {
      return !data.config.selectedAlarm
    } else {
      // Metrics operation
      return !data.config.namespace || !data.config.metricName || !data.config.statistics || 
             !data.config.period || !data.config.metricStartTime || !data.config.metricEndTime
    }
  }

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
          {getNodeDisplayContent()}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={isExecuteDisabled()}
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
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'logs',
            logGroup: '',
            keyword: '',
            timeRange: null,
            alarmFilter: 'all',
            selectedAlarm: undefined,
            includeHistory: false
          }}
        >
          <Form.Item
            label="Operation Type"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation type' }]}
          >
            <Radio.Group onChange={(e) => handleOperationChange(e.target.value)}>
              <Radio value="logs">Log Query</Radio>
              <Radio value="alarms">Alarm Monitoring</Radio>
              <Radio value="metrics">Metrics Statistics</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}>
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'logs') {
                return (
                  <>
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
                  </>
                )
              } else if (operation === 'alarms') {
                return (
                  <>
                    <Form.Item
                      label="Alarm Filter"
                      name="alarmFilter"
                      help="Filter alarms by their current state"
                    >
                      <Select onChange={handleAlarmFilterChange}>
                        <Option value="all">All Alarms</Option>
                        <Option value="alarm">In Alarm State</Option>
                        <Option value="ok">OK State</Option>
                        <Option value="insufficient_data">Insufficient Data</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="Select Alarm"
                      name="selectedAlarm"
                      rules={[{ required: true, message: 'Please select an alarm' }]}
                      help="Choose an alarm to monitor and get details"
                    >
                      <Select
                        placeholder="Select an alarm"
                        loading={loadingAlarms}
                        showSearch
                        filterOption={(input, option) => {
                          if (!option?.value || !input) return true
                          const alarmName = option.value as string
                          return alarmName.toLowerCase().includes(input.toLowerCase())
                        }}
                        optionLabelProp="label"
                      >
                        {availableAlarms.map((alarm) => (
                          <Option 
                            key={alarm.alarmName} 
                            value={alarm.alarmName}
                            label={alarm.alarmName}
                          >
                            <div style={{ 
                              whiteSpace: 'normal', 
                              wordWrap: 'break-word',
                              lineHeight: '1.4',
                              padding: '2px 0'
                            }}>
                              {alarm.alarmName}
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="includeHistory"
                      valuePropName="checked"
                    >
                      <Checkbox>Include alarm history in results</Checkbox>
                    </Form.Item>
                  </>
                )
              } else {
                // Metrics operation
                return (
                  <>
                    <Form.Item
                      label="Namespace"
                      name="namespace"
                      rules={[{ required: true, message: 'Please enter a namespace' }]}
                      help="AWS service namespace (e.g., AWS/Lambda, AWS/EC2, AWS/RDS)"
                    >
                      <Select placeholder="Select or enter namespace" showSearch allowClear>
                        <Option value="AWS/Lambda">AWS/Lambda</Option>
                        <Option value="AWS/EC2">AWS/EC2</Option>
                        <Option value="AWS/RDS">AWS/RDS</Option>
                        <Option value="AWS/DynamoDB">AWS/DynamoDB</Option>
                        <Option value="AWS/S3">AWS/S3</Option>
                        <Option value="AWS/CloudFront">AWS/CloudFront</Option>
                        <Option value="AWS/ELB">AWS/ELB</Option>
                        <Option value="AWS/ApplicationELB">AWS/ApplicationELB</Option>
                        <Option value="AWS/NetworkELB">AWS/NetworkELB</Option>
                        <Option value="AWS/ApiGateway">AWS/ApiGateway</Option>
                        <Option value="AWS/SQS">AWS/SQS</Option>
                        <Option value="AWS/SNS">AWS/SNS</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="Metric Name"
                      name="metricName"
                      rules={[{ required: true, message: 'Please enter a metric name' }]}
                      help="Name of the metric to retrieve (e.g., Duration, Invocations, CPUUtilization)"
                    >
                      <Input placeholder="Duration" />
                    </Form.Item>

                    <Form.Item
                      label="Statistics"
                      name="statistics"
                      rules={[{ required: true, message: 'Please select at least one statistic' }]}
                      help="Statistical functions to apply to the metric data"
                    >
                      <Select mode="multiple" placeholder="Select statistics">
                        <Option value="Average">Average</Option>
                        <Option value="Sum">Sum</Option>
                        <Option value="Maximum">Maximum</Option>
                        <Option value="Minimum">Minimum</Option>
                        <Option value="SampleCount">Sample Count</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="Period (seconds)"
                      name="period"
                      rules={[{ required: true, message: 'Please select a period' }]}
                      help="Time period for data aggregation"
                    >
                      <Select placeholder="Select period">
                        <Option value={60}>1 minute</Option>
                        <Option value={300}>5 minutes</Option>
                        <Option value={900}>15 minutes</Option>
                        <Option value={3600}>1 hour</Option>
                        <Option value={21600}>6 hours</Option>
                        <Option value={86400}>1 day</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="Time Range"
                      name="metricTimeRange"
                      rules={[{ required: true, message: 'Please select a time range' }]}
                      help="Time range for metric data retrieval"
                    >
                      <RangePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        className="w-full"
                      />
                    </Form.Item>
                  </>
                )
              }
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

CloudWatchNode.displayName = 'CloudWatchNode'

export default CloudWatchNode
