# AWS Services Refactoring

This directory contains the refactored AWS service implementations that were previously all contained in a single large `AWSService.ts` file.

## Architecture

The refactoring follows a modular architecture with the following components:

### Base Service
- **`BaseAWSService.ts`** - Abstract base class that provides common functionality for all AWS services:
  - Credential management
  - Account lookup
  - Common error handling
  - Shared utility methods

### Individual Service Classes
Each AWS service has its own dedicated class that extends `BaseAWSService`:

- **`CloudWatchService.ts`** - CloudWatch Logs and CloudWatch Alarms operations
- **`DynamoDBService.ts`** - DynamoDB query/scan operations with filter expression validation
- **`S3Service.ts`** - S3 object and bucket operations
- **`LambdaService.ts`** - Lambda function management and invocation
- **`EMRService.ts`** - EMR cluster management and YARN Timeline Server integration
- **`APIGatewayService.ts`** - API Gateway management and analysis

### Main Service Orchestrator
- **`../AWSService.ts`** - The main service class that orchestrates all individual services and provides the same public API as before

## Benefits of This Architecture

### 1. **Separation of Concerns**
Each service class is responsible for only one AWS service, making the code easier to understand and maintain.

### 2. **Reduced File Size**
The original `AWSService.ts` was over 1,500 lines. Now each service file is much smaller and focused:
- `CloudWatchService.ts`: ~350 lines
- `DynamoDBService.ts`: ~300 lines
- `S3Service.ts`: ~150 lines
- `LambdaService.ts`: ~400 lines
- `EMRService.ts`: ~350 lines
- `APIGatewayService.ts`: ~250 lines

### 3. **Improved Testability**
Each service can be tested independently, making unit testing much easier.

### 4. **Better Code Reusability**
Common functionality is centralized in `BaseAWSService`, reducing code duplication.

### 5. **Easier Maintenance**
- Adding new AWS services is straightforward - just create a new service class
- Modifying existing services doesn't affect other services
- Bug fixes are isolated to specific service areas

### 6. **Enhanced Readability**
Developers can focus on one AWS service at a time without being overwhelmed by unrelated code.

## Usage

The public API remains exactly the same. The main `AWSService` class delegates calls to the appropriate individual service:

```typescript
// Usage remains unchanged
const awsService = new AWSService()
await awsService.queryCloudWatchLogs(params)  // Delegates to CloudWatchService
await awsService.queryDynamoDB(params)        // Delegates to DynamoDBService
await awsService.invokeLambda(params)         // Delegates to LambdaService
```

## Adding New AWS Services

To add a new AWS service:

1. Create a new service class extending `BaseAWSService`
2. Implement the service-specific methods
3. Add the service instance to the main `AWSService` class
4. Add delegation methods to the main `AWSService` class

Example:
```typescript
// 1. Create NewService.ts
export class NewService extends BaseAWSService {
  async someMethod(params, accounts) {
    // Implementation
  }
}

// 2. Add to main AWSService
private newService: NewService

constructor() {
  // ...
  this.newService = new NewService(this.credentialService)
}

async someServiceMethod(params) {
  return this.newService.someMethod(params, this.accounts)
}
```

## Migration Notes

- The original `AWSService.ts` has been backed up as `AWSService.ts.backup`
- All existing functionality has been preserved
- No breaking changes to the public API
- All imports and usage remain the same
