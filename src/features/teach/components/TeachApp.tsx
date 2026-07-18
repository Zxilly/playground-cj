'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { TeachConfigWizard } from './TeachConfigWizard'
import { TeachLanding } from './TeachLanding'
import { TeachWorkspace } from './TeachWorkspace'

export type { WorkspaceCollaborators }

type HydrationState
  = | { status: 'loading' }
    | { status: 'ready' }
    | { status: 'error', message: string }

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

/** Hydrates the local repository, then orchestrates onboarding and workspace UI. */
export function TeachAppContent({ lang, collaborators }: TeachAppContentProps) {
  const { repo } = collaborators
  const [hydration, setHydration] = useState<HydrationState>({ status: 'loading' })
  const [stage, setStage] = useState<TeachStage>(() => (hasOnboarded() ? 'workspace' : 'landing'))
  const [probeToken, setProbeToken] = useState(0)

  useEffect(() => {
    let active = true
    void repo
      .getMission()
      .then(() => {
        if (active)
          setHydration({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (active)
          setHydration({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      active = false
    }
  }, [repo, probeToken])

  const retry = useCallback(() => {
    setHydration({ status: 'loading' })
    setProbeToken(token => token + 1)
  }, [])

  if (hydration.status === 'loading')
    return <TeachAppLoading />

  if (hydration.status === 'error') {
    return (
      <div
        data-testid="teach-hydration-error"
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-5 bg-background p-8 text-center"
      >
        <span className="grid size-11 place-items-center rounded-md border border-border text-amber-600 dark:text-amber-300">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <div className="flex max-w-md flex-col gap-1.5">
          <h1 className="text-lg font-semibold text-foreground">
            <Trans>无法打开课堂</Trans>
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            <Trans>读取本地工作区数据失败。可以重试，或刷新页面。如果一直失败，可能是浏览器存储被禁用或损坏。</Trans>
          </p>
          <p className="mt-1 break-words font-mono text-xs text-muted-foreground/75">{hydration.message}</p>
        </div>
        <Button type="button" variant="outline" onClick={retry} data-testid="teach-hydration-retry">
          <RotateCcw aria-hidden="true" className="size-4" />
          <Trans>重试</Trans>
        </Button>
      </div>
    )
  }

  return (
    <WorkspaceProvider {...collaborators}>
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
