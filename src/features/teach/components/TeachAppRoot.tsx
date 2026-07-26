'use client'

import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { createWorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { TeachAppContent } from './TeachApp'

type RuntimeState
  = | { status: 'loading' }
    | { status: 'ready', collaborators: WorkspaceCollaborators }
    | { status: 'error', message: string }

function disposeInBackground(
  collaborators: WorkspaceCollaborators | null,
  context: string,
): void {
  if (!collaborators)
    return
  void collaborators.dispose().catch((error: unknown) => {
    console.error(`[ai-classroom] ${context}`, error)
  })
}

function TeachAppRuntime({ locale }: { locale: 'en' | 'zh' }) {
  const [generation, setGeneration] = useState(0)
  const [runtime, setRuntime] = useState<RuntimeState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let collaborators: WorkspaceCollaborators | null = null
    useWorkspaceStore.getState().reset()
    void createWorkspaceCollaborators(locale, {
      signal: controller.signal,
      onStorageError: (error) => {
        if (active) {
          disposeInBackground(collaborators, 'failed to dispose after a storage error')
          setRuntime({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
    }).then((created) => {
      collaborators = created
      if (!active) {
        disposeInBackground(created, 'failed to dispose an obsolete runtime')
        return
      }
      setRuntime({ status: 'ready', collaborators: created })
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        setRuntime({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })
    return () => {
      active = false
      controller.abort()
      disposeInBackground(collaborators, 'failed to dispose the workspace runtime')
    }
  }, [generation, locale])

  const retry = useCallback(() => {
    setRuntime({ status: 'loading' })
    setGeneration(value => value + 1)
  }, [])

  if (runtime.status === 'loading')
    return <div data-testid="teach-app-loading" className="h-full bg-background" />

  if (runtime.status === 'error') {
    return (
      <div
        data-testid="teach-hydration-error"
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center"
      >
        <TriangleAlert aria-hidden="true" className="size-8 text-amber-500" />
        <div className="max-w-md">
          <h1 className="text-lg font-semibold">
            {locale === 'en' ? 'Unable to open AI Classroom' : '无法打开 AI 课堂'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {locale === 'en'
              ? 'The validated curriculum or local classroom state could not be loaded. Nothing was partially migrated or silently discarded.'
              : '已验证课程或本地课堂状态无法读取；系统没有做部分迁移，也没有静默丢弃数据。'}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{runtime.message}</p>
        </div>
        <Button type="button" variant="outline" onClick={retry}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {locale === 'en' ? 'Retry' : '重试'}
        </Button>
      </div>
    )
  }

  return <TeachAppContent lang={locale} collaborators={runtime.collaborators} />
}

export default function TeachAppRoot({ lang }: { lang: string }) {
  const locale = lang === 'en' ? 'en' : 'zh'
  return <TeachAppRuntime key={locale} locale={locale} />
}
