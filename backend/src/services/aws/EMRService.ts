import { EMRClient, ListClustersCommand, DescribeClusterCommand, AddJobFlowStepsCommand, ListStepsCommand, DescribeStepCommand, ClusterState, StepState, ActionOnFailure } from '@aws-sdk/client-emr'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class EMRService extends BaseAWSService {
  /**
   * List EMR clusters
   */
  async listClusters(params: {
    accountId: string
    states?: string[]
    clusterId?: string
    clusterName?: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing EMR clusters', { 
      accountId: params.accountId,
      states: params.states
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create EMR client
      const client = new EMRClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List clusters
      const command = new ListClustersCommand({
        ClusterStates: (params.states as ClusterState[]) || [ClusterState.STARTING, ClusterState.BOOTSTRAPPING, ClusterState.RUNNING, ClusterState.WAITING]
      })

      const response = await client.send(command)
      
      let clusters = response.Clusters?.map(cluster => ({
        id: cluster.Id,
        name: cluster.Name,
        state: cluster.Status?.State,
        stateChangeReason: cluster.Status?.StateChangeReason?.Message,
        creationDateTime: cluster.Status?.Timeline?.CreationDateTime?.toISOString(),
        readyDateTime: cluster.Status?.Timeline?.ReadyDateTime?.toISOString(),
        normalizedInstanceHours: cluster.NormalizedInstanceHours
      })) || []

      // Filter by cluster ID if provided
      if (params.clusterId) {
        clusters = clusters.filter(cluster => 
          cluster.id?.toLowerCase().includes(params.clusterId!.toLowerCase())
        )
      }

      // Filter by cluster name if provided
      if (params.clusterName) {
        clusters = clusters.filter(cluster => 
          cluster.name?.toLowerCase().includes(params.clusterName!.toLowerCase())
        )
      }

      logger.info('EMR clusters listed', {
        accountId: params.accountId,
        count: clusters.length,
        filteredBy: {
          clusterId: params.clusterId,
          clusterName: params.clusterName
        }
      })

      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListClusters', true)

      return {
        success: true,
        clusters,
        count: clusters.length,
        filters: {
          clusterId: params.clusterId,
          clusterName: params.clusterName,
          states: params.states
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListClusters', false)
      this.handleAWSError(error, 'EMR list clusters')
    }
  }

  /**
   * Describe EMR cluster
   */
  async describeCluster(params: {
    accountId: string
    clusterId: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Describing EMR cluster', { 
      accountId: params.accountId,
      clusterId: params.clusterId
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create EMR client
      const client = new EMRClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Describe cluster
      const command = new DescribeClusterCommand({
        ClusterId: params.clusterId
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:DescribeCluster', true)

      const cluster = response.Cluster
      if (!cluster) {
        throw createError(`Cluster ${params.clusterId} not found`, 404)
      }

      return {
        success: true,
        cluster: {
          id: cluster.Id,
          name: cluster.Name,
          state: cluster.Status?.State,
          stateChangeReason: cluster.Status?.StateChangeReason?.Message,
          creationDateTime: cluster.Status?.Timeline?.CreationDateTime?.toISOString(),
          readyDateTime: cluster.Status?.Timeline?.ReadyDateTime?.toISOString(),
          endDateTime: cluster.Status?.Timeline?.EndDateTime?.toISOString(),
          normalizedInstanceHours: cluster.NormalizedInstanceHours,
          masterPublicDnsName: cluster.MasterPublicDnsName,
          applications: cluster.Applications?.map(app => ({
            name: app.Name,
            version: app.Version
          })) || [],
          ec2InstanceAttributes: {
            keyName: cluster.Ec2InstanceAttributes?.Ec2KeyName,
            instanceProfile: cluster.Ec2InstanceAttributes?.IamInstanceProfile,
            subnetId: cluster.Ec2InstanceAttributes?.Ec2SubnetId
          }
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:DescribeCluster', false)
      
      if (error.name === 'InvalidRequestException') {
        throw createError(`Cluster ${params.clusterId} not found`, 404)
      }
      
      this.handleAWSError(error, 'EMR describe cluster', params.clusterId)
    }
  }

  /**
   * Add job flow steps to EMR cluster
   */
  async addSteps(params: {
    accountId: string
    clusterId: string
    steps: Array<{
      name: string
      jar: string
      mainClass?: string
      args?: string[]
      actionOnFailure?: string
    }>
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Adding EMR steps', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      stepCount: params.steps.length
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create EMR client
      const client = new EMRClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // Prepare steps
      const emrSteps = params.steps.map(step => ({
        Name: step.name,
        ActionOnFailure: (step.actionOnFailure as ActionOnFailure) || ActionOnFailure.CONTINUE,
        HadoopJarStep: {
          Jar: step.jar,
          MainClass: step.mainClass,
          Args: step.args || []
        }
      }))

      // Add steps
      const command = new AddJobFlowStepsCommand({
        JobFlowId: params.clusterId,
        Steps: emrSteps
      })

      const response = await client.send(command)
      
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:AddJobFlowSteps', true)

      return {
        success: true,
        stepIds: response.StepIds || []
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:AddJobFlowSteps', false)
      this.handleAWSError(error, 'EMR add steps', params.clusterId)
    }
  }

  /**
   * List EMR steps for a cluster
   */
  async listSteps(params: {
    accountId: string
    clusterId: string
    stepStates?: string[]
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Listing EMR steps', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      stepStates: params.stepStates
    })

    try {
      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create EMR client
      const client = new EMRClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // List steps
      const command = new ListStepsCommand({
        ClusterId: params.clusterId,
        StepStates: params.stepStates as StepState[]
      })

      const response = await client.send(command)
      
      const steps = response.Steps?.map(step => ({
        id: step.Id,
        name: step.Name,
        state: step.Status?.State,
        stateChangeReason: step.Status?.StateChangeReason,
        creationDateTime: step.Status?.Timeline?.CreationDateTime?.toISOString(),
        startDateTime: step.Status?.Timeline?.StartDateTime?.toISOString(),
        endDateTime: step.Status?.Timeline?.EndDateTime?.toISOString(),
        actionOnFailure: step.ActionOnFailure,
        config: {
          jar: step.Config?.Jar,
          mainClass: step.Config?.MainClass,
          args: step.Config?.Args
        }
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListSteps', true)

      return {
        success: true,
        steps,
        count: steps.length
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'emr:ListSteps', false)
      this.handleAWSError(error, 'EMR list steps', params.clusterId)
    }
  }

  /**
   * Get YARN Timeline Server applications for EMR cluster
   */
  async getYarnApplications(params: {
    accountId: string
    clusterId: string
    limit?: number
    windowStart?: number
    windowEnd?: number
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting YARN applications for EMR cluster', { 
      accountId: params.accountId,
      clusterId: params.clusterId
    })

    try {
      // First get cluster info to get master DNS
      const clusterInfo = await this.describeCluster({
        accountId: params.accountId,
        clusterId: params.clusterId
      }, accounts)

      if (!clusterInfo.cluster.masterPublicDnsName) {
        throw createError('Cluster does not have a public DNS name. Timeline Server access requires a running cluster with public DNS.', 400)
      }

      const masterDns = clusterInfo.cluster.masterPublicDnsName
      const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION`
      
      // Build query parameters
      const queryParams = new URLSearchParams()
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.windowStart) queryParams.append('windowStart', params.windowStart.toString())
      if (params.windowEnd) queryParams.append('windowEnd', params.windowEnd.toString())
      
      const fullUrl = queryParams.toString() ? `${timelineUrl}?${queryParams}` : timelineUrl

      logger.info('Fetching YARN applications from Timeline Server', { 
        url: fullUrl,
        clusterId: params.clusterId
      })

      // Use fetch with AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Timeline Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as any
      
      const applications = data.entities?.map((app: any) => ({
        id: app.entity,
        type: app.entitytype,
        startTime: app.starttime ? new Date(app.starttime).toISOString() : null,
        events: app.events?.map((event: any) => ({
          eventType: event.eventtype,
          timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : null,
          eventInfo: event.eventinfo
        })) || [],
        primaryFilters: app.primaryfilters || {},
        otherInfo: app.otherinfo || {},
        relatedEntities: app.relatedentities || {}
      })) || []

      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', true)

      return {
        success: true,
        clusterId: params.clusterId,
        masterDns: masterDns,
        applications,
        count: applications.length,
        timelineServerUrl: timelineUrl,
        queryParams: {
          limit: params.limit,
          windowStart: params.windowStart,
          windowEnd: params.windowEnd
        }
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', false)
      logger.error('Failed to get YARN applications from Timeline Server', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        error: error.message
      })
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw createError('Unable to connect to YARN Timeline Server. Ensure the cluster is running and Timeline Server is accessible on port 8188.', 503)
      } else if (error.message.includes('timeout')) {
        throw createError('Timeline Server request timed out. The server may be overloaded or unresponsive.', 504)
      } else {
        throw createError(`Failed to get YARN applications: ${error.message}`, 500)
      }
    }
  }

  /**
   * Get specific YARN application details from Timeline Server
   */
  async getYarnApplicationDetails(params: {
    accountId: string
    clusterId: string
    applicationId: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Getting YARN application details', { 
      accountId: params.accountId,
      clusterId: params.clusterId,
      applicationId: params.applicationId
    })

    try {
      // First get cluster info to get master DNS
      const clusterInfo = await this.describeCluster({
        accountId: params.accountId,
        clusterId: params.clusterId
      }, accounts)

      if (!clusterInfo.cluster.masterPublicDnsName) {
        throw createError('Cluster does not have a public DNS name', 400)
      }

      const masterDns = clusterInfo.cluster.masterPublicDnsName
      const timelineUrl = `http://${masterDns}:8188/ws/v1/timeline/YARN_APPLICATION/${params.applicationId}`

      // Use fetch with AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(timelineUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          throw createError(`Application ${params.applicationId} not found in Timeline Server`, 404)
        }
        throw new Error(`Timeline Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', true)

      return {
        success: true,
        clusterId: params.clusterId,
        applicationId: params.applicationId,
        application: data
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 'yarn:TimelineServer', false)
      logger.error('Failed to get YARN application details', { 
        accountId: params.accountId,
        clusterId: params.clusterId,
        applicationId: params.applicationId,
        error: error.message
      })
      
      throw createError(`Failed to get application details: ${error.message}`, error.statusCode || 500)
    }
  }
}
