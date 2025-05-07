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
    <div className={`relative border border-border rounded-md bg-muted ${className}`}>
      <div className="absolute top-0 right-4 transform bg-muted px-1 border-border border-l border-b border-r text-sm md:text-base text-muted-foreground">
        {title}
      </div>
      <div className="absolute inset-0 font-mono text-sm p-4 overflow-auto">
        {content}
      </div>
    </div>
  )
}

export default LabelContainer
