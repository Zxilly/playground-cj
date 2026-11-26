'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Database, MessageCircle, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
import { CLASSROOM_EDITOR_MODEL_SCOPE } from '@/features/teach/state/classroom-editor-model-scope'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useIsCompactViewport } from '@/hooks/use-mobile'
import { useResponsiveChatOpen } from '@/features/teach/hooks/use-responsive-chat-open'
import { TeachTopBar } from './TeachTopBar'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { WorkspaceDataDialog } from './WorkspaceDataDialog'
import { PlaygroundEditorHost } from './views/PlaygroundEditorHost'
import { usePlaygroundEditorHost } from './views/playground-editor-host-context'
import { WorkspaceHistoryProvider } from './WorkspaceHistoryProvider'

function WorkspaceDataDialogHost({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { flushPendingCode } = usePlaygroundEditorHost()
  return (
    <WorkspaceDataDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      onBeforeExport={flushPendingCode}
    />
  )
}

export function TeachWorkspace({ lang }: { lang: string }) {
  const setSettingsDialogOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const prefillRevision = useWorkspaceStore(state => state.prefillRevision)
  const compact = useIsCompactViewport()
  const [compactChatOpen, setCompactChatOpen] = useResponsiveChatOpen(
    compact,
    pendingPrefill,
    prefillRevision,
  )
  const [dataDialogOpen, setDataDialogOpen] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const dataButtonRef = useRef<HTMLButtonElement>(null)
  const compactChatToggleRef = useRef<HTMLButtonElement>(null)
  const compactChatRegionId = useId()
  const [workspaceController] = useState(() => new AbortController())
  const locale = lang === 'en' ? 'en' : 'zh'
  const english = locale === 'en'

  useEffect(
    () => retainModelScope(CLASSROOM_EDITOR_MODEL_SCOPE),
    [],
  )

  return (
    <WorkspaceHistoryProvider>
      <div className="flex h-full min-h-0 flex-col">
        <TeachTopBar
          lang={locale}
          actions={(
            <>
              {compact && (
                <Button
                  ref={compactChatToggleRef}
                  type="button"
                  variant="secondary"
                  size="icon"
                  data-testid="workspace-chat-toggle"
                  className="size-11 shrink-0 rounded-md"
                  aria-label={english ? 'Open teacher chat' : '打开老师对话'}
                  aria-controls={compactChatRegionId}
                  aria-expanded={compactChatOpen}
                  onClick={() => setCompactChatOpen(true)}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                </Button>
              )}
              <Button
                ref={dataButtonRef}
                type="button"
                variant="ghost"
                size="sm"
                data-testid="workspace-data-trigger"
                className="size-11 lg:h-9 lg:w-auto"
                aria-label={english ? 'Workspace data' : '工作区数据'}
                title={english ? 'Workspace data' : '工作区数据'}
                onClick={() => setDataDialogOpen(true)}
              >
                <Database aria-hidden="true" className="size-4" />
                <span className="hidden xl:inline">
                  {english ? 'Data' : '数据'}
                </span>
              </Button>
              <Button
                ref={settingsButtonRef}
                type="button"
                variant="ghost"
                size="sm"
                className="size-11 lg:h-9 lg:w-auto"
                aria-label={english ? 'AI service settings' : 'AI 服务设置'}
                title={english ? 'AI service settings' : 'AI 服务设置'}
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings2 aria-hidden="true" className="size-4" />
                <span className="hidden xl:inline">
                  {english ? 'AI settings' : 'AI 设置'}
                </span>
              </Button>
            </>
          )}
        />
        <div className="min-h-0 flex-1">
          <AbortScopeProvider controller={workspaceController}>
            <PlaygroundEditorHost>
              <TeacherChatRuntime lang={lang}>
                {chat => (
                  <TeachWorkspaceShell
                    chat={chat}
                    compactChatOpen={compactChatOpen}
                    onCompactChatOpenChange={setCompactChatOpen}
                    compactChatToggleRef={compactChatToggleRef}
                    compactChatRegionId={compactChatRegionId}
                  />
                )}
              </TeacherChatRuntime>
              {dataDialogOpen && (
                <WorkspaceDataDialogHost
                  open={dataDialogOpen}
                  onOpenChange={setDataDialogOpen}
                  returnFocusRef={dataButtonRef}
                />
              )}
            </PlaygroundEditorHost>
          </AbortScopeProvider>
        </div>
        <LLMConfigDialog withTrigger={false} returnFocusRef={settingsButtonRef} />
      </div>
    </WorkspaceHistoryProvider>
  )
}
