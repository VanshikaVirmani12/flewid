import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import DynamoDBIcon from '../icons/DynamoDBIcon'

interface DynamoDBNodeData {
  label: string
  config: {
    tableName?: string
    operation?: string
    key?: string
  }
}

interface DynamoDBNodeProps {
  data: DynamoDBNodeData
  selected: boolean
}

const DynamoDBNode: React.FC<DynamoDBNodeProps> = memo(({ data, selected }) => {
  return (
    <div className={`aws-node node-dynamodb ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="aws-node-header">
        <DynamoDBIcon className="aws-node-icon" size={20} />
        DynamoDB
      </div>
      
      <div className="aws-node-content">
        {data.config.tableName && (
          <div>Table: {data.config.tableName}</div>
        )}
        {data.config.operation && (
          <div>Operation: {data.config.operation}</div>
        )}
        {data.config.key && (
          <div>Key: {data.config.key}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

DynamoDBNode.displayName = 'DynamoDBNode'

export default DynamoDBNode
