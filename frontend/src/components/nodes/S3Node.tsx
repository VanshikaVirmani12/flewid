import React, { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Modal, Form, Input, Button, message, Alert } from 'antd'
import S3Icon from '../icons/S3Icon'

interface S3NodeData {
  label: string
  config: {
    s3Location?: string
  }
}

interface S3NodeProps {
  data: S3NodeData
  selected: boolean
  id: string
  onConfigUpdate?: (nodeId: string, config: any) => void
  onNodeExecute?: (result: any) => void
}

const S3Node: React.FC<S3NodeProps> = memo(({ data, selected, id, onConfigUpdate, onNodeExecute }) => {
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

  const validateS3Location = (s3Location: string): { isValid: boolean; error?: string } => {
    if (!s3Location || s3Location.trim() === '') {
      return { isValid: false, error: 'S3 location cannot be empty.' }
    }

    const trimmedLocation = s3Location.trim()

    // Check for valid S3 bucket name format (basic validation)
    const bucketMatch = trimmedLocation.match(/^([a-z0-9.-]+)(\/.*)?$/)
    if (!bucketMatch) {
      return { 
        isValid: false, 
        error: `Invalid S3 location format. S3 locations should follow the pattern: bucket-name/path/to/object

Examples:
• my-bucket/
• my-data-bucket/logs/2024/
• company-files/documents/report.pdf

Current value: "${trimmedLocation}"` 
      }
    }

    const [, bucketName, path] = bucketMatch

    // Validate bucket name according to S3 naming rules
    if (bucketName.length < 3 || bucketName.length > 63) {
      return { 
        isValid: false, 
        error: `S3 bucket name must be between 3 and 63 characters long.

Current bucket name: "${bucketName}" (${bucketName.length} characters)` 
      }
    }

    // Check for valid bucket name characters
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      return { 
        isValid: false, 
        error: `S3 bucket name contains invalid characters. Bucket names can only contain lowercase letters, numbers, hyphens (-), and periods (.).

Current bucket name: "${bucketName}"` 
      }
    }

    // Check for consecutive periods or hyphens
    if (bucketName.includes('..') || bucketName.includes('--')) {
      return { 
        isValid: false, 
        error: `S3 bucket name cannot contain consecutive periods (..) or hyphens (--).

Current bucket name: "${bucketName}"` 
      }
    }

    // Check if bucket name starts or ends with period or hyphen
    if (bucketName.startsWith('.') || bucketName.endsWith('.') || bucketName.startsWith('-') || bucketName.endsWith('-')) {
      return { 
        isValid: false, 
        error: `S3 bucket name cannot start or end with a period (.) or hyphen (-).

Current bucket name: "${bucketName}"` 
      }
    }

    // Check if bucket name looks like an IP address
    const ipPattern = /^\d+\.\d+\.\d+\.\d+$/
    if (ipPattern.test(bucketName)) {
      return { 
        isValid: false, 
        error: `S3 bucket name cannot be formatted as an IP address.

Current bucket name: "${bucketName}"` 
      }
    }

    // Validate path if present
    if (path && path.length > 1) {
      const pathPart = path.substring(1) // Remove leading slash
      
      // Check for invalid characters in path
      if (/[<>:"|?*\x00-\x1f]/.test(pathPart)) {
        return { 
          isValid: false, 
          error: `S3 object path contains invalid characters. Avoid using: < > : " | ? * and control characters.

Current path: "${pathPart}"` 
        }
      }

      // Check path length (S3 key names can be up to 1024 characters)
      if (pathPart.length > 1024) {
        return { 
          isValid: false, 
          error: `S3 object path is too long. Maximum length is 1024 characters.

Current path length: ${pathPart.length} characters` 
        }
      }
    }

    return { isValid: true }
  }

  const handleConfigClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfigModalVisible(true)
    
    // Set form values from current config
    form.setFieldsValue({
      s3Location: data.config.s3Location || ''
    })
  }, [data.config, form])

  const handleConfigSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // Validate S3 location
      if (values.s3Location) {
        const s3LocationValidation = validateS3Location(values.s3Location)
        if (!s3LocationValidation.isValid) {
          showErrorModal(`S3 Location Validation Error:\n\n${s3LocationValidation.error}`)
          return
        }
      }
      
      // Update node data with new configuration
      const newConfig = {
        s3Location: values.s3Location
      }

      // Call the parent component's config update handler
      if (onConfigUpdate) {
        onConfigUpdate(id, newConfig)
      }
      
      setIsConfigModalVisible(false)
      message.success('S3 configuration updated')
    } catch (error) {
      showErrorModal('Failed to save configuration. Please check your inputs and try again.')
    }
  }, [form, onConfigUpdate, id, showErrorModal, validateS3Location])

  const handleExecute = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Close any existing error modal when starting a new execution
    if (isErrorModalVisible) {
      setIsErrorModalVisible(false)
      setErrorMessage('')
    }
    
    if (!data.config.s3Location) {
      message.warning('Please configure S3 location first')
      return
    }

    const startTime = Date.now()

    try {
      const requestBody = {
        accountId: 'dev-account-1', // This should come from selected account
        s3Location: data.config.s3Location
      }
      
      // Call backend API to execute S3 operation
      const response = await fetch('/api/aws/s3/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `S3 Exploration Results:\n`
        output += `Location: ${data.config.s3Location}\n`
        output += `Type: ${result.type}\n\n`
        
        if (result.type === 'folder') {
          const items = result.items || []
          output += `Contents (${items.length} items):\n`
          output += `${'='.repeat(50)}\n`
          
          if (items.length > 0) {
            items.forEach((item: any) => {
              if (item.type === 'folder') {
                output += `📁 ${item.name}/\n`
              } else {
                output += `📄 ${item.name}\n`
                output += `   Size: ${item.size ? formatBytes(item.size) : 'N/A'}\n`
                output += `   Modified: ${item.lastModified || 'N/A'}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No items found in this folder\n`
          }
        } else if (result.type === 'object') {
          const object = result.object
          output += `Object Details:\n`
          output += `${'='.repeat(50)}\n`
          output += `Key: ${object.key || 'N/A'}\n`
          output += `Size: ${object.size ? formatBytes(object.size) : 'N/A'}\n`
          output += `Last Modified: ${object.lastModified || 'N/A'}\n`
          output += `ETag: ${object.etag || 'N/A'}\n`
          output += `Storage Class: ${object.storageClass || 'N/A'}\n`
          if (object.metadata && Object.keys(object.metadata).length > 0) {
            output += `\nMetadata:\n`
            Object.entries(object.metadata).forEach(([key, value]) => {
              output += `  ${key}: ${value}\n`
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

        message.success(`S3 exploration completed successfully`)
      } else {
        const executionResult = {
          nodeId: id,
          status: 'error' as const,
          output: `S3 exploration failed: ${result.message || 'Unknown error'}`,
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
        output: `S3 operation error: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      // Add result to execution panel
      if (onNodeExecute) {
        onNodeExecute(executionResult)
      }

      message.error('Failed to execute S3 operation')
    }
  }, [data.config, id, onNodeExecute, isErrorModalVisible])

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <div className={`aws-node node-s3 ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />
        
        <div className="aws-node-header">
          <S3Icon className="aws-node-icon" size={20} />
          <span>S3</span>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleConfigClick}
            className="ml-auto"
          />
        </div>
        
        <div className="aws-node-content">
          {data.config.s3Location ? (
            <div className="text-xs mb-1">
              <strong>Location:</strong> 
              <div className="break-words whitespace-normal mt-1">
                s3://{data.config.s3Location}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-1">No S3 location configured</div>
          )}

          <Button
            type="primary"
            size="small"
            onClick={handleExecute}
            disabled={!data.config.s3Location}
            className="w-full"
          >
            Explore
          </Button>
        </div>
        
        <Handle type="source" position={Position.Bottom} />
      </div>

      <Modal
        title="Configure S3 Node"
        open={isConfigModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setIsConfigModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            s3Location: ''
          }}
        >
          <Alert
            message="S3 Location Explorer"
            description="Enter an S3 location to explore. If it's a folder (bucket or prefix), it will list the contents. If it's an object, it will show object details."
            type="info"
            showIcon
            className="mb-4"
          />

          <Form.Item
            label="S3 Location"
            name="s3Location"
            rules={[{ required: true, message: 'Please enter an S3 location' }]}
            help="Examples: 'my-bucket/', 'my-bucket/folder/', 'my-bucket/file.txt'"
          >
            <Input 
              placeholder="my-bucket/path/to/folder/" 
              addonBefore="s3://"
            />
          </Form.Item>

          <Alert
            message="Location Format Examples"
            description={
              <div>
                <div><strong>Bucket root:</strong> my-bucket/</div>
                <div><strong>Folder:</strong> my-bucket/logs/2024/</div>
                <div><strong>Object:</strong> my-bucket/data/file.csv</div>
              </div>
            }
            type="info"
            className="mt-2"
          />
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

S3Node.displayName = 'S3Node'

export default S3Node
