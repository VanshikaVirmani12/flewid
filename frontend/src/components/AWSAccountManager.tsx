import React, { useState, useEffect } from 'react'
import { Card, Button, Form, Input, Select, Table, Modal, message, Space, Tag, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Option } = Select

interface AWSAccount {
  id: string
  name: string
  roleArn: string
  externalId: string
  region: string
  status: 'active' | 'inactive' | 'error'
  createdAt: string
  lastUsed?: string
}

interface AWSAccountFormData {
  name: string
  roleArn: string
  externalId: string
  region: string
}

const AWSAccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<AWSAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AWSAccount | null>(null)
  const [isLocalMode, setIsLocalMode] = useState(false)
  const [form] = Form.useForm()

  const awsRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
    'ca-central-1', 'sa-east-1'
  ]

  useEffect(() => {
    fetchAccounts()
    checkLocalMode()
  }, [])

  const checkLocalMode = async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const data = await response.json()
        // Check if backend is in local development mode
        setIsLocalMode(data.localMode || false)
      }
    } catch (error) {
      // If we can't reach backend, assume local mode for development
      setIsLocalMode(true)
    }
  }

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      } else {
        message.error('Failed to fetch AWS accounts')
      }
    } catch (error) {
      message.error('Error fetching AWS accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: AWSAccountFormData) => {
    setLoading(true)
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        message.success(`AWS account ${editingAccount ? 'updated' : 'added'} successfully`)
        setModalVisible(false)
        form.resetFields()
        setEditingAccount(null)
        fetchAccounts()
      } else {
        const error = await response.json()
        message.error(error.message || 'Failed to save AWS account')
      }
    } catch (error) {
      message.error('Error saving AWS account')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (account: AWSAccount) => {
    setEditingAccount(account)
    form.setFieldsValue({
      name: account.name,
      roleArn: account.roleArn,
      externalId: account.externalId,
      region: account.region,
    })
    setModalVisible(true)
  }

  const handleDelete = (account: AWSAccount) => {
    Modal.confirm({
      title: 'Delete AWS Account',
      content: `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await fetch(`/api/accounts/${account.id}`, {
            method: 'DELETE',
          })

          if (response.ok) {
            message.success('AWS account deleted successfully')
            fetchAccounts()
          } else {
            const error = await response.json()
            message.error(error.message || 'Failed to delete AWS account')
          }
        } catch (error) {
          message.error('Error deleting AWS account')
        }
      },
    })
  }

  const testConnection = async (account: AWSAccount) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/accounts/${account.id}/test`, {
        method: 'POST',
      })

      if (response.ok) {
        message.success('Connection test successful')
        fetchAccounts() // Refresh to update status
      } else {
        const error = await response.json()
        message.error(error.message || 'Connection test failed')
      }
    } catch (error) {
      message.error('Error testing connection')
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
      case 'error':
        return <Tag color="red" icon={<ExclamationCircleOutlined />}>Error</Tag>
      default:
        return <Tag color="orange">Inactive</Tag>
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: AWSAccount) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-500">{record.region}</div>
        </div>
      ),
    },
    {
      title: 'Role ARN',
      dataIndex: 'roleArn',
      key: 'roleArn',
      render: (text: string) => (
        <Tooltip title={text}>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {text.length > 50 ? `${text.substring(0, 50)}...` : text}
          </code>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AWSAccount) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => testConnection(record)}
            loading={loading}
          >
            Test
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card
        title="AWS Account Management"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingAccount(null)
              form.resetFields()
              setModalVisible(true)
            }}
          >
            Add AWS Account
          </Button>
        }
      >
        {isLocalMode ? (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircleOutlined className="text-green-500 mt-1" />
              <div>
                <h4 className="font-medium text-green-900">Local Development Mode</h4>
                <p className="text-sm text-green-700 mt-1">
                  Using your local AWS CLI credentials. No IAM role setup required for development.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <InfoCircleOutlined className="text-blue-500 mt-1" />
              <div>
                <h4 className="font-medium text-blue-900">Security Setup Required</h4>
                <p className="text-sm text-blue-700 mt-1">
                  To connect your AWS account securely, you need to create an IAM role with cross-account access. 
                  <a 
                    href="/AWS_SECURITY_GUIDE.md" 
                    target="_blank" 
                    className="ml-1 text-blue-600 underline"
                  >
                    View setup guide
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: 'No AWS accounts configured. Add your first account to get started.',
          }}
        />
      </Card>

      <Modal
        title={editingAccount ? 'Edit AWS Account' : 'Add AWS Account'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setEditingAccount(null)
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Account Name"
            rules={[
              { required: true, message: 'Please enter an account name' },
              { min: 2, message: 'Name must be at least 2 characters' },
            ]}
          >
            <Input placeholder="e.g., Production AWS Account" />
          </Form.Item>

          {!isLocalMode && (
            <>
              <Form.Item
                name="roleArn"
                label="IAM Role ARN"
                rules={[
                  { required: true, message: 'Please enter the IAM role ARN' },
                  { 
                    pattern: /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/,
                    message: 'Please enter a valid IAM role ARN'
                  },
                ]}
              >
                <Input placeholder="arn:aws:iam::123456789012:role/FlowIdCrossAccountRole" />
              </Form.Item>

              <Form.Item
                name="externalId"
                label="External ID"
                rules={[
                  { required: true, message: 'Please enter the external ID' },
                  { min: 8, message: 'External ID must be at least 8 characters' },
                ]}
              >
                <Input placeholder="Unique external ID for security" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="region"
            label="Default Region"
            rules={[{ required: true, message: 'Please select a default region' }]}
          >
            <Select placeholder="Select AWS region">
              {awsRegions.map(region => (
                <Option key={region} value={region}>
                  {region}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {!isLocalMode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <ExclamationCircleOutlined className="text-yellow-600 mt-1" />
                <div>
                  <h5 className="font-medium text-yellow-800">Security Note</h5>
                  <p className="text-sm text-yellow-700 mt-1">
                    Ensure your IAM role has the minimum required permissions and uses a strong external ID. 
                    Never share these credentials or commit them to version control.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingAccount ? 'Update Account' : 'Add Account'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AWSAccountManager
