import type { ReactNode } from 'react'

interface LabelContainerProps {
  title: string
  content: ReactNode
  className?: string
}

export default function LabelContainer({ title, content, className = '' }: LabelContainerProps) {
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
