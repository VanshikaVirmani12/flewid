import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { InboxOutlined } from '@ant-design/icons'

interface S3NodeData {
  label: string
  config: {
    bucket?: string
    prefix?: string
    operation?: string
  }
}

interface S3NodeProps {
  data: S3NodeData
  selected: boolean
}

const S3Node: React.FC<S3NodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-s3 ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <InboxOutlined className="aws-node-icon" />
        S3
      </div>
      
      <div className="aws-node-content">
        {data.config.bucket && (
          <div>Bucket: {data.config.bucket}</div>
        )}
        {data.config.prefix && (
          <div>Prefix: {data.config.prefix}</div>
        )}
        {data.config.operation && (
          <div>Operation: {data.config.operation}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

S3Node.displayName = 'S3Node'

export default S3Node
