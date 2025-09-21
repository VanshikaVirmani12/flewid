import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Button, 
  Tag, 
  Space,
  Typography,
  Empty
} from 'antd'
import { 
  PlayCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface Workflow {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'archived'
  lastRun?: string
  totalRuns: number
  successRate: number
  createdAt: string
}

interface Execution {
  id: string
  workflowId: string
  workflowName: string
  status: 'running' | 'success' | 'failed'
  startTime: string
  duration?: number
  nodeCount: number
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - replace with API calls
    const mockWorkflows: Workflow[] = [
      {
        id: '1',
        name: 'Lambda Error Investigation',
        description: 'Trace Lambda errors across CloudWatch and DynamoDB',
        status: 'active',
        lastRun: '2024-01-15T10:30:00Z',
        totalRuns: 45,
        successRate: 95.6,
        createdAt: '2024-01-10T09:00:00Z'
      },
      {
        id: '2',
        name: 'API Gateway Debug Flow',
        description: 'Debug API Gateway issues with request tracing',
        status: 'active',
        lastRun: '2024-01-15T08:15:00Z',
        totalRuns: 23,
        successRate: 87.0,
        createdAt: '2024-01-12T14:30:00Z'
      },
      {
        id: '3',
        name: 'S3 Access Investigation',
        description: 'Investigate S3 access patterns and errors',
        status: 'draft',
        totalRuns: 0,
        successRate: 0,
        createdAt: '2024-01-14T16:45:00Z'
      }
    ]

    const mockExecutions: Execution[] = [
      {
        id: 'exec-1',
        workflowId: '1',
        workflowName: 'Lambda Error Investigation',
        status: 'success',
        startTime: '2024-01-15T10:30:00Z',
        duration: 45,
        nodeCount: 5
      },
      {
        id: 'exec-2',
        workflowId: '2',
        workflowName: 'API Gateway Debug Flow',
        status: 'running',
        startTime: '2024-01-15T10:45:00Z',
        nodeCount: 3
      },
      {
        id: 'exec-3',
        workflowId: '1',
        workflowName: 'Lambda Error Investigation',
        status: 'failed',
        startTime: '2024-01-15T09:15:00Z',
        duration: 23,
        nodeCount: 5
      }
    ]

    setWorkflows(mockWorkflows)
    setExecutions(mockExecutions)
    setLoading(false)
  }, [])

  const workflowColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Workflow) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.description}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          active: 'green',
          draft: 'orange',
          archived: 'gray'
        }
        return <Tag color={colors[status as keyof typeof colors]}>{status.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (date: string) => date ? dayjs(date).format('MMM D, YYYY HH:mm') : 'Never',
    },
    {
      title: 'Success Rate',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => `${rate}%`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Workflow) => (
        <Space>
          <Button 
            type="text" 
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunWorkflow(record.id)}
          >
            Run
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />}
            onClick={() => navigate(`/builder/${record.id}`)}
          >
            Edit
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteWorkflow(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ]

  const executionColumns = [
    {
      title: 'Workflow',
      dataIndex: 'workflowName',
      key: 'workflowName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = {
          running: { color: 'blue', icon: <ClockCircleOutlined /> },
          success: { color: 'green', icon: <CheckCircleOutlined /> },
          failed: { color: 'red', icon: <ExclamationCircleOutlined /> }
        }
        const { color, icon } = config[status as keyof typeof config]
        return (
          <Tag color={color} icon={icon}>
            {status.toUpperCase()}
          </Tag>
        )
      },
    },
    {
      title: 'Started',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (date: string) => dayjs(date).format('MMM D, HH:mm'),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => duration ? `${duration}s` : 'Running...',
    },
    {
      title: 'Nodes',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
    },
  ]

  const handleRunWorkflow = (workflowId: string) => {
    console.log('Running workflow:', workflowId)
    // Implement workflow execution
  }

  const handleDeleteWorkflow = (workflowId: string) => {
    console.log('Deleting workflow:', workflowId)
    // Implement workflow deletion
  }

  const stats = {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter(w => w.status === 'active').length,
    totalExecutions: executions.length,
    runningExecutions: executions.filter(e => e.status === 'running').length
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title level={2}>Dashboard</Title>
        <Text type="secondary">
          Monitor your AWS debugging workflows and execution history
        </Text>
      </div>

      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Workflows"
              value={stats.totalWorkflows}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Workflows"
              value={stats.activeWorkflows}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Executions"
              value={stats.totalExecutions}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Running Now"
              value={stats.runningExecutions}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Workflows Table */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={4}>Workflows</Title>
          <Button 
            type="primary" 
            onClick={() => navigate('/builder')}
          >
            Create Workflow
          </Button>
        </div>
        {workflows.length > 0 ? (
          <Table
            columns={workflowColumns}
            dataSource={workflows}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty 
            description="No workflows created yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => navigate('/builder')}>
              Create Your First Workflow
            </Button>
          </Empty>
        )}
      </Card>

      {/* Recent Executions */}
      <Card>
        <Title level={4}>Recent Executions</Title>
        {executions.length > 0 ? (
          <Table
            columns={executionColumns}
            dataSource={executions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 5 }}
          />
        ) : (
          <Empty 
            description="No executions yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </div>
  )
}

export default Dashboard
