# User Walkthrough Guide: AWS Workflow Automation with Data Passing

This guide walks you through creating and executing automated workflows with data passing between AWS service nodes, from the main dashboard to running complex automation scenarios.

## Getting Started

### 1. Main Dashboard Overview

When you first access the application at the root URL (`/`), you'll see the **Dashboard** with:

- **Statistics Cards**: Overview of your workflows and executions
  - Total Workflows
  - Active Workflows  
  - Total Executions
  - Currently Running Executions

- **Workflows Table**: List of all your created workflows with:
  - Name and description
  - Status (Active, Draft, Archived)
  - Last run time
  - Success rate
  - Action buttons (Run, Edit, Delete)

- **Recent Executions Table**: History of workflow runs with status and timing

### 2. Prerequisites Setup

Before creating workflows, ensure you have:

**AWS Account Configuration** (Navigate to `/accounts`):
- Set up your AWS credentials
- Configure the regions you want to work with
- Test connectivity to AWS services

## Creating Your First Automated Workflow

### Step 1: Navigate to Workflow Builder

From the Dashboard:
1. Click **"Create Workflow"** button (top-right of Workflows table)
2. Or use the navigation to go to `/builder`

### Step 2: Design Your Workflow

The Workflow Builder interface consists of:

**Left Panel - Node Sidebar**:
- AWS Service nodes (CloudWatch, DynamoDB, S3, Lambda, EMR, API Gateway, RDS)
- Control nodes (Input, Output, Condition, Transform)

**Center Panel - Canvas**:
- Drag and drop area for building workflows
- Visual connections between nodes
- Real-time workflow validation

**Right Panel - Execution Panel**:
- Execute individual nodes or entire workflows
- View execution results and extracted variables
- Monitor real-time execution progress

### Step 3: Build a Sample Workflow - "Lambda Error Investigation"

Let's create a workflow that investigates Lambda errors by connecting CloudWatch logs to DynamoDB user lookups:

#### 3.1 Add CloudWatch Node
1. **Drag** CloudWatch node from sidebar to canvas
2. **Click** the settings icon on the node
3. **Configure**:
   - Operation: "Log Query"
   - Log Group: `/aws/lambda/my-function`
   - Search Keyword: `ERROR`
   - Time Range: Last 1 hour (optional)
4. **Save** configuration
5. **Test** by clicking "Execute Query" to verify it finds error logs

#### 3.2 Add DynamoDB Node
1. **Drag** DynamoDB node to canvas (below CloudWatch node)
2. **Connect** CloudWatch output to DynamoDB input by dragging between connection points
3. **Click** settings icon on DynamoDB node
4. **Configure**:
   - Table Name: `users`
   - Operation: `query`
   - Partition Key Name: `userId`
   - Partition Key Value: Click the **🔧 variable button** next to this field
5. **Use Variable Helper**:
   - Variable Helper modal opens
   - Browse "Available Variables" section
   - Find CloudWatch node variables
   - Click "Insert" next to `userIds[0]` 
   - This inserts: `{{cloudwatch-node-id.extractedData.userIds[0]}}`
6. **Save** configuration

#### 3.3 Add Lambda Processing Node (Optional)
1. **Drag** Lambda node to canvas
2. **Connect** DynamoDB output to Lambda input
3. **Configure**:
   - Function Name: `processErrorReport`
   - Payload: Use variable helper to create JSON with data from previous nodes:
   ```json
   {
     "requestId": "{{cloudwatch-node-id.extractedData.requestIds[0]}}",
     "userId": "{{dynamodb-node-id.extractedData.userIdValues[0]}}",
     "errorCode": "{{cloudwatch-node-id.extractedData.errorCodes[0]}}"
   }
   ```

### Step 4: Save and Execute Workflow

1. **Save Workflow**:
   - Click "Save" in the top toolbar
   - Give it a name: "Lambda Error Investigation"
   - Add description: "Automatically investigate Lambda errors by tracing user activity"

2. **Execute Workflow**:
   - Click "Execute Workflow" button
   - Watch the execution progress in the right panel
   - Nodes will execute in proper order (CloudWatch → DynamoDB → Lambda)
   - View extracted variables and results for each node

## Understanding Data Passing

### How Variables Work

When nodes execute successfully, the system automatically extracts useful variables:

**CloudWatch Node Extracts**:
- `events`: All log events found
- `requestIds`: Request IDs found in log messages
- `userIds`: User IDs found in log messages  
- `errorCodes`: Error codes found in log messages
- `timestamps`: Event timestamps
- `logStreams`: Log stream names

**DynamoDB Node Extracts**:
- `items`: Query results
- `count`: Number of items returned
- `userIdValues`: All values from 'userId' attribute
- `[attributeName]Values`: Values for each attribute found

### Variable Syntax Examples

- **Simple variable**: `{{nodeId.extractedData.variableName}}`
- **Array access**: `{{nodeId.extractedData.userIds[0]}}` (first item)
- **Array access**: `{{nodeId.extractedData.userIds[-1]}}` (last item)
- **Raw data**: `{{nodeId.data.tableName}}`

### Using the Variable Helper

1. **Click** the 🔧 button next to any input field that supports variables
2. **Browse** available variables from previously executed nodes
3. **Preview** how variables will be substituted
4. **Insert** variables with a single click
5. **Test** substitution with the preview feature

## Advanced Workflow Patterns

### Pattern 1: Error Investigation Chain
```
CloudWatch (Find Errors) → DynamoDB (User Lookup) → Lambda (Process/Alert)
```

### Pattern 2: API Debugging Flow  
```
API Gateway (Request Logs) → CloudWatch (Error Details) → S3 (Store Report)
```

### Pattern 3: Performance Analysis
```
CloudWatch (Metrics) → DynamoDB (Historical Data) → Lambda (Analysis) → S3 (Results)
```

## Execution and Monitoring

### Individual Node Testing
1. **Configure** a node completely
2. **Click** "Execute Query/Action" on the node
3. **View** results in the execution panel
4. **Check** extracted variables in the Variable Helper

### Full Workflow Execution
1. **Ensure** all nodes are configured and connected
2. **Click** "Execute Workflow" 
3. **Monitor** progress as nodes execute in sequence
4. **View** detailed results for each step
5. **Check** final workflow output and extracted variables

### Execution Results
Each execution shows:
- **Status**: Success, Error, or Running
- **Duration**: How long each node took
- **Output**: Detailed results from each node
- **Variables**: All extracted variables available for subsequent nodes
- **Logs**: Detailed execution logs for debugging

## Troubleshooting Common Issues

### Variable Not Found Errors
1. **Check** that the source node executed successfully
2. **Verify** the node ID in your variable reference
3. **Ensure** the variable path exists (use Variable Helper to browse)
4. **Test** the source node individually first

### Node Configuration Errors
1. **Use** the Variable Helper to avoid syntax errors
2. **Test** individual nodes before connecting them
3. **Check** AWS credentials and permissions
4. **Verify** resource names (tables, functions, log groups) exist

### Execution Order Issues
1. **Ensure** nodes are properly connected with arrows
2. **Check** for circular dependencies
3. **Verify** the workflow has a clear start and end point

## Best Practices

### Workflow Design
1. **Start Simple**: Begin with 2-3 nodes and add complexity gradually
2. **Test Incrementally**: Test each node individually before connecting
3. **Use Descriptive Names**: Give nodes clear, descriptive IDs
4. **Document Purpose**: Add descriptions to workflows and complex configurations

### Variable Usage
1. **Use Variable Helper**: Always use the helper to avoid syntax errors
2. **Check Array Bounds**: Ensure arrays have items before accessing indices
3. **Handle Failures**: Consider what happens if a node fails or returns no data
4. **Preview First**: Use the preview feature to test variable substitution

### Performance
1. **Limit Data**: Use appropriate limits on queries to avoid large datasets
2. **Filter Early**: Apply filters in CloudWatch and DynamoDB to reduce data transfer
3. **Monitor Execution**: Watch execution times and optimize slow nodes

## Example Workflows to Try

### 1. Lambda Cold Start Analysis
- **CloudWatch**: Query Lambda duration metrics
- **DynamoDB**: Store historical performance data  
- **Lambda**: Analyze trends and send alerts

### 2. API Gateway Error Tracking
- **API Gateway**: Get request logs with errors
- **CloudWatch**: Find detailed error messages
- **DynamoDB**: Look up user context
- **S3**: Store error reports

### 3. S3 Access Pattern Analysis
- **CloudWatch**: S3 access logs
- **DynamoDB**: User activity data
- **Lambda**: Pattern analysis
- **S3**: Store analysis results

## Getting Help

### In-App Resources
- **Variable Helper**: Built-in syntax guide and examples
- **Node Tooltips**: Hover over fields for help text
- **Execution Logs**: Detailed error messages and debugging info

### Documentation
- Check `DATA_PASSING_IMPLEMENTATION.md` for technical details
- Review AWS service documentation for specific configuration options
- Use the preview features to test configurations before execution

This walkthrough provides a complete path from the main dashboard to creating sophisticated automated workflows with data passing between AWS services. Start with simple workflows and gradually build more complex automation as you become familiar with the variable system and node configurations.
