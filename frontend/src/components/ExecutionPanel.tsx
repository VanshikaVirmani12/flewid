import React, { useState } from 'react'
import { Typography, Card, Timeline, Tag, Empty, Spin, Collapse, Button } from 'antd'
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  ClockCircleOutlined,
  LoadingOutlined,
  CopyOutlined,
  ExpandOutlined,
  CompressOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface ExecutionResult {
  nodeId: string
  status: 'success' | 'error' | 'running'
  output: string
  duration?: number
  timestamp: string
}

interface ExecutionPanelProps {
  isExecuting: boolean
  results: ExecutionResult[]
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ isExecuting, results }) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  
  const toggleExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatOutput = (output: string) => {
    // Try to detect and format JSON
    try {
      const parsed = JSON.parse(output)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // Not JSON, return as is
      return output
    }
  }

  const parseStructuredOutput = (output: string) => {
    const lines = output.split('\n')
    const sections: { title: string; content: string[] }[] = []
    let currentSection: { title: string; content: string[] } | null = null

    for (const line of lines) {
      // Check if line is a section header (ends with : and has no leading spaces)
      if (line.trim().endsWith(':') && !line.startsWith(' ') && line.trim().length > 1) {
        if (currentSection) {
          sections.push(currentSection)
        }
        currentSection = { title: line.trim(), content: [] }
      } else if (currentSection && line.trim()) {
        currentSection.content.push(line)
      } else if (!currentSection && line.trim()) {
        // Content before any section
        if (sections.length === 0) {
          sections.push({ title: 'Output', content: [line] })
        } else {
          sections[sections.length - 1].content.push(line)
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection)
    }

    return sections.length > 1 ? sections : null
  }

  const renderFormattedOutput = (result: ExecutionResult, index: number) => {
    const resultId = `${result.nodeId}-${index}`
    const isExpanded = expandedResults.has(resultId)
    const structuredSections = parseStructuredOutput(result.output)

    if (structuredSections && structuredSections.length > 1) {
      // Render as collapsible sections
      const items = structuredSections.map((section, sectionIndex) => ({
        key: `${resultId}-${sectionIndex}`,
        label: (
          <div className="flex justify-between items-center">
            <Text strong className="text-sm">{section.title}</Text>
            <Text type="secondary" className="text-xs">
              {section.content.length} lines
            </Text>
          </div>
        ),
        children: (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <Text className="text-blue-700 text-sm font-medium">Output</Text>
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(section.content.join('\n'))}
                className="text-blue-600 hover:text-blue-800"
              />
            </div>
            <div className="bg-white p-3 rounded border text-sm leading-relaxed">
              <pre className="whitespace-pre-wrap m-0 text-gray-800 font-mono">
                {section.content.join('\n')}
              </pre>
            </div>
          </div>
        )
      }))

      return (
        <Collapse
          items={items}
          size="small"
          className="mt-2"
          ghost
        />
      )
    } else {
      // Render as single expandable block
      const output = result.output
      const isLongOutput = output.length > 200
      const displayOutput = isExpanded || !isLongOutput ? output : output.substring(0, 200) + '...'

      return (
        <div className="mt-2">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <Text className="text-blue-700 text-sm font-medium">Output</Text>
              <div className="flex gap-1">
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(output)}
                  className="text-blue-600 hover:text-blue-800"
                />
                {isLongOutput && (
                  <Button
                    size="small"
                    type="text"
                    icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                    onClick={() => toggleExpanded(resultId)}
                    className="text-blue-600 hover:text-blue-800"
                  />
                )}
              </div>
            </div>
            <div className="bg-white p-3 rounded border text-sm leading-relaxed">
              <pre className="whitespace-pre-wrap m-0 text-gray-800 font-mono overflow-x-auto">
                {displayOutput}
              </pre>
            </div>
          </div>
        </div>
      )
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      case 'running':
        return 'processing'
      default:
        return 'default'
    }
  }

  return (
    <div className="execution-panel h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <Title level={4}>Execution Results</Title>
        {isExecuting && (
          <div className="flex items-center mt-2">
            <Spin size="small" className="mr-2" />
            <Text type="secondary">Workflow is running...</Text>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {results.length === 0 && !isExecuting ? (
          <Empty 
            description="No execution results yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline>
            {results.map((result, index) => (
              <Timeline.Item
                key={`${result.nodeId}-${index}`}
                dot={getStatusIcon(result.status)}
              >
                <Card size="small" className="mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Text strong>{result.nodeId}</Text>
                    <Tag color={getStatusColor(result.status)}>
                      {result.status.toUpperCase()}
                    </Tag>
                  </div>
                  
                  <Text type="secondary" className="text-xs block mb-2">
                    {dayjs(result.timestamp).format('HH:mm:ss')}
                    {result.duration && ` • ${result.duration}ms`}
                  </Text>
                  
                  {renderFormattedOutput(result, index)}
                </Card>
              </Timeline.Item>
            ))}
            
            {isExecuting && (
              <Timeline.Item
                dot={<LoadingOutlined style={{ color: '#1890ff' }} />}
              >
                <Text type="secondary">Executing workflow...</Text>
              </Timeline.Item>
            )}
          </Timeline>
        )}
      </div>

      {results.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <Text type="secondary" className="text-xs block">Success</Text>
              <Text strong className="text-green-600">
                {results.filter(r => r.status === 'success').length}
              </Text>
            </div>
            <div>
              <Text type="secondary" className="text-xs block">Errors</Text>
              <Text strong className="text-red-600">
                {results.filter(r => r.status === 'error').length}
              </Text>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExecutionPanel
