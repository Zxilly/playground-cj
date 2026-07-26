'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLingui } from '@lingui/react'
import type { CangjieEditorComponent, CangjieEditorHandle } from '@/features/teach/components/editor/CangjieEditor'
import { DynamicCangjieEditor } from '@/features/teach/components/editor/DynamicCangjieEditor'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import type { PlaygroundEditorHostContextValue } from './playground-editor-host-context'
import { PlaygroundEditorHostContext } from './playground-editor-host-context'

export interface PlaygroundEditorHostProps {
  children: ReactNode
  editorComponent?: CangjieEditorComponent
}

function createHostElement(): HTMLDivElement | null {
  if (typeof document === 'undefined')
    return null
  const element = document.createElement('div')
  element.setAttribute('data-testid', 'playground-editor-host')
  element.className = 'relative h-full min-h-0 w-full overflow-hidden'
  return element
}

/**
 * Owns the single long-lived Playground Monaco instance. Route pages contribute
 * a short-lived slot; this host attaches the same DOM node to the active slot
 * and keeps it off-DOM while the route is inactive. Playground tabs are
 * logical buffers over the canonical project model, while the editor widget
 * itself stays mounted. The
 * Cangjie LSP treats that canonical document as the active workspace source;
 * nested standalone model URIs can leave completion requests unresolved.
 */
export function PlaygroundEditorHost({
  children,
  editorComponent: EditorComponent = DynamicCangjieEditor,
}: PlaygroundEditorHostProps) {
  const { i18n } = useLingui()
  const { activeEditor } = useWorkspace()
  // The tab strip and active buffer form one editor session, so the host needs
  // the collection together when it persists the previous buffer on selection.
  const tabs = useWorkspaceStore(state => state.playgroundTabs)
  const activeTabId = useWorkspaceStore(state => state.currentPlaygroundTabId)
  const persistenceStatus = useWorkspaceStore(
    state => state.playgroundPersistenceStatus,
  )
  const view = useWorkspaceStore(state => state.view)
  const setCode = useWorkspaceStore(state => state.setPlaygroundTabCode)
  const acquirePersistence = useWorkspaceStore(
    state => state.acquirePlaygroundPersistence,
  )
  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? null
  const editorHandleRef = useRef<CangjieEditorHandle | null>(null)
  const currentTabIdRef = useRef(activeTab?.id ?? null)
  const currentContentVersionRef = useRef(activeTab?.contentVersion ?? null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const layoutFrameRef = useRef<number | null>(null)
  const persistTimerRef = useRef<number | null>(null)
  const pendingCodeRef = useRef<{
    tabId: string
    code: string
    expectedContentVersion: string
  } | null>(null)
  const [hostElement] = useState(createHostElement)
  const activateEditor = useActiveEditorRegistration(
    activeEditor,
    editorHandleRef,
    view === 'playground',
  )

  const scheduleLayout = useCallback(() => {
    if (layoutFrameRef.current !== null)
      cancelAnimationFrame(layoutFrameRef.current)
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null
      editorHandleRef.current?.layout?.()
    })
  }, [])

  const flushPendingCode = useCallback(() => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    const pending = pendingCodeRef.current
    pendingCodeRef.current = null
    if (pending) {
      setCode(
        pending.tabId,
        pending.code,
        pending.expectedContentVersion,
      )
    }
  }, [setCode])

  const persistActiveCode = useCallback((code: string) => {
    const tabId = currentTabIdRef.current
    const expectedContentVersion = currentContentVersionRef.current
    if (!tabId || !expectedContentVersion)
      return
    pendingCodeRef.current = {
      tabId,
      code,
      expectedContentVersion:
        pendingCodeRef.current?.tabId === tabId
          ? pendingCodeRef.current.expectedContentVersion
          : expectedContentVersion,
    }
    if (persistTimerRef.current !== null)
      window.clearTimeout(persistTimerRef.current)
    // Keep typing responsive while still making drafts durable almost
    // immediately. pagehide/tab switches flush synchronously below.
    persistTimerRef.current = window.setTimeout(flushPendingCode, 120)
  }, [flushPendingCode])

  const persistLiveEditorCode = useCallback(() => {
    const tabId = currentTabIdRef.current
    const code = editorHandleRef.current?.getCode()
    const persistedTab = useWorkspaceStore.getState().playgroundTabs.find(
      tab => tab.id === tabId,
    )
    if (
      tabId
      && code !== undefined
      && persistedTab
      && code !== persistedTab.initialCode
    ) {
      setCode(tabId, code, persistedTab.contentVersion)
    }
  }, [setCode])

  const placeHost = useCallback(() => {
    if (!hostElement)
      return

    const target = slotRef.current
    if (!target) {
      // Match VS Code's editor-pane lifecycle: retain the editor instance while
      // keeping its container entirely off-DOM whenever the pane is inactive.
      // This prevents Monaco descendants from participating in layout or paint.
      hostElement.remove()
      return
    }

    if (hostElement.parentElement !== target) {
      target.appendChild(hostElement)
      scheduleLayout()
    }
  }, [hostElement, scheduleLayout])

  const registerEditorSlot = useCallback<RefCallback<HTMLDivElement>>((node) => {
    slotRef.current = node
    placeHost()
  }, [placeHost])

  useLayoutEffect(() => {
    placeHost()
    return () => {
      if (layoutFrameRef.current !== null)
        cancelAnimationFrame(layoutFrameRef.current)
      hostElement?.remove()
    }
  }, [hostElement, placeHost])

  useLayoutEffect(() => {
    const previousTabId = currentTabIdRef.current
    const previousContentVersion = currentContentVersionRef.current
    if (
      previousTabId === activeTab?.id
      && previousContentVersion === (activeTab?.contentVersion ?? null)
    ) {
      return
    }
    if (
      previousTabId === activeTab?.id
      && pendingCodeRef.current?.tabId === previousTabId
    ) {
      // Preserve the version observed when typing began. Flushing after a
      // remote revision with that old token creates an explicit CAS conflict
      // instead of replacing the unflushed editor text.
      flushPendingCode()
      return
    }
    if (previousTabId !== activeTab?.id) {
      flushPendingCode()
    }
    currentTabIdRef.current = activeTab?.id ?? null
    currentContentVersionRef.current = activeTab?.contentVersion ?? null
    if (
      editorHandleRef.current
      && editorHandleRef.current.getCode() !== (activeTab?.initialCode ?? '')
    ) {
      editorHandleRef.current.setCode(activeTab?.initialCode ?? '')
    }
    scheduleLayout()
  }, [activeTab, flushPendingCode, scheduleLayout, setCode])

  useEffect(() => {
    window.addEventListener('pagehide', flushPendingCode)
    return () => {
      window.removeEventListener('pagehide', flushPendingCode)
      flushPendingCode()
      persistLiveEditorCode()
    }
  }, [flushPendingCode, persistLiveEditorCode])

  useEffect(() => {
    let disposed = false
    let release: (() => Promise<void>) | null = null
    void acquirePersistence().then((ownerRelease) => {
      if (disposed)
        void ownerRelease()
      else
        release = ownerRelease
    })
    return () => {
      disposed = true
      flushPendingCode()
      persistLiveEditorCode()
      if (release)
        void release()
    }
  }, [
    acquirePersistence,
    flushPendingCode,
    persistLiveEditorCode,
  ])

  const context = useMemo<PlaygroundEditorHostContextValue>(() => ({
    activateEditor,
    editorHandleRef,
    flushPendingCode,
    registerEditorSlot,
  }), [activateEditor, flushPendingCode, registerEditorSlot])

  return (
    <PlaygroundEditorHostContext value={context}>
      {children}
      {hostElement && persistenceStatus === 'ready' && createPortal(
        <EditorComponent
          initialCode={activeTab?.initialCode ?? ''}
          handleRef={editorHandleRef}
          locale={i18n.locale}
          canonicalModel
          fillHeight
          onCodeChange={persistActiveCode}
        />,
        hostElement,
      )}
    </PlaygroundEditorHostContext>
  )
}
