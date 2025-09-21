import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { FunctionOutlined } from '@ant-design/icons'

interface LambdaNodeData {
  label: string
  config: {
    functionName?: string
    payload?: string
    invocationType?: string
  }
}

interface LambdaNodeProps {
  data: LambdaNodeData
  selected: boolean
}

const LambdaNode: React.FC<LambdaNodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-lambda ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <FunctionOutlined className="aws-node-icon" />
        Lambda
      </div>
      
      <div className="aws-node-content">
        {data.config.functionName && (
          <div>Function: {data.config.functionName}</div>
        )}
        {data.config.invocationType && (
          <div>Type: {data.config.invocationType}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

LambdaNode.displayName = 'LambdaNode'

export default LambdaNode
