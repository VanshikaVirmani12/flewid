import React, { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, DatePicker, Button, message, Alert, Select, Radio, Checkbox, InputNumber } from 'antd'
import dayjs from 'dayjs'
import APIGatewayIcon from '../icons/APIGatewayIcon'

const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

interface APIGatewayNodeData {
  label: string
  config: {
    // Common config
    operation?: 'access_logs' | 'request_tracing' | 'throttling_detection'
    
    // Access logs config
    apiId?: string
    stage?: string
    logGroup?: string
    startTime?: string
    endTime?: string
    
    // Request/response tracing config
    traceId?: string
    requestId?: string
    
    // Throttling detection config
    throttleThreshold?: number
    timeWindow?: number // minutes
    includeDetails?: boolean
  }
}

interface APIGatewayNodeProps {
  data: APIGatewayNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const APIGatewayNode: React.FC<APIGatewayNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [availableAPIs, setAvailableAPIs] = useState<any[]>([])
  const [availableStages, setAvailableStages] = useState<any[]>([])
  const [loadingAPIs, setLoadingAPIs] = useState(false)
  const [loadingStages, setLoadingStages] = useState(false)
  const [form] = Form.useForm()

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  // Load available APIs
  const loadAPIs = useCallback(async () => {
    setLoadingAPIs(true)
    try {
      const response = await fetch('/api/aws/apigateway/apis', {
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
        setAvailableAPIs(result.apis || [])
      } else {
        message.error(`Failed to load APIs: ${result.message || 'Unknown error'}`)
        setAvailableAPIs([])
      }
    } catch (error: any) {
      message.error('Failed to load API Gateway APIs')
      setAvailableAPIs([])
    } finally {
      setLoadingAPIs(false)
    }
  }, [])

  // Load stages for selected API
  const loadStages = useCallback(async (apiId: string) => {
    if (!apiId) {
      setAvailableStages([])
      return
    }

    setLoadingStages(true)
    try {
      const response = await fetch('/api/aws/apigateway/stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'dev-account-1',
          apiId: apiId
        })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setAvailableStages(result.stages || [])
      } else {
        message.error(`Failed to load stages: ${result.message || 'Unknown error'}`)
        setAvailableStages([])
      }
    } catch (error: any) {
      message.error('Failed to load API Gateway stages')
      setAvailableStages([])
    } finally {
      setLoadingStages(false)
    }
  }, [])

  const validateApiId = (apiId: string): { isValid: boolean; error?: string } => {
    if (!apiId || apiId.trim() === '') {
      return { isValid: false, error: 'API ID cannot be empty.' }
    }

    const trimmedApiId = apiId.trim()

    // API Gateway API ID format validation (10 characters, alphanumeric)
    if (!/^[a-zA-Z0-9]{10}$/.test(trimmedApiId)) {
      return { 
        isValid: false, 
        error: `API ID must be exactly 10 alphanumeric characters.

Examples:
• abcd123456
• 1234567890
• myapi12345

Current value: "${trimmedApiId}" (${trimmedApiId.length} characters)` 
      }
    }

    return { isValid: true }
  }

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
• /aws/apigateway/my-api
• /aws/apigateway/welcome
• /my-api/access-logs` 
      }
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9/_.-]+$/.test(trimmedLogGroup)) {
      return { 
        isValid: false, 
        error: `Log group name contains invalid characters. Only letters, numbers, hyphens (-), underscores (_), periods (.), and forward slashes (/) are allowed.

Current value: "${trimmedLogGroup}"` 
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
    if (startTimestamp > now + 24 * 60 * 60 * 1000) {
      return { 
        isValid: false, 
        error: 'Start time cannot be more than 24 hours in the future.' 
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
    const operation = data.config.operation || 'access_logs'
    form.setFieldsValue({
      operation,
      apiId: data.config.apiId || '',
      stage: data.config.stage || '',
      logGroup: data.config.logGroup || '',
      timeRange: data.config.startTime && data.config.endTime ? [
        dayjs(data.config.startTime),
        dayjs(data.config.endTime)
      ] : null,
      traceId: data.config.traceId || '',
      requestId: data.config.requestId || '',
      throttleThreshold: data.config.throttleThreshold || 100,
      timeWindow: data.config.timeWindow || 60,
      includeDetails: data.config.includeDetails || false
    })

    // Load APIs when modal opens
    loadAPIs()
    
    // Load stages if API is already selected
    if (data.config.apiId) {
      loadStages(data.config.apiId)
    }
  }, [data.config, form, loadAPIs, loadStages])

  const handleOperationChange = useCallback((operation: string) => {
    // Clear relevant fields when operation changes
    if (operation === 'access_logs') {
      form.setFieldsValue({
        traceId: '',
        requestId: '',
        throttleThreshold: 100,
        timeWindow: 60
      })
    } else if (operation === 'request_tracing') {
      form.setFieldsValue({
        throttleThreshold: 100,
        timeWindow: 60
      })
    } else if (operation === 'throttling_detection') {
      form.setFieldsValue({
        traceId: '',
        requestId: ''
      })
    }
  }, [form])

  const handleApiChange = useCallback((apiId: string) => {
    // Clear stage when API changes
    form.setFieldValue('stage', '')
    // Load stages for new API
    loadStages(apiId)
  }, [form, loadStages])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      const operation = values.operation || 'access_logs'
      
      if (operation === 'access_logs') {
        // Validate API ID
        if (values.apiId) {
          const apiIdValidation = validateApiId(values.apiId)
          if (!apiIdValidation.isValid) {
            showErrorModal(`API ID Validation Error:\n\n${apiIdValidation.error}`)
            return
          }
        }

        // Validate log group
        if (values.logGroup) {
          const logGroupValidation = validateLogGroup(values.logGroup)
          if (!logGroupValidation.isValid) {
            showErrorModal(`Log Group Validation Error:\n\n${logGroupValidation.error}`)
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

      if (operation === 'access_logs') {
        newConfig.apiId = values.apiId
        newConfig.stage = values.stage
        newConfig.logGroup = values.logGroup
        newConfig.startTime = values.timeRange?.[0]?.toISOString()
        newConfig.endTime = values.timeRange?.[1]?.toISOString()
      } else if (operation === 'request_tracing') {
        newConfig.apiId = values.apiId
        newConfig.stage = values.stage
        newConfig.traceId = values.traceId
        newConfig.requestId = values.requestId
        newConfig.startTime = values.timeRange?.[0]?.toISOString()
        newConfig.endTime = values.timeRange?.[1]?.toISOString()
      } else if (operation === 'throttling_detection') {
        newConfig.apiId = values.apiId
        newConfig.stage = values.stage
        newConfig.throttleThreshold = values.throttleThreshold
        newConfig.timeWindow = values.timeWindow
        newConfig.includeDetails = values.includeDetails
        newConfig.startTime = values.timeRange?.[0]?.toISOString()
        newConfig.endTime = values.timeRange?.[1]?.toISOString()
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('API Gateway configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal, validateApiId, validateLogGroup, validateTimeRange])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    const operation = data.config.operation || 'access_logs'
    const startTime = Date.now()

    try {
      if (operation === 'access_logs') {
        // Execute access logs analysis
        if (!data.config.apiId || !data.config.logGroup) {
          message.warning('Please configure API ID and log group first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          operation: 'access_logs',
          apiId: data.config.apiId,
          stage: data.config.stage,
          logGroup: data.config.logGroup,
          startTime: data.config.startTime ? new Date(data.config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
          endTime: data.config.endTime ? new Date(data.config.endTime).getTime() : Date.now()
        }
        
        const response = await fetch('/api/aws/apigateway/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        const duration = Date.now() - startTime

        if (response.ok && result.success) {
          const logs = result.logs || []
          const summary = result.summary || {}
          
          let output = `API Gateway Access Logs Analysis:\n`
          output += `API ID: ${summary.apiId || data.config.apiId}\n`
          output += `Stage: ${summary.stage || data.config.stage || 'N/A'}\n`
          output += `Log Group: ${summary.logGroup || data.config.logGroup}\n`
          output += `Time Range: ${summary.timeRange?.start || 'N/A'} to ${summary.timeRange?.end || 'N/A'}\n`
          output += `Total Requests: ${logs.length}\n\n`
          
          if (logs.length > 0) {
            output += `Request Summary:\n`
            output += `${'='.repeat(50)}\n`
            
            // Group by status codes
            const statusCodes: { [key: string]: number } = {}
            const methods: { [key: string]: number } = {}
            let totalResponseTime = 0
            let errorCount = 0
            
            logs.forEach((log: any) => {
              statusCodes[log.status] = (statusCodes[log.status] || 0) + 1
              methods[log.method] = (methods[log.method] || 0) + 1
              if (log.responseTime) totalResponseTime += log.responseTime
              if (log.status >= 400) errorCount++
            })
            
            output += `Status Code Distribution:\n`
            Object.entries(statusCodes).forEach(([status, count]) => {
              output += `  ${status}: ${count} requests\n`
            })
            
            output += `\nHTTP Method Distribution:\n`
            Object.entries(methods).forEach(([method, count]) => {
              output += `  ${method}: ${count} requests\n`
            })
            
            output += `\nPerformance Metrics:\n`
            output += `  Average Response Time: ${(totalResponseTime / logs.length).toFixed(2)}ms\n`
            output += `  Error Rate: ${((errorCount / logs.length) * 100).toFixed(2)}%\n`
            
            output += `\nRecent Requests:\n`
            output += `${'='.repeat(50)}\n`
            logs.slice(0, 10).forEach((log: any) => {
              output += `[${log.timestamp}] ${log.method} ${log.path}\n`
              output += `Status: ${log.status} | Response Time: ${log.responseTime}ms | IP: ${log.sourceIp}\n`
              if (log.userAgent) output += `User-Agent: ${log.userAgent}\n`
              output += `${'-'.repeat(30)}\n`
            })
            
            if (logs.length > 10) {
              output += `... and ${logs.length - 10} more requests\n`
            }
          } else {
            output += `No access logs found for the specified criteria\n`
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

          message.success(`Analyzed ${logs.length} access log entries`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `API Gateway access logs analysis failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Analysis failed: ${result.message || 'Unknown error'}`)
        }
      } else if (operation === 'request_tracing') {
        // Execute request/response tracing
        if (!data.config.apiId) {
          message.warning('Please configure API ID first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          operation: 'request_tracing',
          apiId: data.config.apiId,
          stage: data.config.stage,
          traceId: data.config.traceId,
          requestId: data.config.requestId,
          startTime: data.config.startTime ? new Date(data.config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
          endTime: data.config.endTime ? new Date(data.config.endTime).getTime() : Date.now()
        }
        
        const response = await fetch('/api/aws/apigateway/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        const duration = Date.now() - startTime

        if (response.ok && result.success) {
          const traces = result.traces || []
          
          let output = `API Gateway Request/Response Tracing:\n`
          output += `API ID: ${data.config.apiId}\n`
          output += `Stage: ${data.config.stage || 'N/A'}\n`
          if (data.config.traceId) output += `Trace ID: ${data.config.traceId}\n`
          if (data.config.requestId) output += `Request ID: ${data.config.requestId}\n`
          output += `Total Traces Found: ${traces.length}\n\n`
          
          if (traces.length > 0) {
            output += `Trace Details:\n`
            output += `${'='.repeat(50)}\n`
            traces.forEach((trace: any, index: number) => {
              output += `Trace ${index + 1}:\n`
              output += `  Request ID: ${trace.requestId}\n`
              output += `  Trace ID: ${trace.traceId}\n`
              output += `  Timestamp: ${trace.timestamp}\n`
              output += `  Method: ${trace.method} ${trace.path}\n`
              output += `  Status: ${trace.status}\n`
              output += `  Response Time: ${trace.responseTime}ms\n`
              if (trace.requestHeaders) {
                output += `  Request Headers: ${JSON.stringify(trace.requestHeaders, null, 2)}\n`
              }
              if (trace.responseHeaders) {
                output += `  Response Headers: ${JSON.stringify(trace.responseHeaders, null, 2)}\n`
              }
              if (trace.requestBody) {
                output += `  Request Body: ${trace.requestBody}\n`
              }
              if (trace.responseBody) {
                output += `  Response Body: ${trace.responseBody}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No traces found for the specified criteria\n`
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

          message.success(`Found ${traces.length} request traces`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `API Gateway request tracing failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Tracing failed: ${result.message || 'Unknown error'}`)
        }
      } else if (operation === 'throttling_detection') {
        // Execute throttling detection
        if (!data.config.apiId) {
          message.warning('Please configure API ID first')
          return
        }

        const requestBody = {
          accountId: 'dev-account-1',
          operation: 'throttling_detection',
          apiId: data.config.apiId,
          stage: data.config.stage,
          throttleThreshold: data.config.throttleThreshold || 100,
          timeWindow: data.config.timeWindow || 60,
          includeDetails: data.config.includeDetails || false,
          startTime: data.config.startTime ? new Date(data.config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
          endTime: data.config.endTime ? new Date(data.config.endTime).getTime() : Date.now()
        }
        
        const response = await fetch('/api/aws/apigateway/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        const duration = Date.now() - startTime

        if (response.ok && result.success) {
          const throttlingEvents = result.throttlingEvents || []
          const summary = result.summary || {}
          
          let output = `API Gateway Throttling Detection:\n`
          output += `API ID: ${data.config.apiId}\n`
          output += `Stage: ${data.config.stage || 'N/A'}\n`
          output += `Threshold: ${data.config.throttleThreshold} requests per ${data.config.timeWindow} minutes\n`
          output += `Time Range: ${summary.timeRange?.start || 'N/A'} to ${summary.timeRange?.end || 'N/A'}\n`
          output += `Throttling Events Found: ${throttlingEvents.length}\n\n`
          
          if (throttlingEvents.length > 0) {
            output += `Throttling Summary:\n`
            output += `${'='.repeat(50)}\n`
            output += `Total Throttled Requests: ${summary.totalThrottledRequests || 0}\n`
            output += `Peak Request Rate: ${summary.peakRequestRate || 0} requests/minute\n`
            output += `Most Affected Endpoint: ${summary.mostAffectedEndpoint || 'N/A'}\n\n`
            
            output += `Throttling Events:\n`
            output += `${'='.repeat(50)}\n`
            throttlingEvents.slice(0, 10).forEach((event: any, index: number) => {
              output += `Event ${index + 1}:\n`
              output += `  Timestamp: ${event.timestamp}\n`
              output += `  Endpoint: ${event.method} ${event.path}\n`
              output += `  Request Rate: ${event.requestRate} requests/minute\n`
              output += `  Throttled Requests: ${event.throttledCount}\n`
              output += `  Source IPs: ${event.sourceIps?.join(', ') || 'N/A'}\n`
              if (data.config.includeDetails && event.details) {
                output += `  Details: ${JSON.stringify(event.details, null, 2)}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
            
            if (throttlingEvents.length > 10) {
              output += `... and ${throttlingEvents.length - 10} more events\n`
            }
          } else {
            output += `No throttling events detected above the threshold\n`
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

          message.success(`Detected ${throttlingEvents.length} throttling events`)
        } else {
          const executionResult = {
            nodeId: id,
            status: 'error' as const,
            output: `API Gateway throttling detection failed: ${result.message || 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString(),
          }

          if (onNodeExecute) {
            onNodeExecute(executionResult)
          }

          message.error(`Detection failed: ${result.message || 'Unknown error'}`)
        }
      }
    } catch (error: any) {
      const executionResult = {
        nodeId: id,
        status: 'error' as const,
        output: `API Gateway analysis error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute API Gateway analysis')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  const getNodeDisplayContent = () => {
    const operation = data.config.operation || 'access_logs'
    
    if (operation === 'access_logs') {
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Access Logs Analysis
          </div>
          {data.config.apiId ? (
            <div className="text-xs mb-1">
              <div style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                maxWidth: '100%'
              }}>
                <strong>API ID:</strong> <span title={data.config.apiId}>{data.config.apiId}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No API ID configured</div>
          )}
          
          {data.config.stage ? (
            <div className="text-xs mb-1">
              <strong>Stage:</strong> {data.config.stage}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No stage configured</div>
          )}
          
          {data.config.logGroup ? (
            <div className="text-xs mb-2">
              <strong>Log Group:</strong> {data.config.logGroup}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-2">No log group configured</div>
          )}
        </>
      )
    } else if (operation === 'request_tracing') {
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Request Tracing
          </div>
          {data.config.apiId ? (
            <div className="text-xs mb-1">
              <div style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                maxWidth: '100%'
              }}>
                <strong>API ID:</strong> <span title={data.config.apiId}>{data.config.apiId}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No API ID configured</div>
          )}
          
          {data.config.traceId ? (
            <div className="text-xs mb-1">
              <strong>Trace ID:</strong> {data.config.traceId}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No trace ID specified</div>
          )}
          
          {data.config.requestId ? (
            <div className="text-xs mb-2">
              <strong>Request ID:</strong> {data.config.requestId}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-2">No request ID specified</div>
          )}
        </>
      )
    } else {
      return (
        <>
          <div className="text-xs mb-1">
            <strong>Operation:</strong> Throttling Detection
          </div>
          {data.config.apiId ? (
            <div className="text-xs mb-1">
              <div style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                maxWidth: '100%'
              }}>
                <strong>API ID:</strong> <span title={data.config.apiId}>{data.config.apiId}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No API ID configured</div>
          )}
          
          <div className="text-xs mb-1">
            <strong>Threshold:</strong> {data.config.throttleThreshold || 100} req/{data.config.timeWindow || 60}min
          </div>
          
          <div className="text-xs mb-2">
            <strong>Include Details:</strong> {data.config.includeDetails ? 'Yes' : 'No'}
          </div>
        </>
      )
    }
  }

  const isExecuteDisabled = () => {
    const operation = data.config.operation || 'access_logs'
    
    if (operation === 'access_logs') {
      return !data.config.apiId || !data.config.logGroup
    } else if (operation === 'request_tracing') {
      return !data.config.apiId
    } else {
      return !data.config.apiId
    }
  }

  return (
    <>
      <div className={`aws-node node-apigateway ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <APIGatewayIcon className="aws-node-icon" size={20} />
          <span>API Gateway</span>
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
            Execute Analysis
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure API Gateway Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'access_logs',
            apiId: '',
            stage: '',
            logGroup: '',
            timeRange: null,
            traceId: '',
            requestId: '',
            throttleThreshold: 100,
            timeWindow: 60,
            includeDetails: false
          }}
        >
          <Form.Item
            label="Operation Type"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation type' }]}
          >
            <Radio.Group onChange={(e) => handleOperationChange(e.target.value)}>
              <Radio value="access_logs">Access Logs Analysis</Radio>
              <Radio value="request_tracing">Request/Response Tracing</Radio>
              <Radio value="throttling_detection">Throttling Detection</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="API ID"
            name="apiId"
            rules={[{ required: true, message: 'Please enter an API ID' }]}
            help="Enter the API Gateway API ID (10 alphanumeric characters)"
          >
            <Select
              placeholder="Select or enter API ID"
              loading={loadingAPIs}
              showSearch
              allowClear
              onChange={handleApiChange}
              optionLabelProp="label"
              filterOption={(input, option) => {
                if (!option?.value || !input) return true
                const apiId = option.value as string
                const api = availableAPIs.find(a => a.id === apiId)
                const searchText = `${api?.name || ''} ${apiId}`.toLowerCase()
                return searchText.includes(input.toLowerCase())
              }}
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                    <Input
                      placeholder="Or enter API ID manually"
                      onPressEnter={(e) => {
                        const value = (e.target as HTMLInputElement).value
                        if (value) {
                          form.setFieldValue('apiId', value)
                          handleApiChange(value)
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            >
              {availableAPIs.map((api) => (
                <Option key={api.id} value={api.id} label={api.id}>
                  <div>
                    <strong>{api.name || api.id}</strong>
                    <br />
                    <small style={{ color: '#666' }}>ID: {api.id}</small>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Stage"
            name="stage"
            help="Select the API Gateway stage (optional)"
          >
            <Select
              placeholder="Select stage"
              loading={loadingStages}
              allowClear
              disabled={!form.getFieldValue('apiId')}
            >
              {availableStages.map((stage) => (
                <Option key={stage.stageName} value={stage.stageName}>
                  <div>
                    <strong>{stage.stageName}</strong>
                    {stage.description && (
                      <>
                        <br />
                        <small style={{ color: '#666' }}>{stage.description}</small>
                      </>
                    )}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.operation !== currentValues.operation}>
            {({ getFieldValue }) => {
              const operation = getFieldValue('operation')
              
              if (operation === 'access_logs') {
                return (
                  <>
                    <Form.Item
                      label="CloudWatch Log Group"
                      name="logGroup"
                      rules={[{ required: true, message: 'Please enter a log group name' }]}
                      help="Enter the CloudWatch log group for API Gateway access logs (e.g., /aws/apigateway/my-api)"
                    >
                      <Input placeholder="/aws/apigateway/my-api" />
                    </Form.Item>

                    <Form.Item
                      label="Time Range"
                      name="timeRange"
                      help="Select the time range for log analysis. If not specified, last 24 hours will be used."
                    >
                      <RangePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        className="w-full"
                      />
                    </Form.Item>
                  </>
                )
              } else if (operation === 'request_tracing') {
                return (
                  <>
                    <Form.Item
                      label="Trace ID"
                      name="traceId"
                      help="Enter specific trace ID to filter (optional)"
                    >
                      <Input placeholder="1-5e1b4e99-38a6d216b8e007da" />
                    </Form.Item>

                    <Form.Item
                      label="Request ID"
                      name="requestId"
                      help="Enter specific request ID to filter (optional)"
                    >
                      <Input placeholder="12345678-1234-1234-1234-123456789012" />
                    </Form.Item>

                    <Form.Item
                      label="Time Range"
                      name="timeRange"
                      help="Select the time range for trace analysis. If not specified, last 24 hours will be used."
                    >
                      <RangePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        className="w-full"
                      />
                    </Form.Item>
                  </>
                )
              } else if (operation === 'throttling_detection') {
                return (
                  <>
                    <Form.Item
                      label="Throttle Threshold"
                      name="throttleThreshold"
                      rules={[{ required: true, message: 'Please enter a throttle threshold' }]}
                      help="Number of requests per time window to consider as throttling"
                    >
                      <InputNumber
                        min={1}
                        max={10000}
                        placeholder="100"
                        className="w-full"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Time Window (minutes)"
                      name="timeWindow"
                      rules={[{ required: true, message: 'Please enter a time window' }]}
                      help="Time window in minutes for throttling detection"
                    >
                      <InputNumber
                        min={1}
                        max={1440}
                        placeholder="60"
                        className="w-full"
                      />
                    </Form.Item>

                    <Form.Item
                      name="includeDetails"
                      valuePropName="checked"
                    >
                      <Checkbox>Include detailed throttling information in results</Checkbox>
                    </Form.Item>

                    <Form.Item
                      label="Time Range"
                      name="timeRange"
                      help="Select the time range for throttling analysis. If not specified, last 24 hours will be used."
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

APIGatewayNode.displayName = 'APIGatewayNode'

export default APIGatewayNode
