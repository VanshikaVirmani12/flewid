import React from 'react'

interface SQSIconProps {
  size?: number
  className?: string
}

const SQSIcon: React.FC<SQSIconProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* SQS Queue representation */}
      <rect
        x="2"
        y="6"
        width="20"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.8"
      />
      <rect
        x="2"
        y="10.5"
        width="20"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.6"
      />
      <rect
        x="2"
        y="15"
        width="20"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.4"
      />
      
      {/* Arrow indicating message flow */}
      <path
        d="M18 4L20 6L18 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4 6H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export default SQSIcon
