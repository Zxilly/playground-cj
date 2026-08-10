'use client'

import { useMemo } from 'react'
import { useMachine } from '@xstate/react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createWorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { usePlaygroundSession } from '@/features/teach/state/playground-session'
import { createTeachRuntimeMachine } from '@/features/teach/state/teach-runtime-machine'
import { TeachAppContent } from './TeachApp'
import { TeachLoadingState } from './TeachLoadingState'

function TeachAppRuntime({ locale }: { locale: 'en' | 'zh' }) {
  const machine = useMemo(() => createTeachRuntimeMachine({
    locale,
    open: createWorkspaceCollaborators,
    resetWorkspace: () => {
      useWorkspaceStore.getState().reset()
      usePlaygroundSession.getState().resetTransient()
    },
    reportDisposeError: (error, context) => {
      console.error(`[ai-classroom] ${context}`, error)
    },
  }), [locale])
  const [runtime, send] = useMachine(machine)

  if (runtime.matches('loading'))
    return <TeachLoadingState />

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
              ? 'The local classroom workspace could not be opened. Your stored data was left unchanged.'
              : '无法打开本地课堂工作区；已有数据保持原样。'}
          </p>
          <details className="mt-3 text-start text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              {locale === 'en' ? 'Technical details' : '技术详情'}
            </summary>
            <p className="mt-2 break-words font-mono">{runtime.context.message}</p>
          </details>
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
