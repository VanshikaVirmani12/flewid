# EMR Cluster Summary and Application Details API Guide

This guide covers how to get EMR cluster summary and application details, including YARN Timeline server information, through various API calls.

## Table of Contents
1. [AWS EMR APIs for Cluster Summary](#aws-emr-apis-for-cluster-summary)
2. [YARN Timeline Server APIs](#yarn-timeline-server-apis)
3. [Implementation Examples](#implementation-examples)
4. [Integration with Current System](#integration-with-current-system)
5. [Complete API Reference](#complete-api-reference)

## AWS EMR APIs for Cluster Summary

### 1. Basic Cluster Information

#### List Clusters
```bash
# AWS CLI
aws emr list-clusters --cluster-states STARTING BOOTSTRAPPING RUNNING WAITING

# Using AWS SDK (JavaScript/TypeScript)
const command = new ListClustersCommand({
  ClusterStates: ['STARTING', 'BOOTSTRAPPING', 'RUNNING', 'WAITING']
});
const response = await emrClient.send(command);
```

#### Describe Cluster (Detailed Summary)
```bash
# AWS CLI
aws emr describe-cluster --cluster-id j-1234567890ABC

# Using AWS SDK
const command = new DescribeClusterCommand({
  ClusterId: 'j-1234567890ABC'
});
const response = await emrClient.send(command);
```

**Response includes:**
- Cluster state and status
- Instance groups and fleet details
- Applications installed (Hadoop, Spark, Hive, etc.)
- Security configuration
- Bootstrap actions
- Tags and configurations

### 2. Application and Step Information

#### List Steps
```bash
# AWS CLI
aws emr list-steps --cluster-id j-1234567890ABC

# Using AWS SDK
const command = new ListStepsCommand({
  ClusterId: 'j-1234567890ABC',
  StepStates: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']
});
```

#### Describe Step
```bash
# AWS CLI
aws emr describe-step --cluster-id j-1234567890ABC --step-id s-1234567890ABC

# Using AWS SDK
const command = new DescribeStepCommand({
  ClusterId: 'j-1234567890ABC',
  StepId: 's-1234567890ABC'
});
```

## YARN Timeline Server APIs

### 1. Accessing YARN Timeline Server

The YARN Timeline Server provides detailed application and container information. It's accessible through REST APIs on EMR clusters.

#### Base URL Format
```
http://<master-public-dns>:8188/ws/v1/timeline/
https://<master-public-dns>:8190/ws/v1/timeline/  # If SSL enabled
```

### 2. Timeline Server Endpoints

#### Get All Applications
```bash
# Get all applications
curl "http://<master-dns>:8188/ws/v1/timeline/YARN_APPLICATION"

# Get applications with filters
curl "http://<master-dns>:8188/ws/v1/timeline/YARN_APPLICATION?limit=100&windowStart=1640995200000&windowEnd=1641081600000"
```

#### Get Specific Application
```bash
curl "http://<master-dns>:8188/ws/v1/timeline/YARN_APPLICATION/application_1234567890123_0001"
```

#### Get Application Attempts
```bash
curl "http://<master-dns>:8188/ws/v1/timeline/YARN_APPLICATION_ATTEMPT/appattempt_1234567890123_0001_000001"
```

#### Get Containers
```bash
curl "http://<master-dns>:8188/ws/v1/timeline/YARN_CONTAINER/container_1234567890123_0001_01_000001"
```

### 3. Spark History Server (if Spark is installed)

#### Base URL
```
http://<master-public-dns>:18080/api/v1/
```

#### Get Applications
```bash
curl "http://<master-dns>:18080/api/v1/applications"
```

#### Get Application Details
```bash
curl "http://<master-dns>:18080/api/v1/applications/app-20240115123456-0001"
```

#### Get Jobs for Application
```bash
curl "http://<master-dns>:18080/api/v1/applications/app-20240115123456-0001/jobs"
```

#### Get Stages for Application
```bash
curl "http://<master-dns>:18080/api/v1/applications/app-20240115123456-0001/stages"
```

## Implementation Examples

### 1. Enhanced EMR Service Methods

Here are additional methods you can add to your `AWSService.ts`:

```typescript
/**
 * Get comprehensive cluster summary including applications
 */
async getEMRClusterSummary(params: {
  accountId: string
  clusterId: string
  includeSteps?: boolean
  includeApplications?: boolean
}): Promise<any> {
  const credentials = await this.getCredentials(params.accountId);
  const emrClient = new EMRClient({
    region: credentials.region,
    credentials: credentials
  });

  // Get basic cluster info
  const clusterResponse = await emrClient.send(
    new DescribeClusterCommand({ ClusterId: params.clusterId })
  );

  const result: any = {
    cluster: clusterResponse.Cluster,
    summary: {
      id: clusterResponse.Cluster?.Id,
      name: clusterResponse.Cluster?.Name,
      state: clusterResponse.Cluster?.Status?.State,
      applications: clusterResponse.Cluster?.Applications?.map(app => ({
        name: app.Name,
        version: app.Version
      })),
      instanceGroups: clusterResponse.Cluster?.InstanceGroups,
      masterPublicDns: clusterResponse.Cluster?.MasterPublicDnsName
    }
  };

  // Get steps if requested
  if (params.includeSteps) {
    const stepsResponse = await emrClient.send(
      new ListStepsCommand({ ClusterId: params.clusterId })
    );
    result.steps = stepsResponse.Steps;
  }

  // Get YARN applications if requested and cluster has public DNS
  if (params.includeApplications && result.summary.masterPublicDns) {
    try {
      result.yarnApplications = await this.getYARNApplications(
        result.summary.masterPublicDns
      );
    } catch (error) {
      logger.warn('Failed to fetch YARN applications', { error: error.message });
      result.yarnApplications = { error: 'Unable to fetch YARN applications' };
    }
  }

  return result;
}

/**
 * Get YARN Timeline Server applications
 */
async getYARNApplications(masterDns: string): Promise<any> {
  const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION`;
  
  try {
    const response = await fetch(`${timelineUrl}?limit=100`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      applications: data.entities?.map((app: any) => ({
        id: app.entity,
        type: app.entitytype,
        startTime: app.starttime,
        events: app.events,
        primaryFilters: app.primaryfilters,
        otherInfo: app.otherinfo
      })) || []
    };
  } catch (error) {
    throw new Error(`Failed to fetch YARN applications: ${error.message}`);
  }
}

/**
 * Get Spark applications (if Spark History Server is available)
 */
async getSparkApplications(masterDns: string): Promise<any> {
  const sparkUrl = `http://${masterDns}:18080/api/v1/applications`;
  
  try {
    const response = await fetch(sparkUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const applications = await response.json();
    return {
      applications: applications.map((app: any) => ({
        id: app.id,
        name: app.name,
        startTime: app.attempts[0]?.startTime,
        endTime: app.attempts[0]?.endTime,
        duration: app.attempts[0]?.duration,
        sparkUser: app.attempts[0]?.sparkUser,
        completed: app.attempts[0]?.completed
      }))
    };
  } catch (error) {
    throw new Error(`Failed to fetch Spark applications: ${error.message}`);
  }
}

/**
 * Get detailed application information from YARN Timeline Server
 */
async getYARNApplicationDetails(masterDns: string, applicationId: string): Promise<any> {
  const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION/${applicationId}`;
  
  try {
    const response = await fetch(timelineUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch application details: ${error.message}`);
  }
}
```

### 2. New API Routes

Add these routes to your `aws.ts` router:

```typescript
// GET /api/aws/emr/cluster/:clusterId/summary - Get comprehensive cluster summary
router.get('/emr/cluster/:clusterId/summary', asyncHandler(async (req, res) => {
  const { clusterId } = req.params;
  const { accountId, includeSteps, includeApplications } = req.query;
  
  const result = await awsService.getEMRClusterSummary({
    accountId: accountId as string,
    clusterId,
    includeSteps: includeSteps === 'true',
    includeApplications: includeApplications === 'true'
  });
  
  res.json(result);
}));

// GET /api/aws/emr/cluster/:clusterId/yarn-applications - Get YARN applications
router.get('/emr/cluster/:clusterId/yarn-applications', asyncHandler(async (req, res) => {
  const { clusterId } = req.params;
  const { accountId } = req.query;
  
  // First get cluster info to get master DNS
  const clusterInfo = await awsService.describeEMRCluster({
    accountId: accountId as string,
    clusterId
  });
  
  if (!clusterInfo.cluster.masterPublicDnsName) {
    return res.status(400).json({
      success: false,
      message: 'Cluster does not have a public DNS name'
    });
  }
  
  const result = await awsService.getYARNApplications(
    clusterInfo.cluster.masterPublicDnsName
  );
  
  res.json({ success: true, ...result });
}));

// GET /api/aws/emr/cluster/:clusterId/spark-applications - Get Spark applications
router.get('/emr/cluster/:clusterId/spark-applications', asyncHandler(async (req, res) => {
  const { clusterId } = req.params;
  const { accountId } = req.query;
  
  // First get cluster info to get master DNS
  const clusterInfo = await awsService.describeEMRCluster({
    accountId: accountId as string,
    clusterId
  });
  
  if (!clusterInfo.cluster.masterPublicDnsName) {
    return res.status(400).json({
      success: false,
      message: 'Cluster does not have a public DNS name'
    });
  }
  
  const result = await awsService.getSparkApplications(
    clusterInfo.cluster.masterPublicDnsName
  );
  
  res.json({ success: true, ...result });
}));
```

## Integration with Current System

### 1. Enhanced EMR Node Configuration

Update your EMR node to include new operations:

```typescript
// Add these to your EMR node operation options
const operations = [
  'listClusters',
  'describeCluster',
  'getClusterSummary',      // New
  'getYarnApplications',    // New
  'getSparkApplications',   // New
  'addStep'
];
```

### 2. Frontend Integration

```typescript
// Example API calls from frontend
const getClusterSummary = async (clusterId: string) => {
  const response = await fetch(
    `/api/aws/emr/cluster/${clusterId}/summary?accountId=dev-account-1&includeSteps=true&includeApplications=true`
  );
  return response.json();
};

const getYarnApplications = async (clusterId: string) => {
  const response = await fetch(
    `/api/aws/emr/cluster/${clusterId}/yarn-applications?accountId=dev-account-1`
  );
  return response.json();
};
```

## Complete API Reference

### AWS EMR APIs (via AWS SDK)

| Operation | Method | Description |
|-----------|--------|-------------|
| `ListClusters` | `listEMRClusters()` | Get list of clusters with basic info |
| `DescribeCluster` | `describeEMRCluster()` | Get detailed cluster information |
| `ListSteps` | `listEMRSteps()` | Get steps for a cluster |
| `DescribeStep` | `describeEMRStep()` | Get detailed step information |
| `ListInstanceGroups` | `listInstanceGroups()` | Get instance group details |
| `ListInstanceFleets` | `listInstanceFleets()` | Get instance fleet details |

### YARN Timeline Server APIs (Direct HTTP)

| Endpoint | Description |
|----------|-------------|
| `/ws/v1/timeline/YARN_APPLICATION` | List all applications |
| `/ws/v1/timeline/YARN_APPLICATION/{app-id}` | Get specific application |
| `/ws/v1/timeline/YARN_APPLICATION_ATTEMPT/{attempt-id}` | Get application attempt |
| `/ws/v1/timeline/YARN_CONTAINER/{container-id}` | Get container information |

### Spark History Server APIs (Direct HTTP)

| Endpoint | Description |
|----------|-------------|
| `/api/v1/applications` | List Spark applications |
| `/api/v1/applications/{app-id}` | Get application details |
| `/api/v1/applications/{app-id}/jobs` | Get jobs for application |
| `/api/v1/applications/{app-id}/stages` | Get stages for application |
| `/api/v1/applications/{app-id}/executors` | Get executor information |

## Security Considerations

1. **Network Access**: YARN Timeline Server and Spark History Server require network access to the EMR master node
2. **Security Groups**: Ensure ports 8188 (Timeline Server) and 18080 (Spark History) are accessible
3. **Authentication**: Consider implementing authentication for Timeline Server access in production
4. **SSL/TLS**: Use HTTPS endpoints when SSL is enabled on the cluster

## Error Handling

Common issues and solutions:

1. **Connection Refused**: Check if Timeline Server is running and ports are open
2. **404 Not Found**: Verify the application ID exists and Timeline Server is accessible
3. **Timeout**: Timeline Server may be slow with large datasets, implement appropriate timeouts
4. **Authentication**: Some clusters may require authentication for Timeline Server access

## Performance Considerations

1. **Caching**: Cache Timeline Server responses for frequently accessed data
2. **Pagination**: Use limit parameters for large datasets
3. **Filtering**: Apply time-based filters to reduce response size
4. **Async Processing**: Use async/await for multiple API calls

This guide provides comprehensive coverage of getting EMR cluster summaries and application details through both AWS APIs and direct Timeline Server access.
