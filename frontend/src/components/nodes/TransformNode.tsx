import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { SwapOutlined } from '@ant-design/icons'

interface TransformNodeData {
  label: string
  config: {
    transformation?: string
    inputField?: string
    outputField?: string
  }
}

interface TransformNodeProps {
  data: TransformNodeData
  selected: boolean
}

const TransformNode: React.FC<TransformNodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-transform ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <SwapOutlined className="aws-node-icon" />
        Transform
      </div>
      
      <div className="aws-node-content">
        {data.config.transformation && (
          <div>Transform: {data.config.transformation}</div>
        )}
        {data.config.inputField && (
          <div>Input: {data.config.inputField}</div>
        )}
        {data.config.outputField && (
          <div>Output: {data.config.outputField}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

TransformNode.displayName = 'TransformNode'

export default TransformNode
