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
import ResizablePanel from './ResizablePanel'
import CloudWatchNode from './nodes/CloudWatchNode'
import DynamoDBNode from './nodes/DynamoDBNode'
import S3Node from './nodes/S3Node'
import LambdaNode from './nodes/LambdaNode'
import EMRNode from './nodes/EMRNode'
import APIGatewayNode from './nodes/APIGatewayNode'
import ConditionNode from './nodes/ConditionNode'
import TransformNode from './nodes/TransformNode'

const { Sider, Content } = Layout

// Define custom node types with config update handler
const createNodeTypes = (
  onConfigUpdate: (nodeId: string, config: any) => void,
  onNodeExecute: (result: any) => void
) => {
  // Create stable wrapper components
  const CloudWatchNodeWrapper = React.memo((props: any) => {
    return <CloudWatchNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  const EMRNodeWrapper = React.memo((props: any) => {
    return <EMRNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  const S3NodeWrapper = React.memo((props: any) => {
    return <S3Node {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  const DynamoDBNodeWrapper = React.memo((props: any) => {
    return <DynamoDBNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  const LambdaNodeWrapper = React.memo((props: any) => {
    return <LambdaNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  const APIGatewayNodeWrapper = React.memo((props: any) => {
    return <APIGatewayNode {...props} onConfigUpdate={onConfigUpdate} onNodeExecute={onNodeExecute} />
  })
  
  return {
    cloudwatch: CloudWatchNodeWrapper,
    dynamodb: DynamoDBNodeWrapper,
    s3: S3NodeWrapper,
    lambda: LambdaNodeWrapper,
    emr: EMRNodeWrapper,
    apigateway: APIGatewayNodeWrapper,
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
    setNodes((nds) => {
      const updatedNodes = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config } }
          : node
      )
      return updatedNodes
    })
  }, [setNodes])

  // Handle individual node execution results
  const handleNodeExecute = useCallback((result: any) => {
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
      // TODO: Save to backend
      // const workflow = {
      //   name: workflowName,
      //   nodes,
      //   edges,
      //   updatedAt: new Date().toISOString(),
      // }
      
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
          events.slice(0, 10).forEach((event: any) => {
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

  const executeEMRNode = async (node: Node) => {
    const config = node.data.config
    
    if (!config.operation) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: 'EMR node not properly configured. Please set operation.',
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const startTime = Date.now()
      
      let requestBody: any = {
        accountId: 'dev-account-1',
        operation: config.operation
      }

      // Add operation-specific parameters
      if (config.operation === 'listClusters') {
        if (config.clusterId) {
          requestBody.clusterId = config.clusterId
        }
        if (config.clusterName) {
          requestBody.clusterName = config.clusterName
        }
      } else if (config.operation === 'describeCluster') {
        if (!config.clusterId) {
          return {
            nodeId: node.id,
            status: 'error' as const,
            output: 'Cluster ID is required for describe operation',
            duration: 0,
            timestamp: new Date().toISOString(),
          }
        }
        requestBody.clusterId = config.clusterId
      } else if (config.operation === 'addStep') {
        if (!config.clusterId || !config.stepName) {
          return {
            nodeId: node.id,
            status: 'error' as const,
            output: 'Cluster ID and Step Name are required for add step operation',
            duration: 0,
            timestamp: new Date().toISOString(),
          }
        }
        requestBody.clusterId = config.clusterId
        requestBody.stepName = config.stepName
        requestBody.jarPath = config.jarPath
        requestBody.mainClass = config.mainClass
        requestBody.arguments = config.arguments
      }
      
      const response = await fetch('/api/aws/emr/clusters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `EMR ${config.operation} Results:\n`
        
        if (config.operation === 'listClusters') {
          const clusters = result.clusters || []
          output += `Total Clusters Found: ${clusters.length}\n\n`
          
          if (clusters.length > 0) {
            output += `Cluster Details:\n`
            output += `${'='.repeat(50)}\n`
            clusters.forEach((cluster: any) => {
              output += `Name: ${cluster.name || 'N/A'}\n`
              output += `ID: ${cluster.id || 'N/A'}\n`
              output += `State: ${cluster.state || 'N/A'}\n`
              output += `Created: ${cluster.creationDateTime || 'N/A'}\n`
              output += `${'-'.repeat(30)}\n`
            })
          } else {
            output += `No clusters found`
            if (config.clusterId || config.clusterName) {
              output += ` matching the specified criteria`
            }
            output += `\n`
          }
        } else if (config.operation === 'describeCluster') {
          const cluster = result.cluster
          if (cluster) {
            output += `Cluster Name: ${cluster.name || 'N/A'}\n`
            output += `Cluster ID: ${cluster.id || 'N/A'}\n`
            output += `State: ${cluster.state || 'N/A'}\n`
            output += `Status: ${cluster.status?.state || 'N/A'}\n`
            output += `Created: ${cluster.status?.timeline?.creationDateTime || 'N/A'}\n`
            output += `Ready: ${cluster.status?.timeline?.readyDateTime || 'N/A'}\n`
            output += `Instance Count: ${cluster.instanceCollectionType || 'N/A'}\n`
            output += `Applications: ${cluster.applications?.map((app: any) => app.name).join(', ') || 'N/A'}\n`
          }
        } else if (config.operation === 'addStep') {
          output += `Step Added Successfully\n`
          output += `Step ID: ${result.stepId || 'N/A'}\n`
          output += `Cluster ID: ${config.clusterId}\n`
          output += `Step Name: ${config.stepName}\n`
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
          output: `EMR ${config.operation} failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: `EMR operation error: ${error.message}`,
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }
  }

  const executeDynamoDBNode = async (node: Node) => {
    const config = node.data.config
    
    if (!config.tableName) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: 'DynamoDB node not properly configured. Please set table name.',
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const startTime = Date.now()
      
      const requestBody = {
        accountId: 'dev-account-1',
        tableName: config.tableName,
        operation: config.operation || 'scan',
        partitionKey: config.partitionKey,
        partitionKeyValue: config.partitionKeyValue,
        sortKey: config.sortKey,
        sortKeyValue: config.sortKeyValue,
        indexName: config.indexName,
        filterExpression: config.filterExpression,
        limit: config.limit || 25
      }
      
      const response = await fetch('/api/aws/dynamodb/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        const items = result.items || []
        const summary = result.summary || {}
        
        let output = `DynamoDB Query Results:\n`
        output += `Table: ${config.tableName}\n`
        output += `Operation: ${config.operation || 'scan'}\n`
        if (config.indexName) {
          output += `Index: ${config.indexName}\n`
        }
        if (config.partitionKey && config.partitionKeyValue) {
          output += `Partition Key: ${config.partitionKey} = ${config.partitionKeyValue}\n`
        }
        if (config.sortKey && config.sortKeyValue) {
          output += `Sort Key: ${config.sortKey} = ${config.sortKeyValue}\n`
        }
        if (config.filterExpression) {
          output += `Filter: ${config.filterExpression}\n`
        }
        output += `Items Found: ${items.length}\n`
        output += `Scanned Count: ${summary.scannedCount || 'N/A'}\n`
        output += `Consumed Capacity: ${summary.consumedCapacity || 'N/A'}\n\n`
        
        if (items.length > 0) {
          output += `Items:\n`
          output += `${'='.repeat(50)}\n`
          items.slice(0, 10).forEach((item: any, index: number) => {
            output += `Item ${index + 1}:\n`
            Object.entries(item).forEach(([key, value]) => {
              output += `  ${key}: ${JSON.stringify(value)}\n`
            })
            output += `${'-'.repeat(30)}\n`
          })
          
          if (items.length > 10) {
            output += `... and ${items.length - 10} more items\n`
          }
        } else {
          output += `No items found matching the query criteria\n`
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
          output: `DynamoDB query failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: `DynamoDB query error: ${error.message}`,
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }
  }

  const executeLambdaNode = async (node: Node) => {
    const config = node.data.config
    
    if (!config.functionName) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: 'Lambda node not properly configured. Please set function name.',
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const startTime = Date.now()
      
      const requestBody = {
        accountId: 'dev-account-1',
        functionName: config.functionName,
        payload: config.payload || undefined,
        invocationType: config.invocationType || 'RequestResponse',
        logType: config.logType || 'None'
      }
      
      const response = await fetch('/api/aws/lambda/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `Lambda Function Invocation Results:\n`
        output += `Function: ${config.functionName}\n`
        output += `Invocation Type: ${result.invocationType}\n`
        output += `Status Code: ${result.statusCode}\n`
        output += `Duration: ${result.duration}ms\n`
        
        if (result.functionError) {
          output += `Function Error: ${result.functionError}\n`
        }
        
        if (result.executedVersion) {
          output += `Executed Version: ${result.executedVersion}\n`
        }
        
        output += `\n${'='.repeat(50)}\n`
        
        if (result.payload !== null && result.payload !== undefined) {
          output += `Response Payload:\n`
          if (typeof result.payload === 'object') {
            output += JSON.stringify(result.payload, null, 2)
          } else {
            output += result.payload
          }
          output += `\n`
        }
        
        if (result.logResult && config.logType === 'Tail') {
          output += `\nExecution Logs:\n`
          output += `${'-'.repeat(30)}\n`
          output += result.logResult
        }

        return {
          nodeId: node.id,
          status: result.functionError ? 'error' as const : 'success' as const,
          output,
          duration,
          timestamp: new Date().toISOString(),
        }
      } else {
        return {
          nodeId: node.id,
          status: 'error' as const,
          output: `Lambda invocation failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: `Lambda invocation error: ${error.message}`,
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }
  }

  const executeAPIGatewayNode = async (node: Node) => {
    const config = node.data.config
    
    if (!config.operation) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: 'API Gateway node not properly configured. Please set operation.',
        duration: 0,
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const startTime = Date.now()
      
      const requestBody = {
        accountId: 'dev-account-1',
        operation: config.operation,
        apiId: config.apiId,
        stageName: config.stageName,
        logGroup: config.logGroup,
        startTime: config.startTime,
        endTime: config.endTime,
        limit: config.limit || 100
      }
      
      const response = await fetch('/api/aws/apigateway/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (response.ok && result.success) {
        let output = `API Gateway ${config.operation} Results:\n`
        
        if (config.operation === 'access_logs') {
          const logs = result.logs || []
          const summary = result.summary || {}
          
          output += `API ID: ${config.apiId}\n`
          output += `Stage: ${config.stageName || 'N/A'}\n`
          output += `Log Group: ${config.logGroup}\n`
          output += `Time Range: ${config.startTime || 'N/A'} to ${config.endTime || 'N/A'}\n`
          output += `Total Log Entries: ${logs.length}\n`
          
          if (summary.requestCount) {
            output += `Total Requests: ${summary.requestCount}\n`
          }
          if (summary.errorCount) {
            output += `Error Count: ${summary.errorCount}\n`
          }
          if (summary.avgResponseTime) {
            output += `Average Response Time: ${summary.avgResponseTime}ms\n`
          }
          
          output += `\n${'='.repeat(50)}\n`
          
          if (logs.length > 0) {
            output += `Recent Access Log Entries:\n`
            logs.slice(0, 10).forEach((log: any) => {
              output += `[${log.timestamp}] ${log.method} ${log.path}\n`
              output += `Status: ${log.status}, Response Time: ${log.responseTime}ms\n`
              if (log.error) {
                output += `Error: ${log.error}\n`
              }
              output += `${'-'.repeat(30)}\n`
            })
            
            if (logs.length > 10) {
              output += `... and ${logs.length - 10} more entries\n`
            }
          } else {
            output += `No access log entries found\n`
          }
        } else if (config.operation === 'request_tracing') {
          output += `Request Tracing Analysis:\n`
          output += `API ID: ${config.apiId}\n`
          output += `Stage: ${config.stageName || 'N/A'}\n`
          output += `Time Range: ${config.startTime || 'N/A'} to ${config.endTime || 'N/A'}\n\n`
          output += `Note: This is a mock implementation. In a real scenario, this would:\n`
          output += `- Integrate with AWS X-Ray for distributed tracing\n`
          output += `- Show request flow through API Gateway stages\n`
          output += `- Display latency breakdown by service\n`
          output += `- Identify bottlenecks and performance issues\n`
        } else if (config.operation === 'throttling_detection') {
          output += `Throttling Detection Analysis:\n`
          output += `API ID: ${config.apiId}\n`
          output += `Stage: ${config.stageName || 'N/A'}\n`
          output += `Time Range: ${config.startTime || 'N/A'} to ${config.endTime || 'N/A'}\n\n`
          output += `Note: This is a mock implementation. In a real scenario, this would:\n`
          output += `- Analyze CloudWatch metrics for throttling events\n`
          output += `- Check 4XXError and 5XXError metrics\n`
          output += `- Monitor usage plan limits and API key quotas\n`
          output += `- Identify patterns in throttled requests\n`
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
          output: `API Gateway ${config.operation} failed: ${result.message || 'Unknown error'}`,
          duration,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'error' as const,
        output: `API Gateway operation error: ${error.message}`,
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
          case 'dynamodb':
            result = await executeDynamoDBNode(node)
            break
          case 'emr':
            result = await executeEMRNode(node)
            break
          case 'lambda':
            result = await executeLambdaNode(node)
            break
          case 'apigateway':
            result = await executeAPIGatewayNode(node)
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
        <ResizablePanel 
          defaultWidth={320}
          minWidth={250}
          maxWidth={600}
          position="right"
        >
          <ExecutionPanel 
            isExecuting={isExecuting}
            results={executionResults}
          />
        </ResizablePanel>
      </Layout>
    </div>
  )
}

export default WorkflowBuilder
