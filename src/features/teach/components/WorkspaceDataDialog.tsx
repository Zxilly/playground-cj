'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { usePlaygroundSession } from '@/features/teach/state/playground-session'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import {
  buildWorkspaceSnapshotBundle,
  MAX_WORKSPACE_IMPORT_BYTES,
  parseWorkspaceSnapshotImport,
} from '@/features/teach/state/workspace-snapshot'
import { BUILT_IN_COURSE_VERSION } from '@/lib/teach/classroom/built-in-course'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import type { ClassroomScopeRecord } from '@/lib/teach/classroom/storage'

export interface WorkspaceDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLElement | null>
  onBeforeExport?: () => void
}

function triggerJsonDownload(filename: string, payload: unknown): void {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

async function replacePlaygroundTabs(
  nextTabs: ReadonlyArray<{ title: string, code: string }>,
): Promise<void> {
  const session = usePlaygroundSession.getState()
  if (session.persistenceStatus !== 'ready')
    return
  for (const existing of [...session.tabs])
    session.closeTab(existing.id)
  if (nextTabs.length === 0) {
    session.openTab()
  }
  else {
    for (const tab of nextTabs)
      session.openTab({ title: tab.title, code: tab.code })
  }
  await session.whenPersistenceIdle()
}

export function WorkspaceDataDialog({
  open,
  onOpenChange,
  returnFocusRef,
  onBeforeExport,
}: WorkspaceDataDialogProps) {
  const { t } = useLingui()
  const { catalog, classroom, courseVersion, storage, storageScope } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const playgroundTabs = usePlaygroundSession(state => state.tabs)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [legacyScopes, setLegacyScopes] = useState<ClassroomScopeRecord[]>([])
  const [busyAction, setBusyAction] = useState<'export' | 'import' | 'reset' | 'clean-legacy' | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCleanLegacy, setConfirmCleanLegacy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error', message: string } | null>(null)

  const refreshLegacyScopes = useCallback(async () => {
    if (!storage?.listScopes) {
      setLegacyScopes([])
      return
    }
    try {
      const scopes = await storage.listScopes('classroom')
      setLegacyScopes(scopes.filter(record => record.scope !== storageScope))
    }
    catch {
      setLegacyScopes([])
    }
  }, [storage, storageScope])

  const handleDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmReset(false)
      setConfirmCleanLegacy(false)
      setFeedback(null)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  useEffect(() => {
    if (open)
      void refreshLegacyScopes()
  }, [open, refreshLegacyScopes])

  const handleExport = async () => {
    if (busyAction !== null)
      return
    setBusyAction('export')
    setFeedback(null)
    try {
      onBeforeExport?.()
      const currentLegacy = storage?.listScopes
        ? (await storage.listScopes('classroom')).filter(record => record.scope !== storageScope)
        : legacyScopes
      const tabs = usePlaygroundSession.getState().tabs
      const bundle = buildWorkspaceSnapshotBundle({
        classroomSnapshot: classroom.snapshot(),
        courseVersion: courseVersion ?? BUILT_IN_COURSE_VERSION,
        playgroundTabs: tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          code: tab.initialCode,
        })),
        legacyClassrooms: currentLegacy,
      })
      const stamp = new Date().toISOString().slice(0, 10)
      triggerJsonDownload(`playground-cj-workspace-${stamp}.json`, bundle)
      const message = t`已导出工作区快照（不包含任何 API Key）。`
      setFeedback({ kind: 'success', message })
      toast.success(message)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setFeedback({
        kind: 'error',
        message: t`导出失败：${detail}`,
      })
    }
    finally {
      setBusyAction(null)
    }
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyAction !== null)
      return
    if (file.size > MAX_WORKSPACE_IMPORT_BYTES) {
      setFeedback({
        kind: 'error',
        message: t`所选文件超过 4 MB 的工作区快照上限。`,
      })
      return
    }
    if (!storage?.replace) {
      setFeedback({
        kind: 'error',
        message: t`当前工作区会话不支持导入快照。`,
      })
      return
    }

    setBusyAction('import')
    setFeedback(null)
    try {
      const rawJson = await file.text()
      const parsed = await parseWorkspaceSnapshotImport(rawJson, catalog)
      if (!parsed.ok) {
        const message = parsed.reason === 'too_large'
          ? t`快照文件体积过大。`
          : parsed.reason === 'invalid_json'
            ? t`文件不是有效的 JSON 格式。`
            : parsed.reason === 'incompatible_course_version'
              ? t`该快照来自不兼容的课程版本，无法导入当前课程。`
              : t`工作区快照格式校验未通过，已有数据未被修改。`
        setFeedback({ kind: 'error', message })
        return
      }

      await storage.replace(parsed.classroomToImport)
      await replacePlaygroundTabs(parsed.bundle.playground.tabs)
      useWorkspaceStore.getState().clearComposerDraft()
      const message = parsed.migrated
        ? t`已导入工作区，并将兼容的学习路径迁移至当前课程版本。`
        : t`工作区快照已导入。`
      setFeedback({ kind: 'success', message })
      toast.success(message)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setFeedback({
        kind: 'error',
        message: t`导入失败：${detail}`,
      })
    }
    finally {
      setBusyAction(null)
    }
  }

  const handleResetWorkspace = async () => {
    if (busyAction !== null || !storage?.replace)
      return
    setBusyAction('reset')
    setFeedback(null)
    try {
      await storage.replace(createEmptyClassroom())
      await replacePlaygroundTabs([])
      useWorkspaceStore.getState().reset()
      setConfirmReset(false)
      const message = t`当前学习进度与练习场草稿已重置。`
      setFeedback({ kind: 'success', message })
      toast.success(message)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setFeedback({
        kind: 'error',
        message: t`重置失败：${detail}`,
      })
    }
    finally {
      setBusyAction(null)
    }
  }

  const handleCleanLegacyScopes = async () => {
    if (busyAction !== null || !storage?.deleteScope)
      return
    setBusyAction('clean-legacy')
    setFeedback(null)
    try {
      for (const record of legacyScopes)
        await storage.deleteScope(record.scope)
      await refreshLegacyScopes()
      setConfirmCleanLegacy(false)
      const message = t`旧课程版本备份已清理。`
      setFeedback({ kind: 'success', message })
      toast.success(message)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setFeedback({
        kind: 'error',
        message: t`清理失败：${detail}`,
      })
    }
    finally {
      setBusyAction(null)
    }
  }

  const legacyCount = legacyScopes.length

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="teach-workspace-theme sm:max-w-[500px]"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current)
            return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database aria-hidden="true" className="size-4 text-primary" />
            <Trans>工作区数据管理</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>学习进度与练习场草稿保存在当前浏览器。可随时导出或导入 JSON 快照；导出内容绝不包含 API Key。</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/25 p-3 text-center">
            <div>
              <p className="text-lg font-semibold tabular-nums">{snapshot.tracks.length}</p>
              <p className="text-xs text-muted-foreground"><Trans>学习路径</Trans></p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{snapshot.attempts.length}</p>
              <p className="text-xs text-muted-foreground"><Trans>练习记录</Trans></p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{playgroundTabs.length}</p>
              <p className="text-xs text-muted-foreground"><Trans>练习场标签</Trans></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="workspace-export-json"
              disabled={busyAction !== null}
              onClick={() => void handleExport()}
              className="min-h-11 flex-1 lg:min-h-9"
            >
              {busyAction === 'export'
                ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                : <Download aria-hidden="true" className="size-4" />}
              <Trans>导出工作区快照 (JSON)</Trans>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              data-testid="workspace-import-input"
              onChange={event => void handleImportFileChange(event)}
              className="sr-only"
              aria-label={t`选择工作区 JSON 快照文件`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="workspace-import-json"
              disabled={busyAction !== null || !storage?.replace}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 flex-1 lg:min-h-9"
            >
              {busyAction === 'import'
                ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                : <Upload aria-hidden="true" className="size-4" />}
              <Trans>导入工作区快照 (JSON)</Trans>
            </Button>
          </div>

          {legacyCount > 0 && (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-3 text-xs leading-5">
              <p className="font-medium text-foreground">
                {t`已保留 ${legacyCount} 份旧课程版本数据备份`}
              </p>
              <p className="mt-1 text-muted-foreground">
                <Trans>课程版本升级不会静默清空旧数据。导出快照时会一并打包这些备份；确认不再需要后可手动清理。</Trans>
              </p>
              {storage?.deleteScope && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {confirmCleanLegacy
                    ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            data-testid="workspace-clean-legacy-confirm"
                            disabled={busyAction !== null}
                            onClick={() => void handleCleanLegacyScopes()}
                            className="min-h-9"
                          >
                            {busyAction === 'clean-legacy' && (
                              <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
                            )}
                            <Trans>确认删除旧版本备份</Trans>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyAction !== null}
                            onClick={() => setConfirmCleanLegacy(false)}
                            className="min-h-9"
                          >
                            <Trans>取消</Trans>
                          </Button>
                        </>
                      )
                    : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid="workspace-clean-legacy"
                          disabled={busyAction !== null}
                          onClick={() => setConfirmCleanLegacy(true)}
                          className="min-h-9"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          <Trans>清理旧版本备份</Trans>
                        </Button>
                      )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <Trans>重置当前工作区</Trans>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Trans>清空当前浏览器的学习路径、练习记录与练习场草稿（建议先导出备份）。</Trans>
                </p>
              </div>
              {!confirmReset && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="workspace-reset-trigger"
                  disabled={busyAction !== null || !storage?.replace}
                  onClick={() => setConfirmReset(true)}
                  className="min-h-11 shrink-0 text-error-foreground hover:text-error-foreground lg:min-h-8"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  <Trans>重置工作区</Trans>
                </Button>
              )}
            </div>
            {confirmReset && (
              <div role="alert" className="mt-3 space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-start gap-2 text-xs text-error-foreground">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <Trans>此操作会清空当前课程的学习进度和练习场草稿且无法撤销。如未导出备份，请先点击上方导出。</Trans>
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    data-testid="workspace-reset-confirm"
                    disabled={busyAction !== null}
                    onClick={() => void handleResetWorkspace()}
                    className="min-h-9"
                  >
                    {busyAction === 'reset' && (
                      <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
                    )}
                    <Trans>确认重置</Trans>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyAction !== null}
                    onClick={() => setConfirmReset(false)}
                    className="min-h-9"
                  >
                    <Trans>取消</Trans>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {feedback && (
            <p
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              data-testid="workspace-data-feedback"
              className={feedback.kind === 'error'
                ? 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-error-foreground'
                : 'flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400'}
            >
              {feedback.kind === 'error'
                ? <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                : <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
              <span>{feedback.message}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Trans>关闭</Trans>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
