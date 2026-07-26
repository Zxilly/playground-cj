'use client'

import type { ReactNode } from 'react'

interface CompareGroupProps {
  children: ReactNode
}

export function CompareGroup({ children }: CompareGroupProps) {
  return <>{children}</>
}
