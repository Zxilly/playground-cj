'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Download, RotateCcw, TriangleAlert, Upload } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { workspaceSnapshotSchema } from '@/lib/teach/workspace/documents'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { TeachLanding } from './TeachLanding'

export type { WorkspaceCollaborators }

type HydrationState
  = | { status: 'loading' }
    | { status: 'ready' }
    | { status: 'error', message: string }

export interface TeachAppContentProps {
  lang: string
  collaborators: WorkspaceCollaborators
}

/**
 * Trigger a browser download of `text` as a file named `filename`. Kept local so
 * the export action does not depend on a download helper from the legacy stack.
 */
function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * The hydrated teaching-workspace app: provider + shell + chat, plus the
 * export/import controls that move the whole workspace as a portable JSON
 * snapshot (the "your workspace is your file" spirit of the teach skill).
 *
 * On mount it probes the repository (a `getMission` read) to surface a storage
 * failure (e.g. IndexedDB blocked / corrupt) as a recovery UI rather than a
 * blank screen. Once ready it shows the {@link TeachLanding} onboarding wizard
 * (which runs the LLM-config bootstrap and walks the learner through picking an
 * AI source — shared key or a custom one — before letting them in once a usable
 * config is ready); entering mounts the {@link TeachWorkspaceShell} with the
 * {@link TeacherChatRuntime} as the chat region. Everything is wrapped in an
 * {@link AbortScopeProvider} and {@link WorkspaceProvider} so in-flight teacher
 * turns abort on unmount and the gate and shell share one repository.
 *
 * Exported separately from the SSR-disabled {@link TeachApp default export} so it
 * can be unit-tested with injected collaborators.
 */
export function TeachAppContent({ lang, collaborators }: TeachAppContentProps) {
  const { repo } = collaborators
  const [hydration, setHydration] = useState<HydrationState>({ status: 'loading' })
  // The landing gate sits between hydration and the workspace shell: it runs the
  // LLM config bootstrap and only lets the learner in once a usable key is ready,
  // so the teacher agent never reaches the views without a key.
  const [entered, setEntered] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const statusId = useId()

  // Bump to remount the shell subtree after an import so every view re-reads the
  // freshly-replaced repository contents.
  const [generation, setGeneration] = useState(0)
  // Bump to re-run the hydration probe (the retry button).
  const [probeToken, setProbeToken] = useState(0)

  // Probe the repository on mount (and on retry) to surface a storage failure as
  // a recovery UI. Resolution sets ready/error; the effect itself never sets
  // state synchronously (state already starts as `loading`).
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

  const handleExport = useCallback(async () => {
    setExportError(null)
    try {
      const snapshot = await repo.exportAll()
      downloadJson(`teach-workspace-${lang}.json`, JSON.stringify(snapshot, null, 2))
    }
    catch (error) {
      // A resilient export can still reject (storage read failure / serialization
      // error). Surface it instead of leaking an unhandled rejection from the
      // `void handleExport()` call site.
      setExportError(error instanceof Error ? error.message : String(error))
    }
  }, [repo, lang])

  const handleImportFile = useCallback(
    async (file: File) => {
      setImportError(null)
      try {
        const parsed = workspaceSnapshotSchema.parse(JSON.parse(await file.text()))
        await repo.importAll(parsed)
        // The imported snapshot replaces every document, so the prior view
        // selection (a specific lesson / reference id) may now dangle. Reset the
        // ephemeral view state before remounting the shell so it lands on a valid
        // default instead of a "lesson not found" view.
        useWorkspaceStore.getState().reset()
        setGeneration(g => g + 1)
      }
      catch (error) {
        setImportError(error instanceof Error ? error.message : String(error))
      }
    },
    [repo],
  )

  if (hydration.status === 'loading')
    return <TeachAppLoading />

  if (hydration.status === 'error') {
    return (
      <div
        data-testid="teach-hydration-error"
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <TriangleAlert aria-hidden="true" className="size-8 text-amber-500" />
        <div className="flex max-w-md flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">
            <Trans>无法打开教学工作区</Trans>
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            <Trans>读取本地工作区数据失败。可以重试，或刷新页面。如果一直失败，可能是浏览器存储被禁用或损坏。</Trans>
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{hydration.message}</p>
        </div>
        <button
          type="button"
          data-testid="teach-hydration-retry"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted/60"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          <Trans>重试</Trans>
        </button>
      </div>
    )
  }

  return (
    <AbortScopeProvider>
      <WorkspaceProvider {...collaborators}>
        {!entered
          ? <TeachLanding onEnter={() => setEntered(true)} />
          : (
              <TeachWorkspace
                lang={lang}
                generation={generation}
                importError={importError}
                exportError={exportError}
                statusId={statusId}
                fileInputRef={fileInputRef}
                onExport={() => void handleExport()}
                onImportFile={handleImportFile}
              />
            )}
      </WorkspaceProvider>
    </AbortScopeProvider>
  )
}

interface TeachWorkspaceProps {
  lang: string
  generation: number
  importError: string | null
  exportError: string | null
  statusId: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onExport: () => void
  onImportFile: (file: File) => void | Promise<void>
}

/**
 * The entered workspace view: export/import header + {@link TeachWorkspaceShell}
 * with the {@link TeacherChatRuntime} as the chat region. Rendered only after the
 * landing gate is cleared, but still inside the workspace providers so the export
 * controls and the chat share the same repository revision.
 */
function TeachWorkspace({
  lang,
  generation,
  importError,
  exportError,
  statusId,
  fileInputRef,
  onExport,
  onImportFile,
}: TeachWorkspaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
        <span className="text-sm font-semibold text-foreground">
          <Trans>教学工作区</Trans>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="workspace-export"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Download aria-hidden="true" className="size-3.5" />
            <Trans>导出</Trans>
          </button>
          <button
            type="button"
            data-testid="workspace-import"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Upload aria-hidden="true" className="size-3.5" />
            <Trans>导入</Trans>
          </button>
          <input
            ref={fileInputRef}
            data-testid="workspace-import-input"
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label={t`导入工作区 JSON`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file)
                void onImportFile(file)
              // Reset so selecting the same file again re-triggers change.
              event.target.value = ''
            }}
          />
        </div>
      </header>
      {importError && (
        <p data-testid="workspace-import-error" role="alert" className="shrink-0 bg-destructive/10 px-4 py-1.5 text-xs text-destructive" id={statusId}>
          <Trans>导入失败：</Trans>
          {importError}
        </p>
      )}
      {exportError && (
        <p data-testid="workspace-export-error" role="alert" className="shrink-0 bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
          <Trans>导出失败：</Trans>
          {exportError}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <TeachWorkspaceShell
          key={generation}
          chat={<TeacherChatRuntime lang={lang} />}
        />
      </div>
    </div>
  )
}

function TeachAppLoading() {
  return (
    <div
      data-testid="teach-app-loading"
      className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground"
      aria-busy="true"
    >
      <Trans>正在加载教学工作区…</Trans>
    </div>
  )
}

export interface TeachAppProps {
  lang: string
}

/**
 * The browser-only teaching-workspace root. SSR is disabled because the
 * workspace depends on IndexedDB and the editor/runner; the live collaborators
 * are built inside the dynamically-imported {@link TeachAppRoot} so those
 * dependencies never load on the server. A lightweight loading shell renders
 * until the client bundle hydrates.
 */
const TeachApp = dynamic(() => import('./TeachAppRoot'), {
  ssr: false,
  loading: TeachAppLoading,
})

export default TeachApp
