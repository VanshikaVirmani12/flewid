import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { CloudOutlined } from '@ant-design/icons'

interface CloudWatchNodeData {
  label: string
  config: {
    logGroup?: string
    query?: string
    timeRange?: string
  }
}

interface CloudWatchNodeProps {
  data: CloudWatchNodeData
  selected: boolean
}

const CloudWatchNode: React.FC<CloudWatchNodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-cloudwatch ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <CloudOutlined className="aws-node-icon" />
        CloudWatch
      </div>
      
      <div className="aws-node-content">
        {data.config.logGroup && (
          <div>Log Group: {data.config.logGroup}</div>
        )}
        {data.config.query && (
          <div>Query: {data.config.query.substring(0, 30)}...</div>
        )}
        {data.config.timeRange && (
          <div>Time Range: {data.config.timeRange}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

CloudWatchNode.displayName = 'CloudWatchNode'

export default CloudWatchNode
