# Data Passing Implementation for AWS Service Nodes

This document describes the comprehensive data passing system implemented for the Flewid automation workflow application, enabling AWS service nodes to share data and create automated workflows.

## Overview

The data passing system allows nodes in a workflow to extract variables from their execution results and pass them to subsequent nodes using variable substitution syntax like `{{nodeId.extractedData.variableName}}`.

## Architecture

### Core Components

1. **DataPassingService** (`backend/src/services/DataPassingService.ts`)
   - Manages node output storage and variable extraction
   - Handles variable reference parsing and substitution
   - Provides validation for variable references

2. **ExecutionEngine** (`backend/src/engines/ExecutionEngine.ts`)
   - Updated to support topological sorting for proper execution order
   - Integrates data passing service for variable substitution
   - Extracts variables from node outputs automatically

3. **VariableHelper** (`frontend/src/components/VariableHelper.tsx`)
   - UI component for browsing and inserting available variables
   - Provides syntax help and examples
   - Shows preview of variable substitution

4. **Variables API** (`backend/src/routes/variables.ts`)
   - REST endpoints for variable management
   - Validation and substitution services
   - Variable extraction preview functionality

## Variable Extraction

The system automatically extracts variables from node outputs based on node type:

### CloudWatch Node
```javascript
{
  extractedData: {
    events: [...],           // All log events
    logGroup: "...",         // Log group name
    totalEvents: 42,         // Number of events found
    timestamps: [...],       // Event timestamps
    logStreams: [...],       // Unique log streams
    messages: [...],         // Event messages
    requestIds: [...],       // Extracted request IDs
    userIds: [...],          // Extracted user IDs
    errorCodes: [...],       // Extracted error codes
    traceIds: [...]          // Extracted trace IDs
  }
}
```

### DynamoDB Node
```javascript
{
  extractedData: {
    items: [...],            // Query results
    count: 25,               // Items returned
    scannedCount: 100,       // Items scanned
    tableName: "...",        // Table name
    userIdValues: [...],     // Values for 'userId' attribute
    uniqueUserIdValues: [...], // Unique userId values
    // ... other attribute arrays
  }
}
```

### S3 Node
```javascript
{
  extractedData: {
    objects: [...],          // S3 objects
    bucketName: "...",       // Bucket name
    totalObjects: 15,        // Number of objects
    objectKeys: [...],       // Object keys
    objectSizes: [...],      // Object sizes
    lastModified: [...]      // Last modified dates
  }
}
```

### Lambda Node
```javascript
{
  extractedData: {
    functionName: "...",     // Function name
    statusCode: 200,         // HTTP status code
    payload: "...",          // Response payload
    parsedPayload: {...},    // Parsed JSON payload
    responseStatusCode: 200, // Response status from payload
    responseBody: "...",     // Response body from payload
    responseHeaders: {...}   // Response headers from payload
  }
}
```

## Variable Substitution Syntax

### Basic Syntax
- `{{nodeId.extractedData.variableName}}` - Access a simple variable
- `{{nodeId.extractedData.arrayName[0]}}` - Access first item in array
- `{{nodeId.extractedData.arrayName[1]}}` - Access second item in array
- `{{nodeId.data.rawField}}` - Access raw output data

### Examples

#### CloudWatch to DynamoDB
```javascript
// CloudWatch node (id: "cloudwatch-1") extracts user IDs from logs
// DynamoDB node can use: {{cloudwatch-1.extractedData.userIds[0]}}

// DynamoDB Configuration:
{
  tableName: "users",
  operation: "query",
  partitionKey: "userId",
  partitionKeyValue: "{{cloudwatch-1.extractedData.userIds[0]}}"
}
```

#### DynamoDB to Lambda
```javascript
// DynamoDB node (id: "dynamodb-1") queries user data
// Lambda node can use the extracted data

// Lambda Configuration:
{
  functionName: "processUser",
  payload: JSON.stringify({
    userId: "{{dynamodb-1.extractedData.userIdValues[0]}}",
    action: "process"
  })
}
```

#### Complex Filter Expressions
```javascript
// Using multiple variables in DynamoDB filter
{
  filterExpression: "userId={{cloudwatch-1.extractedData.userIds[0]}} AND #status=ACTIVE"
}
```

## Workflow Execution Flow

1. **Topological Sort**: Execution engine determines proper node execution order based on connections
2. **Variable Substitution**: Before executing each node, substitute variables in configuration
3. **Node Execution**: Execute the node with substituted configuration
4. **Variable Extraction**: Extract variables from node output based on node type
5. **Storage**: Store extracted variables for use by subsequent nodes

## API Endpoints

### GET /api/variables/available
Get all available variables from executed nodes.

### POST /api/variables/validate
Validate variable references in a configuration.
```javascript
{
  "config": { "tableName": "{{cloudwatch.extractedData.tableName}}" },
  "availableNodes": ["cloudwatch", "dynamodb"]
}
```

### POST /api/variables/substitute
Substitute variables in a string or configuration.
```javascript
{
  "input": "userId={{cloudwatch.extractedData.userIds[0]}}",
  "type": "string"
}
```

### POST /api/variables/parse
Parse variable references from a string.
```javascript
{
  "input": "{{cloudwatch.extractedData.userIds[0]}}"
}
```

### POST /api/variables/extract-preview
Preview variable extraction for a node type.
```javascript
{
  "nodeType": "cloudwatch",
  "sampleData": { "events": [...] }
}
```

## Frontend Integration

### Variable Helper Component
The `VariableHelper` component provides:
- Browse available variables from executed nodes
- Insert variables into form fields
- Syntax help and examples
- Preview variable substitution

### Node Configuration
Updated node components (like DynamoDBNode) include:
- Variable helper buttons on relevant form fields
- Enhanced placeholders showing variable examples
- Integration with VariableHelper component

## Pattern Extraction

The system includes intelligent pattern extraction for CloudWatch logs:

### Supported Patterns
- **Request IDs**: `request[_-]?id[:\s=]+([a-zA-Z0-9-]+)`
- **User IDs**: `user[_-]?id[:\s=]+([a-zA-Z0-9-]+)`
- **Error Codes**: `error[_-]?code[:\s=]+([0-9]+)`
- **Trace IDs**: `trace[_-]?id[:\s=]+([a-zA-Z0-9-]+)`

### Example Log Message
```
2024-01-01 12:00:00 ERROR request_id=req-123 user_id=user-456 error_code=500 Failed to process request
```

**Extracted Variables:**
- `requestIds: ["req-123"]`
- `userIds: ["user-456"]`
- `errorCodes: ["500"]`

## Error Handling

### Variable Resolution Errors
- Missing node references
- Invalid path expressions
- Array index out of bounds
- Failed node executions

### Validation
- Pre-execution validation of variable references
- Runtime error handling with fallback values
- Clear error messages for debugging

## Best Practices

### Variable Naming
- Use descriptive node IDs (e.g., `cloudwatch-errors`, `user-lookup`)
- Follow consistent naming patterns
- Document variable usage in workflow descriptions

### Error Handling
- Always validate variable references before execution
- Provide fallback values where appropriate
- Use the variable helper to avoid syntax errors

### Performance
- Limit variable extraction to necessary data
- Use array indexing judiciously
- Consider data size when passing between nodes

## Example Workflow

### Lambda Error Investigation Workflow

1. **CloudWatch Node** (`cloudwatch-errors`)
   - Query: `/aws/lambda/my-function` with filter `ERROR`
   - Extracts: `requestIds`, `userIds`, `errorCodes`

2. **DynamoDB Node** (`user-lookup`)
   - Table: `users`
   - Partition Key: `userId = {{cloudwatch-errors.extractedData.userIds[0]}}`
   - Extracts: User profile data

3. **Lambda Node** (`error-processor`)
   - Function: `processError`
   - Payload: 
   ```json
   {
     "requestId": "{{cloudwatch-errors.extractedData.requestIds[0]}}",
     "userId": "{{user-lookup.extractedData.userIdValues[0]}}",
     "errorCode": "{{cloudwatch-errors.extractedData.errorCodes[0]}}"
   }
   ```

This workflow automatically investigates Lambda errors by:
1. Finding error logs in CloudWatch
2. Looking up affected users in DynamoDB
3. Processing the error with contextual information

## Future Enhancements

### Planned Features
- Conditional execution based on variable values
- Data transformation functions (e.g., `{{upper(nodeId.field)}}`)
- Variable scoping and namespaces
- Workflow-level variables and constants
- Variable history and debugging tools

### Advanced Patterns
- Loop constructs for processing arrays
- Parallel execution with data merging
- Cross-workflow variable sharing
- Real-time variable monitoring

## Troubleshooting

### Common Issues

1. **Variable Not Found**
   - Ensure the source node executed successfully
   - Check node ID spelling and case sensitivity
   - Verify the variable path exists in extracted data

2. **Array Index Errors**
   - Check array length before accessing indices
   - Use conditional logic for optional array access
   - Consider using `[0]` for first item, `[-1]` for last item

3. **Substitution Failures**
   - Validate variable syntax using the helper
   - Check for circular dependencies
   - Ensure proper execution order

### Debugging Tools
- Use the Variable Helper preview feature
- Check execution logs for substitution details
- Validate configurations before workflow execution
- Monitor variable extraction in node outputs

This implementation provides a robust foundation for creating complex, data-driven automation workflows with AWS services.
