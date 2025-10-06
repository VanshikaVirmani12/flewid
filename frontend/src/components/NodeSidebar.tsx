import React from 'react'
import { Typography, Divider } from 'antd'
import { 
  BranchesOutlined,
  SwapOutlined
} from '@ant-design/icons'
import CloudWatchIcon from './icons/CloudWatchIcon'
import DynamoDBIcon from './icons/DynamoDBIcon'
import S3Icon from './icons/S3Icon'
import LambdaIcon from './icons/LambdaIcon'
import EMRIcon from './icons/EMRIcon'
import APIGatewayIcon from './icons/APIGatewayIcon'
import SQSIcon from './icons/SQSIcon'

const { Title, Text } = Typography

interface NodeItemProps {
  type: string
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const NodeItem: React.FC<NodeItemProps> = ({ type, icon, title, description, color }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className="node-item"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className="node-item-icon" style={{ color }}>
        {icon}
      </div>
      <div className="node-item-content">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </div>
  )
}

const NodeSidebar: React.FC = () => {
  const awsNodes = [
    {
      type: 'cloudwatch',
      icon: <CloudWatchIcon size={20} />,
      title: 'CloudWatch',
      description: 'Query logs and metrics',
      color: 'inherit'
    },
    {
      type: 'dynamodb',
      icon: <DynamoDBIcon size={20} />,
      title: 'DynamoDB',
      description: 'Query database records',
      color: 'inherit'
    },
    {
      type: 's3',
      icon: <S3Icon size={20} />,
      title: 'S3',
      description: 'List and fetch objects',
      color: 'inherit'
    },
    {
      type: 'lambda',
      icon: <LambdaIcon size={20} />,
      title: 'Lambda',
      description: 'Invoke functions',
      color: 'inherit'
    },
    {
      type: 'emr',
      icon: <EMRIcon size={20} />,
      title: 'EMR',
      description: 'Run big data workloads',
      color: 'inherit'
    },
    {
      type: 'apigateway',
      icon: <APIGatewayIcon size={20} />,
      title: 'API Gateway',
      description: 'Analyze API access logs and performance',
      color: 'inherit'
    },
    {
      type: 'sqs',
      icon: <SQSIcon size={20} />,
      title: 'SQS',
      description: 'Send and receive messages',
      color: 'inherit'
    }
  ]

  const logicNodes = [
    {
      type: 'condition',
      icon: <BranchesOutlined />,
      title: 'Condition',
      description: 'Conditional branching',
      color: '#13c2c2'
    },
    {
      type: 'transform',
      icon: <SwapOutlined />,
      title: 'Transform',
      description: 'Data transformation',
      color: '#eb2f96'
    }
  ]

  return (
    <div className="node-sidebar">
      <div className="p-4">
        <Title level={4}>AWS Services</Title>
        <Text type="secondary">
          Drag and drop AWS service nodes to build your workflow
        </Text>
      </div>

      <div className="px-4">
        {awsNodes.map((node) => (
          <NodeItem
            key={node.type}
            type={node.type}
            icon={node.icon}
            title={node.title}
            description={node.description}
            color={node.color}
          />
        ))}
      </div>

      <Divider />

      <div className="px-4">
        <Title level={5}>Logic & Control</Title>
        {logicNodes.map((node) => (
          <NodeItem
            key={node.type}
            type={node.type}
            icon={node.icon}
            title={node.title}
            description={node.description}
            color={node.color}
          />
        ))}
      </div>

      <Divider />

      <div className="px-4 pb-4">
        <Title level={5}>Getting Started</Title>
        <Text type="secondary" className="text-xs">
          1. Drag nodes from the sidebar to the canvas<br/>
          2. Connect nodes by dragging from output to input handles<br/>
          3. Configure each node by clicking on it<br/>
          4. Save and execute your workflow
        </Text>
      </div>
    </div>
  )
}

export default NodeSidebar
