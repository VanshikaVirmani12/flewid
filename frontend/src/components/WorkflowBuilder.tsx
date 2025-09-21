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

// Define custom node types with config update handler
const createNodeTypes = (
  onConfigUpdate: (nodeId: string, config: any) => void,
  onNodeExecute: (result: any) => void
) => {
  // Create a stable wrapper component
  const CloudWatchNodeWrapper = React.memo((props: any) => {
    console.log('CloudWatchNodeWrapper rendering with props:', props)
    return <CloudWatchNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  return {
    cloudwatch: CloudWatchNodeWrapper,
    dynamodb: DynamoDBNode,
    s3: S3Node,
    lambda: LambdaNode,
    condition: ConditionNode,
    transform: TransformNode,
  }
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

  // Handle node configuration updates
  const handleNodeConfigUpdate = useCallback((nodeId: string, config: any) => {
    console.log('WorkflowBuilder - handleNodeConfigUpdate called:', { nodeId, config })
    setNodes((nds) => {
      const updatedNodes = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config } }
          : node
      )
      console.log('WorkflowBuilder - updated nodes:', updatedNodes)
      return updatedNodes
    })
  }, [setNodes])

  // Handle individual node execution results
  const handleNodeExecute = useCallback((result: any) => {
    console.log('WorkflowBuilder - handleNodeExecute called:', result)
    setExecutionResults(prev => [...prev, result])
  }, [])

  // Create node types with config update handler - memoized to prevent recreation
  const nodeTypes = React.useMemo(() => createNodeTypes(handleNodeConfigUpdate, handleNodeExecute), [handleNodeConfigUpdate, handleNodeExecute])

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

  const executeCloudWatchNode = async (node: Node) => {
    const config = node.data.config
    
    if (!config.logGroup || !config.keyword) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: 'CloudWatch node not properly configured. Please set log group and keyword.',
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const startTime = Date.now()
      
      const response = await fetch('/api/aws/cloudwatch/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'dev-account-1',
          logGroup: config.logGroup,
          filterPattern: config.keyword,
          startTime: config.startTime ? new Date(config.startTime).getTime() : Date.now() - 24 * 60 * 60 * 1000,
          endTime: config.endTime ? new Date(config.endTime).getTime() : Date.now()
        })
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        const events = result.events || []
        const summary = result.summary || {}
        
        let output = `CloudWatch Query Results:\n`
        output += `Log Group: ${summary.logGroup || config.logGroup}\n`
        output += `Filter Pattern: ${summary.filterPattern || config.keyword}\n`
        output += `Time Range: ${summary.timeRange?.start || 'N/A'} to ${summary.timeRange?.end || 'N/A'}\n`
        output += `Total Events Found: ${events.length}\n\n`
        
        if (events.length > 0) {
          output += `Recent Log Entries:\n`
          output += `${'='.repeat(50)}\n`
          events.slice(0, 10).forEach((event: any, index: number) => {
            output += `[${event.timestamp}] ${event.logStream}\n`
            output += `${event.message}\n`
            output += `${'-'.repeat(30)}\n`
          })
          
          if (events.length > 10) {
            output += `... and ${events.length - 10} more entries\n`
          }
        } else {
          output += `No log entries found matching the filter pattern "${config.keyword}"\n`
        }

        return {
          nodeId: node.id,
          status: 'success' as const,
          output,
          duration,
          timestamp: new Date().toISOString(),
        }
      } else {
        return {
          nodeId: node.id,
          status: 'error' as const,
          output: `CloudWatch query failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: `CloudWatch query error: ${error.message}`,
        duration: 0,
        timestamp: new Date().toISOString(),
      }
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
      console.log('Executing workflow with nodes:', nodes)
      
      // Execute nodes sequentially (excluding the start node)
      const executableNodes = nodes.filter(node => node.id !== 'start')
      
      for (const node of executableNodes) {
        // Add running status
        setExecutionResults(prev => [...prev, {
          nodeId: node.id,
          status: 'running' as const,
          output: `Executing ${node.data.label}...`,
          duration: 0,
          timestamp: new Date().toISOString(),
        }])

        let result
        
        // Execute based on node type
        switch (node.type) {
          case 'cloudwatch':
            result = await executeCloudWatchNode(node)
            break
          default:
            // Mock execution for other node types
            await new Promise(resolve => setTimeout(resolve, 1000))
            result = {
              nodeId: node.id,
              status: Math.random() > 0.2 ? 'success' : 'error' as const,
              output: `Mock output for ${node.data.label}`,
              duration: Math.floor(Math.random() * 2000) + 500,
              timestamp: new Date().toISOString(),
            }
        }

        // Replace running status with actual result
        setExecutionResults(prev => 
          prev.map(r => r.nodeId === node.id && r.status === 'running' ? result : r)
        )

        // Small delay between nodes
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      message.success('Workflow execution completed!')
    } catch (error) {
      console.error('Workflow execution error:', error)
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
                <Background variant={'dots' as any} gap={12} size={1} />
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
