import React from 'react'

interface EmbeddedLabelContainerProps {
  title: string
  content: React.ReactNode
  className?: string
}

const LabelContainer: React.FC<EmbeddedLabelContainerProps> = ({
  title,
  content,
  className = '',
}) => {
  return (
    <div className={`relative border border-gray-300 rounded-md bg-muted ${className}`}>
      <div className="absolute top-0 right-4 transform bg-white px-1 border-l border-b border-r border-gray-300 text-sm md:text-base">
        {title}
      </div>
      <div className="absolute inset-0 font-mono text-sm p-4 overflow-auto">
        {content}
      </div>
    </div>
  )
}

export default LabelContainer
