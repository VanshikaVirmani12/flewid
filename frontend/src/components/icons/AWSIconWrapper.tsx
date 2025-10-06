import React, { useState } from 'react'

interface AWSIconWrapperProps {
  iconName: string
  size?: number
  className?: string
  fallbackSVG: React.ReactNode
  alt: string
}

const AWSIconWrapper: React.FC<AWSIconWrapperProps> = ({ 
  iconName, 
  size = 24, 
  className = '', 
  fallbackSVG, 
  alt 
}) => {
  const [imageError, setImageError] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  if (!imageError) {
    return (
      <img
        src={`/src/assets/aws-icons/${iconName}.png`}
        alt={alt}
        width={size}
        height={size}
        className={className}
        onError={handleImageError}
        style={{ objectFit: 'contain' }}
      />
    )
  }

  // Return fallback SVG with proper sizing
  return (
    <div 
      className={className} 
      style={{ width: size, height: size, display: 'inline-block' }}
    >
      {React.cloneElement(fallbackSVG as React.ReactElement, { 
        width: size, 
        height: size 
      })}
    </div>
  )
}

export default AWSIconWrapper
