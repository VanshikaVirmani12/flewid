import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { logger } from '../../utils/logger'
import { createError } from '../../middleware/errorHandler'

export interface TransformationSuggestion {
  confidence: number
  description: string
  code: string
  reasoning: string
  expectedOutput?: any
  inputDataSource?: string
}

export interface AITransformParams {
  userIntent: string
  sourceNodeType: string
  targetNodeType: string
  sampleData: any
  workflowContext?: any
}

export class BedrockTransformService {
  private client: BedrockRuntimeClient
  private modelId: string
  private fallbackModelId: string
  private maxRetries: number

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1'
    })
    
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    this.fallbackModelId = process.env.BEDROCK_FALLBACK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0'
    this.maxRetries = parseInt(process.env.AI_MAX_RETRIES || '3')
  }

  /**
   * Generate AI transformation suggestions
   */
  async generateTransformation(params: AITransformParams): Promise<TransformationSuggestion[]> {
    logger.info('Generating AI transformation with Bedrock', {
      sourceType: params.sourceNodeType,
      targetType: params.targetNodeType,
      userIntent: params.userIntent?.substring(0, 100)
    })

    try {
      // Try primary model first
      const suggestions = await this.invokeModel(this.modelId, params)
      return suggestions
    } catch (error: any) {
      logger.warn('Primary model failed, trying fallback', { 
        primaryModel: this.modelId,
        error: error.message 
      })
      
      try {
        // Fallback to faster/cheaper model
        const suggestions = await this.invokeModel(this.fallbackModelId, params)
        return suggestions
      } catch (fallbackError: any) {
        logger.error('Both Bedrock models failed', { 
          primaryError: error.message,
          fallbackError: fallbackError.message 
        })
        throw createError(`AI transformation generation failed: ${fallbackError.message}`, 500)
      }
    }
  }

  /**
   * Invoke Bedrock model with retry logic
   */
  private async invokeModel(modelId: string, params: AITransformParams): Promise<TransformationSuggestion[]> {
    const prompt = this.buildPrompt(params)
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const command = new InvokeModelCommand({
          modelId: modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2500,
            temperature: 0.3,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        })

        const response = await this.client.send(command)
        const responseBody = JSON.parse(new TextDecoder().decode(response.body))
        
        if (!responseBody.content || !responseBody.content[0]) {
          throw new Error('Invalid response format from Bedrock')
        }

        const generatedText = responseBody.content[0].text
        return this.parseAIResponse(generatedText, params)

      } catch (error: any) {
        logger.warn(`Bedrock invocation attempt ${attempt} failed`, { 
          modelId, 
          error: error.message 
        })
        
        if (attempt === this.maxRetries) {
          throw error
        }
        
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000)
      }
    }

    throw new Error('All retry attempts failed')
  }

  /**
   * Build the prompt for Bedrock
   */
  private buildPrompt(params: AITransformParams): string {
    const systemContext = this.getSystemContext()
    const serviceContext = this.getServiceContext(params.sourceNodeType, params.targetNodeType)
    const exampleCode = this.getExampleCode(params.sourceNodeType, params.targetNodeType)

    return `${systemContext}

${serviceContext}

User Request: "${params.userIntent}"

Source Service: ${params.sourceNodeType}
Target Service: ${params.targetNodeType}

Sample Input Data:
\`\`\`json
${JSON.stringify(params.sampleData, null, 2)}
\`\`\`

${exampleCode}

Generate JavaScript transformation code that:
1. Processes the input data according to the user's intent
2. Outputs data optimized for the target AWS service
3. Includes proper error handling and edge cases
4. Uses the available utility functions efficiently
5. Follows AWS service best practices

Respond with a JSON object in this exact format:
\`\`\`json
{
  "code": "// Complete JavaScript transformation code here",
  "explanation": "Clear explanation of what the code does and why",
  "confidence": 0.9,
  "optimizations": ["List of optimizations applied"],
  "assumptions": ["Any assumptions made about the data"],
  "inputDataSource": "{{nodeId.extractedData}} - suggested input data source reference"
}
\`\`\`

Important: Only return the JSON object, no additional text.`
  }

  /**
   * Get system context for AWS transformations
   */
  private getSystemContext(): string {
    return `You are an expert AWS data transformation engineer. You specialize in creating efficient, robust JavaScript code for transforming data between AWS services.

Available Utility Functions:
- extractPattern(text, regex, flags?) - Extract regex patterns from text
- parseJSON(text) - Safe JSON parsing with error handling
- filterArray(arr, condition) - Filter arrays with string conditions
- groupBy(arr, key) - Group array elements by key
- sortBy(arr, key, order?) - Sort arrays by key (asc/desc)
- unique(arr, key?) - Get unique values from array
- sum(arr, key?) - Sum numeric values
- count(arr, predicate?) - Count elements matching predicate
- flatten(arr, depth?) - Flatten nested arrays
- formatDate(date, format) - Format dates (iso, date, time)
- slugify(text) - Convert text to URL-friendly slug
- capitalize(text) - Capitalize first letter

Built-in Objects:
- Math (round, floor, ceil, min, max, abs, random)
- Date (now, parse)`
  }

  /**
   * Get service-specific context
   */
  private getServiceContext(sourceType: string, targetType: string): string {
    const contexts = {
      sqs: 'SQS messages have body (JSON string), attributes (metadata), messageId, receiptHandle',
      cloudwatch: 'CloudWatch expects metrics with MetricName, Value, Unit, Dimensions array',
      dynamodb: 'DynamoDB items are key-value objects, consider partition/sort keys for queries',
      s3: 'S3 objects have keys, sizes, lastModified timestamps, consider prefix patterns',
      lambda: 'Lambda responses have statusCode, payload (JSON string), headers',
      sns: 'SNS messages have Subject, Message, MessageAttributes',
      emr: 'EMR clusters have clusterId, state, steps array, applications array'
    }

    return `Service Context:
Source (${sourceType}): ${contexts[sourceType.toLowerCase()] || 'Generic AWS service data'}
Target (${targetType}): ${contexts[targetType.toLowerCase()] || 'Generic AWS service data'}`
  }

  /**
   * Get example code for common transformations
   */
  private getExampleCode(sourceType: string, targetType: string): string {
    const key = `${sourceType.toLowerCase()}_to_${targetType.toLowerCase()}`
    
    const examples = {
      sqs_to_cloudwatch: `Example Pattern:
\`\`\`javascript
const messages = data.messages || []
const errorMessages = filterArray(messages, 'body contains "ERROR"')
return {
  customMetrics: [{
    MetricName: 'ErrorCount',
    Value: errorMessages.length,
    Unit: 'Count',
    Dimensions: [{ Name: 'Source', Value: 'SQS' }]
  }]
}
\`\`\``,
      
      cloudwatch_to_dynamodb: `Example Pattern:
\`\`\`javascript
const events = data.events || []
const userActivities = events.map(event => ({
  userId: extractPattern(event.message, 'user_id: ([a-zA-Z0-9-]+)')[0],
  timestamp: formatDate(event.timestamp, 'iso'),
  action: extractPattern(event.message, 'action: ([a-zA-Z_]+)')[0]
})).filter(activity => activity.userId)

return { dynamoDBItems: userActivities }
\`\`\``
    }

    return examples[key] || 'No specific example available - use general AWS transformation patterns.'
  }

  /**
   * Parse AI response and create suggestions
   */
  private parseAIResponse(response: string, params: AITransformParams): TransformationSuggestion[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      
      if (!parsed.code) {
        throw new Error('No code found in parsed response')
      }

      const suggestion: TransformationSuggestion = {
        confidence: parsed.confidence || 0.8,
        description: `AI-generated ${params.sourceNodeType} to ${params.targetNodeType} transformation`,
        code: parsed.code,
        reasoning: this.buildReasoning(parsed, params),
        expectedOutput: this.predictOutput(parsed.code, params.sampleData),
        inputDataSource: parsed.inputDataSource || this.generateInputDataSource(params.sourceNodeType)
      }

      return [suggestion]

    } catch (error: any) {
      logger.error('Failed to parse AI response', { 
        error: error.message,
        response: response.substring(0, 500)
      })
      
      // Fallback parsing for non-JSON responses
      return this.fallbackParsing(response, params)
    }
  }

  /**
   * Build reasoning explanation
   */
  private buildReasoning(parsed: any, params: AITransformParams): string {
    let reasoning = parsed.explanation || 'AI-generated transformation code'
    
    if (parsed.optimizations && parsed.optimizations.length > 0) {
      reasoning += `\n\nOptimizations applied:\n${parsed.optimizations.map((opt: string) => `• ${opt}`).join('\n')}`
    }
    
    if (parsed.assumptions && parsed.assumptions.length > 0) {
      reasoning += `\n\nAssumptions:\n${parsed.assumptions.map((assumption: string) => `• ${assumption}`).join('\n')}`
    }

    return reasoning
  }

  /**
   * Predict output structure (simplified)
   */
  private predictOutput(code: string, sampleData: any): any {
    try {
      // Simple pattern matching to predict output structure
      if (code.includes('customMetrics')) {
        return { customMetrics: [{ MetricName: 'Example', Value: 1, Unit: 'Count' }] }
      }
      if (code.includes('dynamoDBItems')) {
        return { dynamoDBItems: [{ id: 'example', timestamp: new Date().toISOString() }] }
      }
      if (code.includes('s3Objects')) {
        return { s3Objects: [{ key: 'example.json', size: 1024 }] }
      }
      
      return { transformedData: 'Output structure will depend on your specific data' }
    } catch (error) {
      return { note: 'Output prediction not available' }
    }
  }

  /**
   * Fallback parsing for non-JSON responses
   */
  private fallbackParsing(response: string, params: AITransformParams): TransformationSuggestion[] {
    logger.warn('Using fallback parsing for AI response')
    
    // Extract code blocks
    const codeMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/)
    
    if (codeMatch) {
      return [{
        confidence: 0.6,
        description: `Fallback ${params.sourceNodeType} to ${params.targetNodeType} transformation`,
        code: codeMatch[1],
        reasoning: 'Generated using fallback parsing - please review carefully'
      }]
    }

    throw new Error('Could not extract transformation code from AI response')
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate input data source suggestion based on source node type
   */
  private generateInputDataSource(sourceNodeType: string): string {
    const sourceMap: Record<string, string> = {
      sqs: '{{sqs-node-1.extractedData}}',
      cloudwatch: '{{cloudwatch-node-1.extractedData}}',
      dynamodb: '{{dynamodb-node-1.extractedData}}',
      s3: '{{s3-node-1.extractedData}}',
      lambda: '{{lambda-node-1.extractedData}}',
      sns: '{{sns-node-1.extractedData}}',
      emr: '{{emr-node-1.extractedData}}',
      apigateway: '{{apigateway-node-1.extractedData}}',
      athena: '{{athena-node-1.extractedData}}'
    }
    
    return sourceMap[sourceNodeType.toLowerCase()] || `{{${sourceNodeType.toLowerCase()}-node-1.extractedData}}`
  }

  /**
   * Validate transformation code (basic syntax check)
   */
  validateTransformationCode(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    try {
      // Basic syntax validation
      new Function(code)
      
      // Check for required patterns
      if (!code.includes('return')) {
        errors.push('Code must include a return statement')
      }
      
      // Check for dangerous patterns
      const dangerousPatterns = ['eval(', 'Function(', 'setTimeout(', 'setInterval(']
      dangerousPatterns.forEach(pattern => {
        if (code.includes(pattern)) {
          errors.push(`Potentially dangerous pattern detected: ${pattern}`)
        }
      })
      
    } catch (syntaxError: any) {
      errors.push(`Syntax error: ${syntaxError.message}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
