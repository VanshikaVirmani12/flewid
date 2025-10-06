import React from 'react'
import AWSIconWrapper from './AWSIconWrapper'

interface EMRIconProps {
  className?: string
  size?: number
}

const EMRIcon: React.FC<EMRIconProps> = ({ className = '', size = 24 }) => {
  const fallbackSVG = (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="emr-gradient" x1="0%" y1="100%" y2="0%">
          <stop offset="0" stopColor="#7b2cbf"/>
          <stop offset="1" stopColor="#9d4edd"/>
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <path d="M0 0h80v80H0z" fill="url(#emr-gradient)"/>
        <g fill="#fff" stroke="#fff">
          {/* Official AWS EMR logo - network cluster with central plus */}
          
          {/* Central node with plus sign */}
          <circle cx="40" cy="40" r="8" fill="#fff" stroke="none"/>
          <path d="M36 40h8M40 36v8" stroke="#7b2cbf" strokeWidth="2" strokeLinecap="round"/>
          
          {/* Outer nodes */}
          <circle cx="40" cy="20" r="5" fill="none" strokeWidth="2"/>
          <circle cx="58" cy="30" r="5" fill="none" strokeWidth="2"/>
          <circle cx="58" cy="50" r="5" fill="none" strokeWidth="2"/>
          <circle cx="40" cy="60" r="5" fill="none" strokeWidth="2"/>
          <circle cx="22" cy="50" r="5" fill="none" strokeWidth="2"/>
          <circle cx="22" cy="30" r="5" fill="none" strokeWidth="2"/>
          
          {/* Connection lines */}
          <path d="M40 28L40 32" strokeWidth="2"/>
          <path d="M48 40L53 35" strokeWidth="2"/>
          <path d="M48 40L53 45" strokeWidth="2"/>
          <path d="M40 48L40 52" strokeWidth="2"/>
          <path d="M32 40L27 45" strokeWidth="2"/>
          <path d="M32 40L27 35" strokeWidth="2"/>
          
          {/* Cross connections */}
          <path d="M45 33L53 35" strokeWidth="1.5" opacity="0.7"/>
          <path d="M45 47L53 45" strokeWidth="1.5" opacity="0.7"/>
          <path d="M35 47L27 45" strokeWidth="1.5" opacity="0.7"/>
          <path d="M35 33L27 35" strokeWidth="1.5" opacity="0.7"/>
        </g>
      </g>
    </svg>
  )

  return (
    <AWSIconWrapper
      iconName="emr"
      size={size}
      className={className}
      fallbackSVG={fallbackSVG}
      alt="AWS EMR"
    />
  )
}

export default EMRIcon
