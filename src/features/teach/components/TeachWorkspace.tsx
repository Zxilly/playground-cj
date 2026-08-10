'use client'

import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
import { CLASSROOM_EDITOR_MODEL_SCOPE } from '@/features/teach/state/classroom-editor-model-scope'
import { TeachTopBar } from './TeachTopBar'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { PlaygroundEditorHost } from './views/PlaygroundEditorHost'
import { WorkspaceHistoryProvider } from './WorkspaceHistoryProvider'

export function TeachWorkspace({ lang }: { lang: string }) {
  const setSettingsDialogOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const [workspaceController] = useState(() => new AbortController())
  const english = lang === 'en'

  useEffect(
    () => retainModelScope(CLASSROOM_EDITOR_MODEL_SCOPE),
    [],
  )

  return (
    <WorkspaceHistoryProvider>
      <div className="flex h-full min-h-0 flex-col">
        <TeachTopBar
          actions={(
            <Button
              ref={settingsButtonRef}
              type="button"
              variant="ghost"
              size="sm"
              className="size-11 lg:h-8 lg:w-auto"
              aria-label={english ? 'AI service settings' : 'AI 服务设置'}
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings2 aria-hidden="true" className="size-3.5" />
              <span className="hidden lg:inline">
                {english ? 'AI service settings' : 'AI 服务设置'}
              </span>
            </Button>
          )}
        />
        <div className="min-h-0 flex-1">
          <AbortScopeProvider controller={workspaceController}>
            <PlaygroundEditorHost>
              <TeacherChatRuntime lang={lang}>
                {chat => <TeachWorkspaceShell chat={chat} />}
              </TeacherChatRuntime>
            </PlaygroundEditorHost>
          </AbortScopeProvider>
        </div>
        <LLMConfigDialog withTrigger={false} returnFocusRef={settingsButtonRef} />
      </div>
    </WorkspaceHistoryProvider>
  )
}
