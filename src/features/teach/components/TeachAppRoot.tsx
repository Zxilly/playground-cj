'use client'

import { useEffect } from 'react'
import { useMachine } from '@xstate/react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { createWorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { teachRuntimeMachine } from '@/features/teach/state/teach-runtime-machine'
import { TeachAppContent } from './TeachApp'

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
  const [runtime, send] = useMachine(teachRuntimeMachine)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let storageFailed = false
    let collaborators: WorkspaceCollaborators | null = null
    useWorkspaceStore.getState().reset()
    void createWorkspaceCollaborators(locale, {
      signal: controller.signal,
      onStorageError: (error) => {
        if (active) {
          storageFailed = true
          disposeInBackground(collaborators, 'failed to dispose after a storage error')
          send({
            type: 'storage.failed',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
    }).then((created) => {
      collaborators = created
      if (!active || storageFailed) {
        disposeInBackground(created, 'failed to dispose an obsolete runtime')
        return
      }
      send({ type: 'open.succeeded', collaborators: created })
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        send({
          type: 'open.failed',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })
    return () => {
      active = false
      controller.abort()
      disposeInBackground(collaborators, 'failed to dispose the workspace runtime')
    }
  }, [runtime.context.generation, locale, send])

  if (runtime.matches('loading'))
    return <div data-testid="teach-app-loading" className="h-full bg-background" />

  if (runtime.matches('error')) {
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
          <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{runtime.context.message}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => send({ type: 'retry' })}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {locale === 'en' ? 'Retry' : '重试'}
        </Button>
      </div>
    )
  }

  const collaborators = runtime.context.collaborators
  if (!collaborators)
    throw new Error('Ready Teach runtime is missing its collaborators.')

  return (
    <TeachAppContent
      lang={locale}
      collaborators={collaborators}
    />
  )
}

export default function TeachAppRoot({ lang }: { lang: string }) {
  const locale = lang === 'en' ? 'en' : 'zh'
  return <TeachAppRuntime key={locale} locale={locale} />
}
