'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLingui } from '@lingui/react'
import type { CodeTaskEditorComponent, CodeTaskEditorHandle } from '@/features/teach/components/blocks/CodeTaskBlock'
import { DynamicCodeTaskMonacoEditor } from '@/features/teach/components/blocks/DynamicCodeTaskMonacoEditor'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import type { PlaygroundEditorHostContextValue } from './playground-editor-host-context'
import { PlaygroundEditorHostContext } from './playground-editor-host-context'

export interface PlaygroundEditorHostProps {
  children: ReactNode
  editorComponent?: CodeTaskEditorComponent
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
 * a short-lived slot; this host moves the same DOM node between that slot and a
 * private parking container without remounting the editor or its canonical model.
 */
export function PlaygroundEditorHost({
  children,
  editorComponent: EditorComponent = DynamicCodeTaskMonacoEditor,
}: PlaygroundEditorHostProps) {
  const { i18n } = useLingui()
  const { activeEditor } = useWorkspace()
  // The tab strip and active buffer form one editor session, so the host needs
  // the collection together when it persists the previous buffer on selection.
  const tabs = useWorkspaceStore(state => state.playgroundTabs)
  const activeTabId = useWorkspaceStore(state => state.currentPlaygroundTabId)
  const view = useWorkspaceStore(state => state.view)
  const setCode = useWorkspaceStore(state => state.setPlaygroundTabCode)
  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? null
  const editorHandleRef = useRef<CodeTaskEditorHandle | null>(null)
  const currentTabIdRef = useRef(activeTab?.id ?? null)
  const parkingRef = useRef<HTMLDivElement | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const layoutFrameRef = useRef<number | null>(null)
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

  const placeHost = useCallback(() => {
    const target = slotRef.current ?? parkingRef.current
    if (!hostElement || !target)
      return
    if (hostElement.parentElement !== target)
      target.appendChild(hostElement)
    scheduleLayout()
  }, [hostElement, scheduleLayout])

  const registerEditorSlot = useCallback<RefCallback<HTMLDivElement>>((node) => {
    slotRef.current = node
    placeHost()
  }, [placeHost])

  const registerParking = useCallback<RefCallback<HTMLDivElement>>((node) => {
    parkingRef.current = node
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
    if (previousTabId === activeTab?.id)
      return
    const previousCode = editorHandleRef.current?.getCode()
    if (previousTabId && previousCode !== undefined)
      setCode(previousTabId, previousCode)
    if (activeTab)
      editorHandleRef.current?.setCode(activeTab.initialCode)
    currentTabIdRef.current = activeTab?.id ?? null
    scheduleLayout()
  }, [activeTab, scheduleLayout, setCode])

  useEffect(() => () => {
    const tabId = currentTabIdRef.current
    const code = editorHandleRef.current?.getCode()
    if (tabId && code !== undefined)
      setCode(tabId, code)
  }, [setCode])

  const context = useMemo<PlaygroundEditorHostContextValue>(() => ({
    activateEditor,
    editorHandleRef,
    registerEditorSlot,
  }), [activateEditor, registerEditorSlot])

  return (
    <PlaygroundEditorHostContext value={context}>
      {children}
      <div
        ref={registerParking}
        data-testid="playground-editor-parking"
        aria-hidden="true"
        inert
        className="pointer-events-none invisible absolute inset-0 overflow-hidden"
      />
      {hostElement && createPortal(
        <EditorComponent
          initialCode={activeTab?.initialCode ?? ''}
          handleRef={editorHandleRef}
          locale={i18n.locale}
          modelScope="teach:playground"
          canonicalModel
          replaceCodeOnMount
          fillHeight
        />,
        hostElement,
      )}
    </PlaygroundEditorHostContext>
  )
}
