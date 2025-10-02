import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Select, Button, message, Alert } from 'antd'
import EMRIcon from '../icons/EMRIcon'

const { Option } = Select
const { TextArea } = Input

interface EMRNodeData {
  label: string
  config: {
    clusterId?: string
    clusterName?: string
    operation?: string
    stepName?: string
    jarPath?: string
    mainClass?: string
    arguments?: string[]
  }
}

interface EMRNodeProps {
  data: EMRNodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const EMRNode: React.FC<EMRNodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedOperation, setSelectedOperation] = useState('listClusters')
  const [form] = Form.useForm()

  const showErrorModal = useCallback((error: string) => {
    setErrorMessage(error)
    setIsErrorModalVisible(true)
  }, [])

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalVisible(false)
    setErrorMessage('')
  }, [])

  const validateClusterId = (clusterId: string): { isValid: boolean; error?: string } => {
    if (!clusterId || clusterId.trim() === '') {
      return { isValid: false, error: 'Cluster ID cannot be empty.' }
    }

    const trimmedClusterId = clusterId.trim()

    // EMR cluster IDs follow the format j-XXXXXXXXXXXXX
    if (!/^j-[A-Z0-9]{13}$/i.test(trimmedClusterId)) {
      return { 
        isValid: false, 
        error: `Invalid EMR cluster ID format. Cluster IDs must follow the pattern: j-XXXXXXXXXXXXX

Examples:
• j-1234567890ABC
• j-ABCDEF1234567

Current value: "${trimmedClusterId}"` 
      }
    }

    return { isValid: true }
  }

  const validateApplicationId = (applicationId: string): { isValid: boolean; error?: string } => {
    if (!applicationId || applicationId.trim() === '') {
      return { isValid: false, error: 'Application ID cannot be empty.' }
    }

    const trimmedApplicationId = applicationId.trim()

    // YARN application IDs follow the format application_XXXXXXXXXXXXX_XXXX
    if (!/^application_\d{13}_\d{4}$/.test(trimmedApplicationId)) {
      return { 
        isValid: false, 
        error: `Invalid YARN application ID format. Application IDs must follow the pattern: application_XXXXXXXXXXXXX_XXXX

Examples:
• application_1234567890123_0001
• application_1640995200000_0042

Current value: "${trimmedApplicationId}"` 
      }
    }

    return { isValid: true }
  }

  const validateStepName = (stepName: string): { isValid: boolean; error?: string } => {
    if (!stepName || stepName.trim() === '') {
      return { isValid: false, error: 'Step name cannot be empty.' }
    }

    const trimmedStepName = stepName.trim()

    // Check length (reasonable limit for step names)
    if (trimmedStepName.length > 256) {
      return { 
        isValid: false, 
        error: `Step name is too long. Maximum length is 256 characters.

Current length: ${trimmedStepName.length} characters` 
      }
    }

    // Check for invalid characters (basic validation)
    if (/[<>:"|?*\x00-\x1f]/.test(trimmedStepName)) {
      return { 
        isValid: false, 
        error: `Step name contains invalid characters. Avoid using: < > : " | ? * and control characters.

Current value: "${trimmedStepName}"` 
      }
    }

    return { isValid: true }
  }

  const validateJarPath = (jarPath: string): { isValid: boolean; error?: string } => {
    if (!jarPath || jarPath.trim() === '') {
      return { isValid: true } // JAR path is optional
    }

    const trimmedJarPath = jarPath.trim()

    // Check if it's a valid S3 path
    if (!trimmedJarPath.startsWith('s3://')) {
      return { 
        isValid: false, 
        error: `JAR path must be an S3 URL starting with 's3://'.

Examples:
• s3://my-bucket/jars/my-application.jar
• s3://emr-code/spark-jobs/data-processor.jar

Current value: "${trimmedJarPath}"` 
      }
    }

    // Check if it ends with .jar
    if (!trimmedJarPath.toLowerCase().endsWith('.jar')) {
      return { 
        isValid: false, 
        error: `JAR path must point to a .jar file.

Current value: "${trimmedJarPath}"` 
      }
    }

    // Basic S3 path validation
    const s3PathMatch = trimmedJarPath.match(/^s3:\/\/([a-z0-9.-]+)\/(.+)$/)
    if (!s3PathMatch) {
      return { 
        isValid: false, 
        error: `Invalid S3 path format. Must be: s3://bucket-name/path/to/file.jar

Current value: "${trimmedJarPath}"` 
      }
    }

    return { isValid: true }
  }

  const validateMainClass = (mainClass: string): { isValid: boolean; error?: string } => {
    if (!mainClass || mainClass.trim() === '') {
      return { isValid: true } // Main class is optional
    }

    const trimmedMainClass = mainClass.trim()

    // Check for valid Java class name format
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(trimmedMainClass)) {
      return { 
        isValid: false, 
        error: `Invalid Java class name format. Class names must follow Java naming conventions.

Examples:
• com.example.MyApplication
• org.apache.spark.examples.SparkPi
• MyMainClass

Current value: "${trimmedMainClass}"` 
      }
    }

    // Check length
    if (trimmedMainClass.length > 500) {
      return { 
        isValid: false, 
        error: `Main class name is too long. Maximum length is 500 characters.

Current length: ${trimmedMainClass.length} characters` 
      }
    }

    return { isValid: true }
  }

  const validateTimestamp = (timestamp: string, fieldName: string): { isValid: boolean; error?: string } => {
    if (!timestamp || timestamp.trim() === '') {
      return { isValid: true } // Timestamps are optional
    }

    const trimmedTimestamp = timestamp.trim()

    // Check if it's a valid number
    const timestampNumber = parseInt(trimmedTimestamp)
    if (isNaN(timestampNumber)) {
      return { 
        isValid: false, 
        error: `${fieldName} must be a valid Unix timestamp (number).

Current value: "${trimmedTimestamp}"` 
      }
    }

    // Check if it's a reasonable timestamp (not too far in the past or future)
    const now = Date.now()
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000)
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000)

    if (timestampNumber < oneYearAgo || timestampNumber > oneYearFromNow) {
      return { 
        isValid: false, 
        error: `${fieldName} seems unreasonable. Please use a Unix timestamp in milliseconds within the last year.

Current value: ${timestampNumber} (${new Date(timestampNumber).toISOString()})` 
      }
    }

    return { isValid: true }
  }

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    const currentOperation = data.config.operation || 'listClusters'
    setSelectedOperation(currentOperation)
    
    // Set form values from current config
    form.setFieldsValue({
      clusterId: data.config.clusterId || '',
      clusterName: data.config.clusterName || '',
      operation: currentOperation,
      stepName: data.config.stepName || '',
      jarPath: data.config.jarPath || '',
      mainClass: data.config.mainClass || '',
      arguments: data.config.arguments?.join('\n') || ''
    })
  }, [data.config, form])

  const handleOperationChange = useCallback((value: string) => {
    setSelectedOperation(value)
    // Clear fields that are not relevant for the selected operation
    if (value === 'listClusters') {
      form.setFieldsValue({
        stepName: '',
        jarPath: '',
        mainClass: '',
        arguments: ''
      })
    } else if (value === 'describeCluster') {
      form.setFieldsValue({
        clusterName: '',
        stepName: '',
        jarPath: '',
        mainClass: '',
        arguments: ''
      })
    } else if (value === 'addStep') {
      form.setFieldsValue({
        clusterName: ''
      })
    }
  }, [form])

  const getOperationAlert = () => {
    switch (selectedOperation) {
      case 'listClusters':
        return (
          <Alert
            message="List Clusters Operation"
            description="This will retrieve all EMR clusters in your account. You can optionally filter by cluster ID or name to narrow down the results."
            type="info"
            showIcon
            className="mb-4"
          />
        )
      case 'describeCluster':
        return (
          <Alert
            message="Describe Cluster Operation"
            description="This will get detailed information about a specific EMR cluster. Cluster ID is required for this operation."
            type="info"
            showIcon
            className="mb-4"
          />
        )
      case 'getYarnApplications':
        return (
          <Alert
            message="Get YARN Applications Operation"
            description="This will retrieve YARN applications from the Timeline Server. Requires a running cluster with public DNS access. The cluster must have Timeline Server enabled on port 8188."
            type="info"
            showIcon
            className="mb-4"
          />
        )
      case 'getYarnApplicationDetails':
        return (
          <Alert
            message="Get YARN Application Details Operation"
            description="This will retrieve detailed information about a specific YARN application from the Timeline Server. Requires cluster ID and application ID."
            type="info"
            showIcon
            className="mb-4"
          />
        )
      case 'addStep':
        return (
          <Alert
            message="Add Step Operation"
            description="This will submit a new processing job (step) to an existing EMR cluster. The cluster must be in WAITING state to accept new steps."
            type="warning"
            showIcon
            className="mb-4"
          />
        )
      default:
        return null
    }
  }

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate cluster ID if provided
      if (values.clusterId) {
        const clusterIdValidation = validateClusterId(values.clusterId)
        if (!clusterIdValidation.isValid) {
          showErrorModal(`Cluster ID Validation Error:\n\n${clusterIdValidation.error}`)
          return
        }
      }

      // Validate application ID if provided (for YARN application details)
      if (values.applicationId) {
        const applicationIdValidation = validateApplicationId(values.applicationId)
        if (!applicationIdValidation.isValid) {
          showErrorModal(`Application ID Validation Error:\n\n${applicationIdValidation.error}`)
          return
        }
      }

      // Validate step name if provided
      if (values.stepName) {
        const stepNameValidation = validateStepName(values.stepName)
        if (!stepNameValidation.isValid) {
          showErrorModal(`Step Name Validation Error:\n\n${stepNameValidation.error}`)
          return
        }
      }

      // Validate JAR path if provided
      if (values.jarPath) {
        const jarPathValidation = validateJarPath(values.jarPath)
        if (!jarPathValidation.isValid) {
          showErrorModal(`JAR Path Validation Error:\n\n${jarPathValidation.error}`)
          return
        }
      }

      // Validate main class if provided
      if (values.mainClass) {
        const mainClassValidation = validateMainClass(values.mainClass)
        if (!mainClassValidation.isValid) {
          showErrorModal(`Main Class Validation Error:\n\n${mainClassValidation.error}`)
          return
        }
      }

      // Validate timestamps if provided
      if (values.windowStart) {
        const windowStartValidation = validateTimestamp(values.windowStart, 'Window Start')
        if (!windowStartValidation.isValid) {
          showErrorModal(`Window Start Validation Error:\n\n${windowStartValidation.error}`)
          return
        }
      }

      if (values.windowEnd) {
        const windowEndValidation = validateTimestamp(values.windowEnd, 'Window End')
        if (!windowEndValidation.isValid) {
          showErrorModal(`Window End Validation Error:\n\n${windowEndValidation.error}`)
          return
        }
      }

      // Validate window start is before window end
      if (values.windowStart && values.windowEnd) {
        const startTime = parseInt(values.windowStart)
        const endTime = parseInt(values.windowEnd)
        if (!isNaN(startTime) && !isNaN(endTime) && startTime >= endTime) {
          showErrorModal('Time Window Validation Error:\n\nWindow Start time must be before Window End time.')
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        clusterId: values.clusterId,
        clusterName: values.clusterName,
        operation: values.operation,
        stepName: values.stepName,
        jarPath: values.jarPath,
        mainClass: values.mainClass,
        arguments: values.arguments ? values.arguments.split('\n').filter((arg: string) => arg.trim()) : []
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('EMR configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal, validateClusterId, validateApplicationId, validateStepName, validateJarPath, validateMainClass, validateTimestamp])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    if (!data.config.operation) {
      message.warning('Please configure operation first')
      return
    }

    const startTime = Date.now()

    try {
      let requestBody: any = {
        accountId: 'dev-account-1', // This should come from selected account
        operation: data.config.operation
      }

      // Add operation-specific parameters
      if (data.config.operation === 'listClusters') {
        if (data.config.clusterId) {
          requestBody.clusterId = data.config.clusterId
        }
        if (data.config.clusterName) {
          requestBody.clusterName = data.config.clusterName
        }
      } else if (data.config.operation === 'describeCluster') {
        if (!data.config.clusterId) {
          message.warning('Cluster ID is required for describe operation')
          return
        }
        requestBody.clusterId = data.config.clusterId
      } else if (data.config.operation === 'getYarnApplications') {
        if (!data.config.clusterId) {
          message.warning('Cluster ID is required for YARN applications operation')
          return
        }
        requestBody.clusterId = data.config.clusterId
        // Add optional parameters from form
        const formValues = form.getFieldsValue()
        if (formValues.limit) requestBody.limit = parseInt(formValues.limit)
        if (formValues.windowStart) requestBody.windowStart = parseInt(formValues.windowStart)
        if (formValues.windowEnd) requestBody.windowEnd = parseInt(formValues.windowEnd)
      } else if (data.config.operation === 'getYarnApplicationDetails') {
        if (!data.config.clusterId) {
          message.warning('Cluster ID is required for YARN application details operation')
          return
        }
        const formValues = form.getFieldsValue()
        if (!formValues.applicationId) {
          message.warning('Application ID is required for YARN application details operation')
          return
        }
        requestBody.clusterId = data.config.clusterId
        requestBody.applicationId = formValues.applicationId
      } else if (data.config.operation === 'addStep') {
        if (!data.config.clusterId || !data.config.stepName) {
          message.warning('Cluster ID and Step Name are required for add step operation')
          return
        }
        requestBody.clusterId = data.config.clusterId
        requestBody.stepName = data.config.stepName
        requestBody.jarPath = data.config.jarPath
        requestBody.mainClass = data.config.mainClass
        requestBody.arguments = data.config.arguments
      }
      
      // Call backend API to execute EMR operation
      const response = await fetch('/api/aws/emr/clusters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `EMR ${data.config.operation} Results:\n`
        
        if (data.config.operation === 'listClusters') {
          const clusters = result.clusters || []
          output += `Total Clusters Found: ${clusters.length}\n\n`
          
          if (clusters.length > 0) {
            output += `Cluster Details:\n`
            output += `${'='.repeat(50)}\n`
            clusters.forEach((cluster: any) => {
              output += `Name: ${cluster.name || 'N/A'}\n`
              output += `ID: ${cluster.id || 'N/A'}\n`
              output += `State: ${cluster.state || 'N/A'}\n`
              output += `Created: ${cluster.creationDateTime || 'N/A'}\n`
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No clusters found`
            if (data.config.clusterId || data.config.clusterName) {
              output += ` matching the specified criteria`
            }
            output += `\n`
          }
        } else if (data.config.operation === 'describeCluster') {
          const cluster = result.cluster
          if (cluster) {
            output += `Cluster Name: ${cluster.name || 'N/A'}\n`
            output += `Cluster ID: ${cluster.id || 'N/A'}\n`
            output += `State: ${cluster.state || 'N/A'}\n`
            output += `Status: ${cluster.status?.state || 'N/A'}\n`
            output += `Created: ${cluster.status?.timeline?.creationDateTime || 'N/A'}\n`
            output += `Ready: ${cluster.status?.timeline?.readyDateTime || 'N/A'}\n`
            output += `Instance Count: ${cluster.instanceCollectionType || 'N/A'}\n`
            output += `Applications: ${cluster.applications?.map((app: any) => app.name).join(', ') || 'N/A'}\n`
          }
        } else if (data.config.operation === 'getYarnApplications') {
          const applications = result.applications || []
          output += `Total YARN Applications Found: ${applications.length}\n`
          output += `Cluster ID: ${result.clusterId}\n`
          output += `Master DNS: ${result.masterDns}\n`
          output += `Timeline Server URL: ${result.timelineServerUrl}\n\n`
          
          if (applications.length > 0) {
            output += `YARN Application Details:\n`
            output += `${'='.repeat(60)}\n`
            applications.forEach((app: any, index: number) => {
              output += `${index + 1}. Application ID: ${app.id || 'N/A'}\n`
              output += `   Type: ${app.type || 'N/A'}\n`
              output += `   Start Time: ${app.startTime || 'N/A'}\n`
              output += `   Events: ${app.events?.length || 0} events\n`
              if (app.events && app.events.length > 0) {
                output += `   Latest Event: ${app.events[0]?.eventType || 'N/A'}\n`
              }
              output += `   ${'-'.repeat(40)}\n`
            })
          } else {
            output += `No YARN applications found for this cluster.\n`
            output += `This could mean:\n`
            output += `- No applications have been submitted\n`
            output += `- Timeline Server is not accessible\n`
            output += `- Applications are outside the specified time window\n`
          }
        } else if (data.config.operation === 'getYarnApplicationDetails') {
          const application = result.application
          output += `YARN Application Details:\n`
          output += `Cluster ID: ${result.clusterId}\n`
          output += `Application ID: ${result.applicationId}\n\n`
          
          if (application) {
            output += `Application Information:\n`
            output += `${'='.repeat(50)}\n`
            output += `Entity: ${application.entity || 'N/A'}\n`
            output += `Type: ${application.entitytype || 'N/A'}\n`
            output += `Start Time: ${application.starttime ? new Date(application.starttime).toISOString() : 'N/A'}\n`
            
            if (application.events && application.events.length > 0) {
              output += `\nEvents (${application.events.length}):\n`
              application.events.slice(0, 5).forEach((event: any, index: number) => {
                output += `${index + 1}. ${event.eventtype} at ${event.timestamp ? new Date(event.timestamp).toISOString() : 'N/A'}\n`
              })
              if (application.events.length > 5) {
                output += `... and ${application.events.length - 5} more events\n`
              }
            }
            
            if (application.otherinfo) {
              output += `\nOther Information:\n`
              Object.entries(application.otherinfo).slice(0, 10).forEach(([key, value]) => {
                output += `${key}: ${value}\n`
              })
            }
          } else {
            output += `No application details found.\n`
          }
        } else if (data.config.operation === 'addStep') {
          output += `Step Added Successfully\n`
          output += `Step ID: ${result.stepId || 'N/A'}\n`
          output += `Cluster ID: ${data.config.clusterId}\n`
          output += `Step Name: ${data.config.stepName}\n`
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

        message.success(`EMR ${data.config.operation} completed successfully`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `EMR ${data.config.operation} failed: ${result.message || 'Unknown error'}`,
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
        output: `EMR operation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute EMR operation')
    }
  }, [data.config, id, onNodeExecute])

  return (
    <>
      <div className={`aws-node node-emr ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <EMRIcon className="aws-node-icon" size={20} />
          <span>EMR</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          {data.config.operation ? (
            <div className="text-xs mb-1">
              <strong>Operation:</strong> {data.config.operation}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No operation configured</div>
          )}
          
          {data.config.clusterId ? (
            <div className="text-xs mb-1">
              <strong>Cluster ID:</strong> {data.config.clusterId}
            </div>
          ) : data.config.clusterName ? (
            <div className="text-xs mb-1">
              <strong>Cluster Name:</strong> {data.config.clusterName}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No cluster specified</div>
          )}
          
          {data.config.stepName && (
            <div className="text-xs mb-1">
              <strong>Step:</strong> {data.config.stepName}
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
        title="Configure EMR Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            operation: 'listClusters',
            clusterId: '',
            clusterName: '',
            stepName: '',
            jarPath: '',
            mainClass: '',
            arguments: ''
          }}
        >
          <Form.Item
            label="Operation"
            name="operation"
            rules={[{ required: true, message: 'Please select an operation' }]}
            help="Choose the EMR operation to perform"
          >
            <Select placeholder="Select operation" onChange={handleOperationChange}>
              <Option value="listClusters">List Clusters</Option>
              <Option value="describeCluster">Describe Cluster</Option>
              <Option value="getYarnApplications">Get YARN Applications</Option>
              <Option value="getYarnApplicationDetails">Get YARN Application Details</Option>
              <Option value="addStep">Add Step</Option>
            </Select>
          </Form.Item>

          {getOperationAlert()}

          {/* Cluster ID - Required for describe, addStep, and YARN operations */}
          {(selectedOperation === 'describeCluster' || selectedOperation === 'addStep' || selectedOperation === 'getYarnApplications' || selectedOperation === 'getYarnApplicationDetails') && (
            <Form.Item
              label="Cluster ID"
              name="clusterId"
              rules={[{ required: true, message: 'Cluster ID is required for this operation' }]}
              help="Enter the EMR cluster ID (format: j-XXXXXXXXXXXXX)"
            >
              <Input placeholder="j-1234567890ABC" />
            </Form.Item>
          )}

          {/* Application ID - Required for getYarnApplicationDetails */}
          {selectedOperation === 'getYarnApplicationDetails' && (
            <Form.Item
              label="Application ID"
              name="applicationId"
              rules={[{ required: true, message: 'Application ID is required for this operation' }]}
              help="Enter the YARN application ID (format: application_XXXXXXXXXXXXX_XXXX)"
            >
              <Input placeholder="application_1234567890123_0001" />
            </Form.Item>
          )}

          {/* YARN Timeline Server Options - For getYarnApplications */}
          {selectedOperation === 'getYarnApplications' && (
            <>
              <Form.Item
                label="Limit (Optional)"
                name="limit"
                help="Maximum number of applications to retrieve (default: 100)"
              >
                <Input type="number" placeholder="100" />
              </Form.Item>
              
              <Form.Item
                label="Window Start (Optional)"
                name="windowStart"
                help="Start time for application window (Unix timestamp in milliseconds)"
              >
                <Input placeholder="1640995200000" />
              </Form.Item>
              
              <Form.Item
                label="Window End (Optional)"
                name="windowEnd"
                help="End time for application window (Unix timestamp in milliseconds)"
              >
                <Input placeholder="1641081600000" />
              </Form.Item>
            </>
          )}

          {/* Cluster Name - Optional for listClusters */}
          {selectedOperation === 'listClusters' && (
            <>
              <Form.Item
                label="Cluster ID (Optional)"
                name="clusterId"
                help="Filter clusters by ID (partial match supported)"
              >
                <Input placeholder="j-1234567890ABC" />
              </Form.Item>
              
              <Form.Item
                label="Cluster Name (Optional)"
                name="clusterName"
                help="Filter clusters by name (partial match supported)"
              >
                <Input placeholder="my-emr-cluster" />
              </Form.Item>
            </>
          )}

          {/* Step configuration - Only for addStep */}
          {selectedOperation === 'addStep' && (
            <>
              <Form.Item
                label="Step Name"
                name="stepName"
                rules={[{ required: true, message: 'Step name is required' }]}
                help="A descriptive name for your processing step"
              >
                <Input placeholder="Data Processing Job" />
              </Form.Item>

              <Form.Item
                label="JAR Path"
                name="jarPath"
                help="S3 path to your application JAR file (optional for some step types)"
              >
                <Input placeholder="s3://my-bucket/spark-jobs/my-application.jar" />
              </Form.Item>

              <Form.Item
                label="Main Class"
                name="mainClass"
                help="The main class to execute (e.g., com.mycompany.MySparkApp)"
              >
                <Input placeholder="com.example.DataProcessor" />
              </Form.Item>

              <Form.Item
                label="Arguments"
                name="arguments"
                help="Command-line arguments for your application (one per line)"
              >
                <TextArea 
                  rows={4} 
                  placeholder={`--input\ns3://data-bucket/input/\n--output\ns3://results-bucket/output/\n--format\nparquet`}
                />
              </Form.Item>
            </>
          )}
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

EMRNode.displayName = 'EMRNode'

export default EMRNode
