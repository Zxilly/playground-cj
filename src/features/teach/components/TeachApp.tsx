'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { TeachConfigWizard } from './TeachConfigWizard'
import { TeachLanding } from './TeachLanding'
import { TeachWorkspace } from './TeachWorkspace'

export type { WorkspaceCollaborators }

type TeachStage = 'landing' | 'config' | 'workspace'

export interface TeachAppContentProps {
  lang: string
  collaborators: WorkspaceCollaborators
}

const ONBOARDED_KEY = 'teach:onboarded'

function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  }
  catch {
    return false
  }
}

function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  }
  catch {
    // Storage can be unavailable in private browsing; onboarding remains usable.
  }
}

/** Orchestrates onboarding around one already-opened AI Classroom runtime. */
export function TeachAppContent({ lang, collaborators }: TeachAppContentProps) {
  const [stage, setStage] = useState<TeachStage>(() => (hasOnboarded() ? 'workspace' : 'landing'))

  return (
    <WorkspaceProvider lang={lang === 'en' ? 'en' : 'zh'} {...collaborators}>
      {stage === 'landing' && <TeachLanding onStart={() => setStage('config')} />}
      {stage === 'config' && (
        <TeachConfigWizard
          onEnter={() => {
            markOnboarded()
            setStage('workspace')
          }}
          onBack={() => setStage('landing')}
        />
      )}
      {stage === 'workspace' && (
        <>
          <TeachWorkspace lang={lang} />
          <QuotaExhaustedDialog />
        </>
      )}
    </WorkspaceProvider>
  )
}

function TeachAppLoading() {
  return (
    <div
      data-testid="teach-app-loading"
      className="h-full bg-background"
    />
  )
}

export interface TeachAppProps {
  lang: string
}

/** Browser-only boundary: collaborators depend on IndexedDB and Monaco. */
const TeachApp = dynamic(() => import('./TeachAppRoot'), {
  ssr: false,
  loading: TeachAppLoading,
})

export default TeachApp
