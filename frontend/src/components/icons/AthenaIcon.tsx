import React from 'react'
import AWSIconWrapper from './AWSIconWrapper'

interface AthenaIconProps {
  size?: number
  className?: string
}

const AthenaIcon: React.FC<AthenaIconProps> = ({ size = 24, className = '' }) => {
  const fallbackSVG = (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* AWS Athena Official Icon - Orange background */}
      <rect width="80" height="80" rx="4" fill="#FF9900"/>
      
      {/* Athena query/analytics representation - white elements */}
      <g fill="white">
        {/* Database/table icon */}
        <rect x="12" y="16" width="56" height="8" rx="2"/>
        <rect x="12" y="28" width="56" height="4" rx="1"/>
        <rect x="12" y="36" width="56" height="4" rx="1"/>
        <rect x="12" y="44" width="56" height="4" rx="1"/>
        
        {/* Query/search magnifying glass */}
        <circle cx="52" cy="58" r="8" stroke="white" strokeWidth="3" fill="none"/>
        <path d="M58 64 L66 72" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        
        {/* Data flow arrows */}
        <path d="M20 56 L28 52 L28 54 L36 54 L36 58 L28 58 L28 60 Z"/>
      </g>
    </svg>
  )

  return (
    <AWSIconWrapper
      iconName="athena"
      size={size}
      className={className}
      fallbackSVG={fallbackSVG}
      alt="AWS Athena"
    />
  )
}

export default AthenaIcon
