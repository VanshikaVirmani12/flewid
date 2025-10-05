import React, { useState, useRef, useCallback, useEffect } from 'react'

interface ResizablePanelProps {
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  position?: 'left' | 'right'
  className?: string
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 800,
  position = 'right',
  className = ''
}) => {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    
    // Add cursor style to body during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = position === 'right' 
      ? startXRef.current - e.clientX 
      : e.clientX - startXRef.current
    
    const newWidth = Math.min(
      Math.max(startWidthRef.current + deltaX, minWidth),
      maxWidth
    )
    
    setWidth(newWidth)
  }, [isResizing, minWidth, maxWidth, position])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const resizeHandleStyle = position === 'right' 
    ? { left: 0, cursor: 'col-resize' }
    : { right: 0, cursor: 'col-resize' }

  return (
    <div
      ref={panelRef}
      className={`relative bg-white ${className}`}
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 transition-colors z-10 ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        style={resizeHandleStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-60" />
      </div>
      
      {/* Panel Content */}
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default ResizablePanel
