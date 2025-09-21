# 🔍 CloudWatch Node Enhancements

## Overview

Enhanced the CloudWatch node in Flewid to support keyword-based log filtering with custom time ranges, providing a powerful interface for AWS CloudWatch Logs analysis.

## ✨ New Features

### 1. **Interactive Configuration UI**
- **Settings Modal**: Click the gear icon on CloudWatch nodes to open configuration
- **Log Group Field**: Enter CloudWatch log group name (e.g., `/aws/lambda/my-function`)
- **Keyword Search**: Specify keywords to filter logs (e.g., `ERROR`, `WARN`, custom text)
- **Time Range Picker**: Select custom start and end times for log queries
- **Form Validation**: Required fields and helpful tooltips

### 2. **Enhanced Backend Processing**
- **Real AWS Integration**: Uses AWS SDK to query actual CloudWatch Logs
- **Local Credentials Support**: Works with AWS CLI configured credentials
- **Keyword Filtering**: Implements `filterPattern` for precise log filtering
- **Error Handling**: Comprehensive error messages for common issues
- **Performance Logging**: Tracks query execution time and results

### 3. **Rich Execution Results**
- **Detailed Output**: Shows log group, filter pattern, time range, and event count
- **Log Entry Display**: Formats log entries with timestamps and log streams
- **Result Truncation**: Shows first 10 entries with count of remaining
- **Status Indicators**: Success/error states with appropriate messaging
- **Real-time Execution**: Live updates in the execution panel

## 🔧 Technical Implementation

### Frontend Changes

#### CloudWatch Node Component (`frontend/src/components/nodes/CloudWatchNode.tsx`)
```typescript
// New configuration interface
interface CloudWatchNodeData {
  label: string
  config: {
    logGroup?: string
    keyword?: string
    startTime?: string
    endTime?: string
  }
}

// Interactive configuration modal with form validation
// Direct execution capability from node
// Real-time API integration
```

#### Workflow Builder (`frontend/src/components/WorkflowBuilder.tsx`)
```typescript
// Enhanced execution engine
const executeCloudWatchNode = async (node: Node) => {
  // Validates configuration
  // Makes API calls to backend
  // Formats results for display
  // Handles errors gracefully
}
```

### Backend Changes

#### AWS Service (`backend/src/services/AWSService.ts`)
```typescript
// Enhanced CloudWatch query method
async queryCloudWatchLogs(params: {
  accountId: string
  logGroup: string
  filterPattern?: string  // Keyword filtering
  startTime?: number      // Custom time range
  endTime?: number
}): Promise<any>

// Features:
// - Local credentials support
// - Log group existence validation
// - Comprehensive error handling
// - Detailed response formatting
```

#### API Routes (`backend/src/routes/aws.ts`)
```typescript
// Health endpoint for status checking
GET /api/aws/health

// Enhanced CloudWatch query endpoint
POST /api/aws/cloudwatch/query
```

## 🎯 Usage Instructions

### 1. **Configure CloudWatch Node**
1. Drag CloudWatch node to workflow canvas
2. Click the settings (gear) icon on the node
3. Fill in the configuration:
   - **Log Group**: `/aws/lambda/your-function-name`
   - **Keyword**: `ERROR` (or any search term)
   - **Time Range**: Select start and end times (optional)
4. Click "Save" to apply configuration

### 2. **Execute Query**
1. Click "Execute Query" button on the configured node
2. Monitor progress in the Execution Results panel
3. Review detailed results including:
   - Total events found
   - Log entries with timestamps
   - Error messages (if any)

### 3. **Workflow Integration**
1. Add CloudWatch node to a workflow
2. Connect to other nodes for complex debugging scenarios
3. Use "Execute" button in toolbar to run entire workflow
4. View results for all nodes in execution panel

## 🧪 Testing

### Automated Tests
```bash
# Test overall AWS integration
./test-aws-integration.sh

# Test CloudWatch-specific functionality
./test-cloudwatch-integration.sh
```

### Manual Testing
1. **Start Application**: `npm run dev`
2. **Open Browser**: http://localhost:3000
3. **Navigate**: Workflow Builder
4. **Test**: Create and execute CloudWatch workflows

## 📊 Example Queries

### Error Log Analysis
```json
{
  "logGroup": "/aws/lambda/my-function",
  "keyword": "ERROR",
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-01T23:59:59Z"
}
```

### Performance Monitoring
```json
{
  "logGroup": "/aws/apigateway/my-api",
  "keyword": "Duration",
  "startTime": "last 1 hour"
}
```

### Security Auditing
```json
{
  "logGroup": "/aws/cloudtrail/security-logs",
  "keyword": "FAILED",
  "startTime": "last 24 hours"
}
```

## 🔒 Security Features

- **Local Credentials**: Uses AWS CLI configured credentials
- **No Credential Storage**: No AWS keys stored in application
- **Audit Logging**: All API calls are logged for security
- **Error Sanitization**: Sensitive information filtered from error messages

## 🚀 Performance Optimizations

- **Credential Caching**: Temporary credentials cached to reduce API calls
- **Result Limiting**: Queries limited to 100 events for performance
- **Async Processing**: Non-blocking execution with progress indicators
- **Error Recovery**: Graceful handling of network and AWS service issues

## 🔄 Future Enhancements

### Planned Features
- **Log Insights Integration**: Support for CloudWatch Insights queries
- **Multiple Log Groups**: Query across multiple log groups simultaneously
- **Export Functionality**: Download results as CSV/JSON
- **Saved Queries**: Store and reuse common query patterns
- **Real-time Streaming**: Live log tail functionality

### Advanced Capabilities
- **Metric Correlation**: Link log events with CloudWatch metrics
- **Alert Integration**: Create CloudWatch alarms from query results
- **Dashboard Integration**: Embed results in CloudWatch dashboards
- **Cross-Account Queries**: Support for multi-account log analysis

## 📝 API Reference

### CloudWatch Query Endpoint
```http
POST /api/aws/cloudwatch/query
Content-Type: application/json

{
  "accountId": "dev-account-1",
  "logGroup": "/aws/lambda/function-name",
  "filterPattern": "ERROR",
  "startTime": 1640995200000,
  "endTime": 1672531200000
}
```

### Response Format
```json
{
  "success": true,
  "events": [
    {
      "timestamp": "2024-01-01T12:00:00.000Z",
      "message": "ERROR: Something went wrong",
      "logStream": "2024/01/01/[$LATEST]abc123"
    }
  ],
  "summary": {
    "totalEvents": 5,
    "logGroup": "/aws/lambda/function-name",
    "filterPattern": "ERROR",
    "timeRange": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-01T23:59:59.000Z"
    }
  }
}
```

---

**🎉 The CloudWatch node is now ready for production use with your AWS account!**

For questions or issues, refer to:
- `aws-integration-test-plan.md` - Comprehensive testing guide
- `AWS_TESTING_GUIDE.md` - Original AWS testing documentation
- `AWS_CREDENTIALS_SETUP.md` - Credential configuration help
