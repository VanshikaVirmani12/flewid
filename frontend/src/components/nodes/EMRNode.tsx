import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined } from '@ant-design/icons'
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
  const [selectedOperation, setSelectedOperation] = useState('listClusters')
  const [form] = Form.useForm()

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
      message.error('Failed to save configuration')
    }
  }, [form, onConfigUpdate, id])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
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
              <Option value="addStep">Add Step</Option>
            </Select>
          </Form.Item>

          {getOperationAlert()}

          {/* Cluster ID - Required for describe and addStep */}
          {(selectedOperation === 'describeCluster' || selectedOperation === 'addStep') && (
            <Form.Item
              label="Cluster ID"
              name="clusterId"
              rules={[{ required: true, message: 'Cluster ID is required for this operation' }]}
              help="Enter the EMR cluster ID (format: j-XXXXXXXXXXXXX)"
            >
              <Input placeholder="j-1234567890ABC" />
            </Form.Item>
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
    </>
  )
})

EMRNode.displayName = 'EMRNode'

export default EMRNode
