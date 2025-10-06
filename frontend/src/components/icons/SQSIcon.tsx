import React from 'react'
import AWSIconWrapper from './AWSIconWrapper'

interface SQSIconProps {
  size?: number
  className?: string
}

const SQSIcon: React.FC<SQSIconProps> = ({ size = 24, className = '' }) => {
  const fallbackSVG = (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* AWS SQS Official Icon - Orange background */}
      <rect width="80" height="80" rx="4" fill="#FF9900"/>
      
      {/* Queue representation - white lines */}
      <g fill="white">
        {/* Top queue item */}
        <rect x="16" y="20" width="48" height="8" rx="2"/>
        
        {/* Middle queue item */}
        <rect x="16" y="32" width="48" height="8" rx="2"/>
        
        {/* Bottom queue item */}
        <rect x="16" y="44" width="48" height="8" rx="2"/>
        
        {/* Arrow indicating message flow */}
        <path d="M20 60 L28 56 L28 58 L36 58 L36 62 L28 62 L28 64 Z"/>
        
        {/* Message dots */}
        <circle cx="44" cy="60" r="2"/>
        <circle cx="52" cy="60" r="2"/>
        <circle cx="60" cy="60" r="2"/>
      </g>
    </svg>
  )

  return (
    <AWSIconWrapper
      iconName="sqs"
      size={size}
      className={className}
      fallbackSVG={fallbackSVG}
      alt="AWS SQS"
    />
  )
}

export default SQSIcon
