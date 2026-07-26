'use client'

import { useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { TeachTopBar } from './TeachTopBar'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'

export function TeachWorkspace({ lang }: { lang: string }) {
  const setSettingsDialogOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const [workspaceController] = useState(() => new AbortController())
  const english = lang === 'en'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TeachTopBar
        actions={(
          <Button
            ref={settingsButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={english ? 'AI service settings' : 'AI 服务设置'}
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings2 aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">
              {english ? 'AI service settings' : 'AI 服务设置'}
            </span>
          </Button>
        )}
      />
      <div className="min-h-0 flex-1">
        <AbortScopeProvider controller={workspaceController}>
          <TeachWorkspaceShell chat={<TeacherChatRuntime lang={lang} />} />
        </AbortScopeProvider>
      </div>
      <LLMConfigDialog withTrigger={false} returnFocusRef={settingsButtonRef} />
    </div>
  )
}
