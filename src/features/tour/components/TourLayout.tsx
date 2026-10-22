'use client'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { ReactNode } from 'react'

interface TourLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

export function TourLayout({ sidebar, children }: TourLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false} className="min-h-0">
      {sidebar}
      <SidebarInset className="h-dvh overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
