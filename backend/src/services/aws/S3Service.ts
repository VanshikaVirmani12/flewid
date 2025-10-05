import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { BaseAWSService } from './BaseAWSService'
import { AWSAccount } from '../AWSCredentialService'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export class S3Service extends BaseAWSService {
  /**
   * List S3 objects (mock implementation for now)
   */
  async listObjects(params: any): Promise<any> {
    logger.info('Listing S3 objects', { params })
    
    // Mock implementation
    return {
      objects: [
        {
          key: 'logs/2024/01/15/app.log',
          size: 1024,
          lastModified: new Date().toISOString()
        },
        {
          key: 'logs/2024/01/15/error.log',
          size: 512,
          lastModified: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Get S3 object (mock implementation for now)
   */
  async getObject(params: any): Promise<any> {
    logger.info('Getting S3 object', { params })
    
    // Mock implementation
    return {
      content: 'Sample S3 object content',
      contentType: 'text/plain',
      size: 1024
    }
  }

  /**
   * Explore S3 location - determine if it's a folder or object and return appropriate data
   */
  async exploreLocation(params: {
    accountId: string
    s3Location: string
  }, accounts: Map<string, AWSAccount>): Promise<any> {
    logger.info('Exploring S3 location', { 
      accountId: params.accountId,
      s3Location: params.s3Location
    })

    try {
      // Parse S3 location
      const s3Url = params.s3Location.startsWith('s3://') ? params.s3Location : `s3://${params.s3Location}`
      const urlParts = s3Url.replace('s3://', '').split('/')
      const bucket = urlParts[0]
      const key = urlParts.slice(1).join('/')

      if (!bucket) {
        throw createError('Invalid S3 location: bucket name is required', 400)
      }

      const credentials = await this.getCredentials(params.accountId, accounts)
      
      // Create S3 client
      const client = new S3Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      })

      // First, try to check if it's an object by attempting to get its metadata
      if (key && !key.endsWith('/')) {
        try {
          const headCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: key
          })
          
          // Just get metadata, not the actual content
          const headResponse = await client.send(headCommand)
          
          this.credentialService.auditCredentialUsage(params.accountId, 's3:GetObject', true)

          // It's an object, return object details
          return {
            success: true,
            type: 'object',
            object: {
              bucket: bucket,
              key: key,
              size: headResponse.ContentLength,
              lastModified: headResponse.LastModified?.toISOString(),
              etag: headResponse.ETag?.replace(/"/g, ''),
              contentType: headResponse.ContentType,
              storageClass: headResponse.StorageClass,
              metadata: headResponse.Metadata || {}
            }
          }
        } catch (error: any) {
          // If GetObject fails, it might be a folder or the object doesn't exist
          // Continue to list objects
          logger.info('Object not found, treating as folder', { bucket, key })
        }
      }

      // It's a folder (bucket root or prefix), list contents
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: key || '',
        Delimiter: '/',
        MaxKeys: 1000
      })

      const listResponse = await client.send(listCommand)
      
      this.credentialService.auditCredentialUsage(params.accountId, 's3:ListObjectsV2', true)

      const items: any[] = []

      // Add folders (common prefixes)
      if (listResponse.CommonPrefixes) {
        listResponse.CommonPrefixes.forEach(prefix => {
          if (prefix.Prefix) {
            const folderName = prefix.Prefix.replace(key || '', '').replace('/', '')
            if (folderName) {
              items.push({
                name: folderName,
                type: 'folder',
                fullPath: `s3://${bucket}/${prefix.Prefix}`
              })
            }
          }
        })
      }

      // Add objects
      if (listResponse.Contents) {
        listResponse.Contents.forEach(object => {
          if (object.Key && object.Key !== (key || '')) {
            const objectName = object.Key.replace(key || '', '').replace(/^\//, '')
            if (objectName && !objectName.includes('/')) {
              items.push({
                name: objectName,
                type: 'object',
                size: object.Size,
                lastModified: object.LastModified?.toISOString(),
                etag: object.ETag?.replace(/"/g, ''),
                storageClass: object.StorageClass,
                fullPath: `s3://${bucket}/${object.Key}`
              })
            }
          }
        })
      }

      // Sort items: folders first, then objects, both alphabetically
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return {
        success: true,
        type: 'folder',
        bucket: bucket,
        prefix: key || '',
        items: items,
        truncated: listResponse.IsTruncated || false,
        nextContinuationToken: listResponse.NextContinuationToken
      }

    } catch (error: any) {
      this.credentialService.auditCredentialUsage(params.accountId, 's3:Explore', false)
      logger.error('Failed to explore S3 location', { 
        accountId: params.accountId,
        s3Location: params.s3Location,
        error: error.message
      })
      
      // Return more specific error messages
      if (error.name === 'NoSuchBucket') {
        throw createError(`Bucket '${params.s3Location}' does not exist`, 404)
      } else if (error.name === 'AccessDenied') {
        throw createError(`Access denied to S3 location '${params.s3Location}'`, 403)
      } else if (error.name === 'InvalidBucketName') {
        throw createError(`Invalid bucket name in '${params.s3Location}'`, 400)
      } else {
        this.handleAWSError(error, 'S3 exploration', params.s3Location)
      }
    }
  }
}
