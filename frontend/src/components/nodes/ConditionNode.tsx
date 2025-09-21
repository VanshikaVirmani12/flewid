import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { BranchesOutlined } from '@ant-design/icons'

interface ConditionNodeData {
  label: string
  config: {
    condition?: string
    operator?: string
    value?: string
  }
}

interface ConditionNodeProps {
  data: ConditionNodeData
  selected: boolean
}

const ConditionNode: React.FC<ConditionNodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-condition ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <BranchesOutlined className="aws-node-icon" />
        Condition
      </div>
      
      <div className="aws-node-content">
        {data.config.condition && (
          <div>If: {data.config.condition}</div>
        )}
        {data.config.operator && data.config.value && (
          <div>{data.config.operator} {data.config.value}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} />
    </div>
  )
})

ConditionNode.displayName = 'ConditionNode'

export default ConditionNode
