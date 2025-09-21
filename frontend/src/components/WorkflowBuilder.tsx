import React, { useState, useCallback, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow'
import { Layout, Button, Space, Input, message } from 'antd'
import { 
  SaveOutlined, 
  PlayCircleOutlined, 
  StopOutlined,
  SettingOutlined 
} from '@ant-design/icons'
import 'reactflow/dist/style.css'

import NodeSidebar from './NodeSidebar'
import ExecutionPanel from './ExecutionPanel'
import CloudWatchNode from './nodes/CloudWatchNode'
import DynamoDBNode from './nodes/DynamoDBNode'
import S3Node from './nodes/S3Node'
import LambdaNode from './nodes/LambdaNode'
import ConditionNode from './nodes/ConditionNode'
import TransformNode from './nodes/TransformNode'

const { Sider, Content } = Layout

// Define custom node types
const nodeTypes = {
  cloudwatch: CloudWatchNode,
  dynamodb: DynamoDBNode,
  s3: S3Node,
  lambda: LambdaNode,
  condition: ConditionNode,
  transform: TransformNode,
}

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    position: { x: 250, y: 25 },
    data: { label: 'Start' },
  },
]

const initialEdges: Edge[] = []

interface WorkflowBuilderProps {}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResults, setExecutionResults] = useState<any[]>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      const type = event.dataTransfer.getData('application/reactflow')

      if (typeof type === 'undefined' || !type || !reactFlowBounds || !reactFlowInstance) {
        return
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${type} node`,
          config: {},
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const handleSaveWorkflow = async () => {
    try {
      const workflow = {
        name: workflowName,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      }
      
      // TODO: Save to backend
      console.log('Saving workflow:', workflow)
      message.success('Workflow saved successfully!')
    } catch (error) {
      message.error('Failed to save workflow')
    }
  }

  const handleExecuteWorkflow = async () => {
    if (nodes.length <= 1) {
      message.warning('Please add some nodes to execute the workflow')
      return
    }

    setIsExecuting(true)
    setExecutionResults([])

    try {
      // TODO: Execute workflow via backend
      console.log('Executing workflow with nodes:', nodes)
      
      // Mock execution results
      const mockResults = nodes.map((node, index) => ({
        nodeId: node.id,
        status: Math.random() > 0.2 ? 'success' : 'error',
        output: `Mock output for ${node.data.label}`,
        duration: Math.floor(Math.random() * 5000) + 1000,
        timestamp: new Date().toISOString(),
      }))

      // Simulate async execution
      for (let i = 0; i < mockResults.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setExecutionResults(prev => [...prev, mockResults[i]])
      }

      message.success('Workflow execution completed!')
    } catch (error) {
      message.error('Workflow execution failed')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleStopExecution = () => {
    setIsExecuting(false)
    message.info('Workflow execution stopped')
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="font-medium"
            style={{ width: 300 }}
          />
        </div>
        
        <Space>
          <Button 
            icon={<SettingOutlined />}
            onClick={() => message.info('Workflow settings coming soon!')}
          >
            Settings
          </Button>
          <Button 
            icon={<SaveOutlined />}
            onClick={handleSaveWorkflow}
          >
            Save
          </Button>
          {isExecuting ? (
            <Button 
              danger
              icon={<StopOutlined />}
              onClick={handleStopExecution}
            >
              Stop
            </Button>
          ) : (
            <Button 
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteWorkflow}
            >
              Execute
            </Button>
          )}
        </Space>
      </div>

      {/* Main Content */}
      <Layout className="flex-1">
        {/* Node Sidebar */}
        <Sider width={280} className="bg-gray-50">
          <NodeSidebar />
        </Sider>

        {/* Flow Canvas */}
        <Content className="relative">
          <ReactFlowProvider>
            <div className="w-full h-full" ref={reactFlowWrapper}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                fitView
              >
                <Controls />
                <MiniMap />
                <Background variant="dots" gap={12} size={1} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        </Content>

        {/* Execution Panel */}
        <Sider width={320} className="bg-white">
          <ExecutionPanel 
            isExecuting={isExecuting}
            results={executionResults}
          />
        </Sider>
      </Layout>
    </div>
  )
}

export default WorkflowBuilder
