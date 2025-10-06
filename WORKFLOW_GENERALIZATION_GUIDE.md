# AWS Workflow Generalization Guide

## Overview
This guide analyzes your AWS workflow examples and provides a generalized approach to building them with your workflow builder application. The application already has a solid foundation with data passing capabilities, AWS service integrations, and a visual workflow builder.

## Generalized Workflow Patterns

### 1. **Investigation & Monitoring Pattern**
**Common Structure:** Trigger → Query/Search → Parse/Filter → Analyze → Report

**Examples from your workflows:**
- DLQ Message Handling
- Data Investigation  
- High Data/Load Age monitoring

**Generalized Steps:**
1. **Trigger Node** (SQS poll, CloudWatch alarm, scheduled trigger)
2. **Query Node** (CloudWatch logs, DynamoDB scan, Athena query)
3. **Transform Node** (parse keywords, extract patterns, filter data)
4. **Condition Node** (check thresholds, validate patterns)
5. **Action Node** (send alerts, create tickets, trigger remediation)

### 2. **Resource Management Pattern**
**Common Structure:** Identify → Validate → Execute → Monitor → Verify

**Examples from your workflows:**
- Cluster Management
- Cluster Scaling
- Corrupted Batch Handling

**Generalized Steps:**
1. **Query Node** (EMR describe cluster, DynamoDB get item)
2. **Condition Node** (check status, validate prerequisites)
3. **Action Node** (update DynamoDB, modify EMR, trigger Lambda)
4. **Verification Node** (confirm changes, check new status)
5. **Notification Node** (log results, send notifications)

### 3. **Data Pipeline Pattern**
**Common Structure:** Detect → Validate → Process → Store → Notify

**Examples from your workflows:**
- Corrupted Batch Handling
- Data Investigation

**Generalized Steps:**
1. **Detection Node** (S3 event, DynamoDB stream, scheduled check)
2. **Validation Node** (check data integrity, validate format)
3. **Processing Node** (Lambda function, EMR job, data transformation)
4. **Storage Node** (S3 write, DynamoDB update, backup creation)
5. **Notification Node** (SNS, SQS, CloudWatch metrics)

## Workflow Implementation Examples

### Example 1: DLQ Message Investigation Workflow

```
[SQS Poll DLQ] → [Transform: Parse Keywords] → [CloudWatch Query] → [Condition: Check Patterns] → [EMR Describe Cluster]
       ↓                                                                        ↓
[Store Results] ← [Transform: Format Report] ← [CloudWatch Log Analysis] ← [Branch: Found Issues]
```

**Node Configurations:**

1. **SQS Node** (Poll DLQ)
   - Operation: `pollMessages`
   - Queue: `{{workflow.dlqQueueName}}`
   - Poll Duration: 60 seconds

2. **Transform Node** (Parse Keywords)
   - Input: `{{sqs.extractedData.messages}}`
   - Logic: Extract user-defined keywords from message bodies
   - Output: `parsedKeywords`, `affectedClusters`

3. **CloudWatch Node** (Query Logs)
   - Log Group: `/aws/emr/{{transform.affectedClusters[0]}}`
   - Filter Pattern: `{{transform.parsedKeywords[0]}}`
   - Time Range: Last 24 hours

4. **EMR Node** (Describe Cluster)
   - Operation: `describeCluster`
   - Cluster ID: `{{transform.affectedClusters[0]}}`

### Example 2: Cluster Management Workflow

```
[EMR List Clusters] → [Condition: Check Status] → [DynamoDB Update Status]
         ↓                       ↓                         ↓
[Transform: Filter] → [EMR Modify Instance Fleet] → [CloudWatch: Log Action]
```

**Node Configurations:**

1. **EMR Node** (List Clusters)
   - Operation: `listClusters`
   - Filter: `{{workflow.clusterNamePattern}}`

2. **Condition Node** (Check Status)
   - Condition: `{{emr.extractedData.clusters[0].state}} === 'RUNNING'`
   - True Path: Continue to scaling
   - False Path: Skip to logging

3. **DynamoDB Node** (Update Status)
   - Table: `clusters`
   - Operation: `updateItem`
   - Key: `{clusterName: "{{emr.extractedData.clusters[0].name}}"}`
   - Update: `{status: "TERMINATED"}`

## Data Passing Between Nodes

### Current Implementation Strengths
Your `DataPassingService` already provides excellent capabilities:

1. **Variable Extraction**: Automatically extracts relevant data from each node type
2. **Variable Substitution**: Uses `{{nodeId.path}}` syntax for referencing data
3. **Type-Specific Parsing**: Handles different AWS service response formats
4. **Validation**: Checks variable references before execution

### Enhanced Data Passing for Workflows

**1. Contextual Variables**
```typescript
// Add workflow-level variables
interface WorkflowContext {
  dlqQueueName: string
  clusterNamePattern: string
  alertThreshold: number
  userKeywords: string[]
}
```

**2. Cross-Node Data Flow**
```typescript
// Example: Pass SQS message data to CloudWatch query
const sqsResult = "{{sqs.extractedData.messages[0].body}}"
const extractedClusterId = "{{transform.extractedData.clusterId}}"
const logGroup = "/aws/emr/{{transform.extractedData.clusterId}}"
```

**3. Conditional Data Passing**
```typescript
// Use condition nodes to control data flow
const shouldScale = "{{condition.result}}"
const targetCapacity = "{{condition.result ? workflow.scaleUpCapacity : workflow.scaleDownCapacity}}"
```

## Required Service Node Enhancements

### 1. **Athena Node** (New - Required for Data Investigation)
```typescript
interface AthenaNodeConfig {
  operation: 'executeQuery' | 'getQueryResults'
  queryString: string
  database: string
  outputLocation: string
  workGroup?: string
}
```

### 2. **Enhanced CloudWatch Node**
Add alarm operations:
```typescript
interface CloudWatchNodeConfig {
  operation: 'logs' | 'alarms' | 'metrics'
  // Existing log config...
  // New alarm config:
  alarmName?: string
  alarmActions?: string[]
  metricName?: string
  namespace?: string
}
```

### 3. **Enhanced DynamoDB Node**
Add update/delete operations:
```typescript
interface DynamoDBNodeConfig {
  operation: 'scan' | 'query' | 'getItem' | 'putItem' | 'updateItem' | 'deleteItem'
  // Existing config...
  // New update config:
  updateExpression?: string
  conditionExpression?: string
  expressionAttributeValues?: Record<string, any>
}
```

### 4. **Enhanced S3 Node**
Add file operations:
```typescript
interface S3NodeConfig {
  operation: 'listObjects' | 'getObject' | 'putObject' | 'deleteObject' | 'copyObject'
  bucketName: string
  key?: string
  prefix?: string
  // File operation configs...
}
```

### 5. **SNS Node** (New - For Notifications)
```typescript
interface SNSNodeConfig {
  operation: 'publish' | 'listTopics' | 'createTopic'
  topicArn?: string
  message: string
  subject?: string
  messageAttributes?: Record<string, any>
}
```

## Workflow Templates

### Template 1: DLQ Investigation
```json
{
  "name": "DLQ Message Investigation",
  "description": "Investigate DLQ messages and correlate with EMR cluster issues",
  "variables": {
    "dlqQueueName": "my-dlq",
    "keywords": ["ERROR", "FAILED", "TIMEOUT"],
    "timeWindow": "24h"
  },
  "nodes": [
    {
      "id": "sqs-poll",
      "type": "sqs",
      "config": {
        "operation": "pollMessages",
        "queueName": "{{workflow.dlqQueueName}}",
        "pollDurationSeconds": 60
      }
    },
    {
      "id": "parse-messages",
      "type": "transform",
      "config": {
        "script": "extractClusterIds({{sqs-poll.extractedData.messages}})"
      }
    },
    {
      "id": "query-logs",
      "type": "cloudwatch",
      "config": {
        "operation": "logs",
        "logGroup": "/aws/emr/{{parse-messages.clusterId}}",
        "keyword": "{{workflow.keywords[0]}}"
      }
    }
  ]
}
```

### Template 2: Cluster Scaling
```json
{
  "name": "EMR Cluster Scaling",
  "description": "Scale EMR cluster based on conditions",
  "variables": {
    "clusterName": "my-cluster",
    "scaleThreshold": 80,
    "targetCapacity": 10
  },
  "nodes": [
    {
      "id": "check-cluster",
      "type": "emr",
      "config": {
        "operation": "describeCluster",
        "clusterName": "{{workflow.clusterName}}"
      }
    },
    {
      "id": "check-metrics",
      "type": "cloudwatch",
      "config": {
        "operation": "metrics",
        "metricName": "CPUUtilization",
        "namespace": "AWS/EMR"
      }
    },
    {
      "id": "scale-decision",
      "type": "condition",
      "config": {
        "condition": "{{check-metrics.value}} > {{workflow.scaleThreshold}}"
      }
    },
    {
      "id": "update-capacity",
      "type": "emr",
      "config": {
        "operation": "modifyInstanceFleet",
        "clusterId": "{{check-cluster.clusterId}}",
        "targetCapacity": "{{workflow.targetCapacity}}"
      }
    }
  ]
}
```

## Implementation Recommendations

### 1. **Enhanced Transform Node**
Create a more powerful transform node that can:
- Parse complex data structures
- Extract patterns using regex
- Perform data aggregation
- Format output for downstream nodes

### 2. **Workflow Variables Panel**
Add a variables panel to the UI where users can:
- Define workflow-level variables
- Set default values
- Specify variable types and validation rules

### 3. **Template Library**
Create a template library with:
- Pre-built workflow templates for common patterns
- Parameterized templates users can customize
- Import/export functionality for sharing workflows

### 4. **Enhanced Condition Node**
Improve the condition node to support:
- Complex boolean logic
- Multiple conditions with AND/OR operators
- Data validation and type checking
- Custom JavaScript expressions

### 5. **Error Handling & Retry Logic**
Add workflow-level error handling:
- Retry failed nodes with exponential backoff
- Error routing to alternative paths
- Rollback capabilities for failed workflows
- Dead letter queues for failed executions

## Next Steps

1. **Implement Missing Nodes**: Create Athena and SNS nodes
2. **Enhance Existing Nodes**: Add missing operations to current nodes
3. **Create Workflow Templates**: Build templates for your common patterns
4. **Add Variable Management**: Create UI for workflow variables
5. **Implement Error Handling**: Add robust error handling and retry logic
6. **Create Documentation**: Document common patterns and best practices

This generalization approach will allow you to build all your current workflows and many more complex scenarios while maintaining the flexibility to adapt to new requirements.
