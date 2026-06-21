'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Download, RotateCcw, TriangleAlert, Upload } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { workspaceSnapshotSchema } from '@/lib/teach/workspace/documents'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { TeachLanding } from './TeachLanding'
import { TeachConfigWizard } from './TeachConfigWizard'

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

// Records that the learner has completed onboarding (the landing + AI-source
// wizard) at least once, so returning visits open straight into the workspace
// instead of walking the intro again. Client-only (TeachApp is dynamic ssr:false).
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
    // Ignore storage failures (e.g. private mode); the learner just re-onboards.
  }
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
 * {@link TeacherChatRuntime} as the chat region, alongside the
 * {@link QuotaExhaustedDialog} / {@link LLMConfigDialog} that warn when the
 * shared quota runs out mid-session and let the learner switch to a custom key.
 * Everything is wrapped in an
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
  // so the teacher agent never reaches the views without a key. Once onboarding
  // has been completed before, returning visits skip straight to the workspace.
  const [stage, setStage] = useState<'landing' | 'config' | 'workspace'>(() => (hasOnboarded() ? 'workspace' : 'landing'))
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
            <Trans>无法打开课堂</Trans>
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
    <div className="teach-workspace-root contents">
      <AbortScopeProvider>
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
              {/* Mid-session quota safety net: the watcher in TeacherChatRuntime
                  flips autoQuota.exhausted when the shared quota runs out, which
                  surfaces this dialog; its "use a custom key" action opens the
                  config dialog. */}
              <QuotaExhaustedDialog />
              <LLMConfigDialog withTrigger={false} />
            </>
          )}
        </WorkspaceProvider>
      </AbortScopeProvider>
    </div>
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
  // Importing replaces the whole workspace, so gate it behind a confirm: a stray
  // file pick (or the wrong snapshot) must not wipe the learner's work silently.
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
        <span className="text-sm font-semibold text-foreground">
          <Trans>课堂</Trans>
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
                setPendingImport(file)
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

      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open)
            setPendingImport(null)
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="size-4 text-amber-500" />
              <Trans>导入将覆盖当前课堂</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>导入会用所选文件替换当前课堂的全部内容（学习目标、课程、术语表、学习记录、笔记等），且无法撤销。建议先导出备份。</Trans>
            </DialogDescription>
          </DialogHeader>
          {pendingImport && (
            <p className="truncate rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {pendingImport.name}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                <Trans>取消</Trans>
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              data-testid="workspace-import-confirm"
              onClick={() => {
                const file = pendingImport
                setPendingImport(null)
                if (file)
                  void onImportFile(file)
              }}
            >
              <Trans>覆盖导入</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <Trans>正在加载课堂…</Trans>
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
