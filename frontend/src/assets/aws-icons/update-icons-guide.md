# How to Update All AWS Icons to Support PNG

## Quick Setup

1. **Upload PNG files** to `frontend/src/assets/aws-icons/` with these exact names:
   - `sqs.png` ✅ (already configured)
   - `lambda.png`
   - `s3.png`
   - `dynamodb.png`
   - `apigateway.png`
   - `cloudwatch.png`
   - `emr.png`

2. **Update each icon component** to use the AWSIconWrapper pattern like SQSIcon.tsx

## Example: Converting LambdaIcon.tsx

Replace the existing LambdaIcon component with:

```tsx
import React from 'react'
import AWSIconWrapper from './AWSIconWrapper'

interface LambdaIconProps {
  size?: number
  className?: string
}

const LambdaIcon: React.FC<LambdaIconProps> = ({ size = 24, className = '' }) => {
  const fallbackSVG = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Your existing SVG content here */}
    </svg>
  )

  return (
    <AWSIconWrapper
      iconName="lambda"
      size={size}
      className={className}
      fallbackSVG={fallbackSVG}
      alt="AWS Lambda"
    />
  )
}

export default LambdaIcon
```

## Benefits

- **Automatic fallback**: If PNG is missing, shows SVG
- **Better quality**: PNG icons look more professional
- **Consistent**: All icons work the same way
- **Easy maintenance**: Just drop PNG files in the folder

## Testing

1. Upload a PNG file (e.g., `lambda.png`)
2. Refresh the page - should show PNG
3. Remove the PNG file - should show SVG fallback
4. Add PNG back - should show PNG again

The system automatically detects and switches between PNG and SVG based on availability.
