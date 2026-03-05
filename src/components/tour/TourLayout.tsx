'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import type { ReactNode } from 'react'

interface TourLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

export function TourLayout({ sidebar, children }: TourLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      {sidebar}
      <SidebarInset className="h-screen overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
