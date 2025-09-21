import React from 'react'
import { Typography, Card, Timeline, Tag, Empty, Spin } from 'antd'
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  ClockCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface ExecutionResult {
  nodeId: string
  status: 'success' | 'error' | 'running'
  output: string
  duration?: number
  timestamp: string
}

interface ExecutionPanelProps {
  isExecuting: boolean
  results: ExecutionResult[]
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ isExecuting, results }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      case 'running':
        return 'processing'
      default:
        return 'default'
    }
  }

  return (
    <div className="execution-panel">
      <div className="p-4 border-b border-gray-200">
        <Title level={4}>Execution Results</Title>
        {isExecuting && (
          <div className="flex items-center mt-2">
            <Spin size="small" className="mr-2" />
            <Text type="secondary">Workflow is running...</Text>
          </div>
        )}
      </div>

      <div className="p-4">
        {results.length === 0 && !isExecuting ? (
          <Empty 
            description="No execution results yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline>
            {results.map((result, index) => (
              <Timeline.Item
                key={`${result.nodeId}-${index}`}
                dot={getStatusIcon(result.status)}
              >
                <Card size="small" className="mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Text strong>{result.nodeId}</Text>
                    <Tag color={getStatusColor(result.status)}>
                      {result.status.toUpperCase()}
                    </Tag>
                  </div>
                  
                  <Text type="secondary" className="text-xs block mb-2">
                    {dayjs(result.timestamp).format('HH:mm:ss')}
                    {result.duration && ` • ${result.duration}ms`}
                  </Text>
                  
                  <div className="bg-gray-50 p-2 rounded text-xs">
                    <pre className="whitespace-pre-wrap m-0">
                      {result.output}
                    </pre>
                  </div>
                </Card>
              </Timeline.Item>
            ))}
            
            {isExecuting && (
              <Timeline.Item
                dot={<LoadingOutlined style={{ color: '#1890ff' }} />}
              >
                <Text type="secondary">Executing workflow...</Text>
              </Timeline.Item>
            )}
          </Timeline>
        )}
      </div>

      {results.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <Text type="secondary" className="text-xs block">Success</Text>
              <Text strong className="text-green-600">
                {results.filter(r => r.status === 'success').length}
              </Text>
            </div>
            <div>
              <Text type="secondary" className="text-xs block">Errors</Text>
              <Text strong className="text-red-600">
                {results.filter(r => r.status === 'error').length}
              </Text>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExecutionPanel
