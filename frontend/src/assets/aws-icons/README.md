# AWS Icons

This folder contains PNG versions of official AWS service icons.

## Usage

The icon components will automatically try to load PNG images from this folder first, and fall back to SVG if the PNG is not available.

## Required Files

To use PNG icons, upload the following files to this folder:

- `sqs.png` - Amazon Simple Queue Service
- `lambda.png` - AWS Lambda
- `s3.png` - Amazon S3
- `dynamodb.png` - Amazon DynamoDB
- `apigateway.png` - Amazon API Gateway
- `cloudwatch.png` - Amazon CloudWatch
- `emr.png` - Amazon EMR

## Icon Requirements

- **Format**: PNG
- **Size**: Recommended 64x64px or 128x128px for best quality
- **Background**: Transparent or official AWS service color
- **Source**: Use official AWS icons from AWS Architecture Icons or AWS Console

## Where to Get Official AWS Icons

1. **AWS Architecture Icons**: https://aws.amazon.com/architecture/icons/
2. **AWS Console**: Right-click on service icons in the AWS Console and save
3. **AWS Brand Guidelines**: https://aws.amazon.com/trademark-guidelines/

## Example Usage

Once you upload `sqs.png` to this folder, the SQS icon component will automatically use it instead of the SVG fallback.

The path structure should be:
```
frontend/src/assets/aws-icons/
├── README.md
├── sqs.png
├── lambda.png
├── s3.png
├── dynamodb.png
├── apigateway.png
├── cloudwatch.png
└── emr.png
