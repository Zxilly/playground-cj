import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { deleteDB } from 'idb'
import { useEffect, useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { AbortScopeProvider } from '@/features/teach/context/abort-scope'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import {
  PLAYGROUND_SESSION_LIMITS,
  usePlaygroundSession,
} from '@/features/teach/state/playground-session'
import { createPlaygroundWorkspace } from '@/features/teach/state/playground-workspace'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
} from '@/features/teach/state/playground-workspace-storage'
import type { CangjieEditorProps } from '@/features/teach/components/editor/CangjieEditor'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { PlaygroundEditorHost } from './PlaygroundEditorHost'
import { PlaygroundView } from './PlaygroundView'

const fakeEditorMountConnections: boolean[] = []

function FakePlaygroundEditor({
  initialCode,
  handleRef,
  onCodeChange,
  uriHint = 'default',
  canonicalModel = false,
}: CangjieEditorProps) {
  const modelsRef = useRef(new Map<string, string>())
  const inputRef = useRef<HTMLTextAreaElement>(null)
  if (!modelsRef.current.has(uriHint))
    modelsRef.current.set(uriHint, initialCode)
  useEffect(() => {
    fakeEditorMountConnections.push(inputRef.current?.isConnected === true)
    handleRef.current = {
      getCode: () => modelsRef.current.get(uriHint) ?? '',
      setCode: (code: string) => {
        modelsRef.current.set(uriHint, code)
        if (inputRef.current)
          inputRef.current.value = code
      },
    }
    if (inputRef.current)
      inputRef.current.value = modelsRef.current.get(uriHint) ?? ''
    return () => {
      handleRef.current = null
    }
  }, [handleRef, uriHint])
  return (
    <textarea
      ref={inputRef}
      data-testid="fake-playground-editor"
      data-uri-hint={uriHint}
      data-canonical-model={canonicalModel}
      defaultValue={modelsRef.current.get(uriHint)}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        modelsRef.current.set(uriHint, event.target.value)
        onCodeChange?.(event.target.value)
      }}
    />
  )
}

vi.mock('@/features/teach/components/editor/DynamicCangjieEditor', () => ({
  DynamicCangjieEditor: FakePlaygroundEditor,
}))

const runner = {
  run: vi.fn<(code: string) => Promise<RunResult>>(async (code: string) => ({
    ok: true,
    phase: 'run',
    stdout: `output:${code}`,
    stdoutTruncated: false,
    stderr: '',
    stderrTruncated: false,
    compilerOutput: `compiler:${code}`,
    compilerOutputTruncated: false,
    exitCode: 0,
  })),
}

const ESC = String.fromCharCode(27)
const noisyCompilerError = [
  `${ESC}[36m$ /opt/cangjie/bin/cjc main.cj -o main${ESC}[0m`,
  'Cangjie Compiler 1.0.0',
  `${ESC}[31merror: expected expression${ESC}[0m`,
  '  --> main.cj:2:12',
].join('\n')

const context: WorkspaceContextValue = {
  lang: 'zh',
  classroom: {} as WorkspaceContextValue['classroom'],
  catalog: {} as WorkspaceContextValue['catalog'],
  knowledge: { id: 'test', search: vi.fn(async () => []) },
  runner,
  activeEditor: createActiveEditorRegistry(),
  now: () => 0,
}

let workspaceAbortController = new AbortController()
let persistenceRelease: (() => Promise<void>) | null = null

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceContext value={context}>
        <AbortScopeProvider controller={workspaceAbortController}>
          <PlaygroundEditorHost editorComponent={FakePlaygroundEditor}>
            {children}
          </PlaygroundEditorHost>
        </AbortScopeProvider>
      </WorkspaceContext>
    </I18nProvider>
  )
}

function PlaygroundRouteHarness() {
  const view = useWorkspaceStore(state => state.view)
  return view === 'playground'
    ? <PlaygroundView />
    : <div data-testid="other-route" />
}

beforeEach(async () => {
  await usePlaygroundSession.getState().close()
  await deleteDB(PLAYGROUND_WORKSPACE_V2_DATABASE_NAME)
  workspaceAbortController = new AbortController()
  runner.run.mockReset()
  fakeEditorMountConnections.length = 0
  runner.run.mockImplementation(async (code: string) => ({
    ok: true,
    phase: 'run',
    stdout: `output:${code}`,
    stdoutTruncated: false,
    stderr: '',
    stderrTruncated: false,
    compilerOutput: `compiler:${code}`,
    compilerOutputTruncated: false,
    exitCode: 0,
  }))
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  usePlaygroundSession.setState(usePlaygroundSession.getInitialState(), true)
  persistenceRelease
    = await usePlaygroundSession.getState().acquire()
  useWorkspaceStore.getState().setView('playground')
})

afterEach(async () => {
  cleanup()
  await persistenceRelease?.()
  persistenceRelease = null
  await usePlaygroundSession.getState().close()
})

describe('playgroundView student flow', () => {
  it('exposes Playground as the active workspace view heading', () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    expect(screen.getByRole('heading', { level: 1, name: 'Playground' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '程序输出' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '编译器输出' })).toBeTruthy()
  })

  it('announces run start, completion, and failure without reading program output', async () => {
    let finish!: (result: RunResult) => void
    runner.run.mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
      finish = resolve
    }))
    render(<PlaygroundView />, { wrapper: Wrapper })
    const status = screen.getByTestId('playground-run-status')

    expect(status.textContent).toBe('')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')

    fireEvent.click(screen.getByTestId('playground-run'))
    expect(screen.getByTestId('playground-run-status')).toBe(status)
    expect(status.textContent).toBe('正在运行 Playground 代码…')

    await act(async () => finish({
      ok: true,
      phase: 'run',
      stdout: 'large program output that must stay outside the live region',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    await waitFor(() => expect(status.textContent).toBe('Playground 运行完成'))
    expect(status.textContent).not.toContain('large program output')

    runner.run.mockResolvedValueOnce({
      ok: false,
      phase: 'compile',
      stdout: '',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: 'private compiler details',
      compilerOutputTruncated: false,
      exitCode: null,
    })
    fireEvent.click(screen.getByTestId('playground-run'))
    expect(status.textContent).toBe('正在运行 Playground 代码…')
    await waitFor(() => expect(status.textContent).toBe('Playground 运行失败'))
    expect(status.textContent).not.toContain('private compiler details')
  })

  it('cold-starts the editor only after its real Playground slot is connected', async () => {
    useWorkspaceStore.getState().setView('live')
    render(<PlaygroundRouteHarness />, { wrapper: Wrapper })

    expect(fakeEditorMountConnections).toEqual([])
    act(() => useWorkspaceStore.getState().setView('playground'))

    const editor = await screen.findByTestId('fake-playground-editor')
    expect(editor.isConnected).toBe(true)
    expect(fakeEditorMountConnections).toEqual([true])
  })

  it('keeps the editor instance and buffer while the Playground route page unmounts', async () => {
    render(<PlaygroundRouteHarness />, { wrapper: Wrapper })
    const editor = await screen.findByTestId('fake-playground-editor')
    fireEvent.change(editor, { target: { value: 'main() { println("persistent") }' } })

    act(() => useWorkspaceStore.getState().setView('progress'))
    expect(screen.queryByTestId('playground-view')).toBeNull()
    expect(editor.isConnected).toBe(false)
    expect(context.activeEditor?.getCode()).toBeNull()

    act(() => useWorkspaceStore.getState().setView('playground'))
    expect(await screen.findByTestId('fake-playground-editor')).toBe(editor)
    expect(editor.isConnected).toBe(true)
    expect((editor as HTMLTextAreaElement).value).toBe('main() { println("persistent") }')
  })

  it('keeps the inactive EditorHost off-DOM instead of parking it in the layout tree', async () => {
    render(<PlaygroundRouteHarness />, { wrapper: Wrapper })
    const host = await screen.findByTestId('playground-editor-host')
    await screen.findByTestId('fake-playground-editor')

    act(() => useWorkspaceStore.getState().setView('progress'))
    expect(host.isConnected).toBe(false)
    expect(document.querySelector('[data-testid="playground-editor-parking"]')).toBeNull()

    act(() => useWorkspaceStore.getState().setView('playground'))
    expect(await screen.findByTestId('playground-editor-host')).toBe(host)
    expect(host.isConnected).toBe(true)
  })

  it('keeps tab buffers independent and runs the code from the active editor', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    const firstEditor = screen.getByTestId('fake-playground-editor')
    const firstUri = firstEditor.getAttribute('data-uri-hint')
    expect(firstEditor.getAttribute('data-canonical-model')).toBe('true')
    fireEvent.change(firstEditor, { target: { value: 'main() { println("first") }' } })
    fireEvent.click(screen.getByTestId('playground-run'))
    await waitFor(() => expect(runner.run).toHaveBeenLastCalledWith(
      'main() { println("first") }',
      expect.any(AbortSignal),
    ))
    expect(await screen.findByText('output:main() { println("first") }')).toBeTruthy()
    expect(screen.getByText('compiler:main() { println("first") }')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playground-new-tab'))
    const secondEditor = screen.getByTestId('fake-playground-editor')
    expect(secondEditor).toBe(firstEditor)
    expect(secondEditor.getAttribute('data-uri-hint')).toBe(firstUri)
    fireEvent.change(secondEditor, { target: { value: 'main() { println("second") }' } })
    fireEvent.click(screen.getByTestId('playground-run'))
    await waitFor(() => expect(runner.run).toHaveBeenLastCalledWith(
      'main() { println("second") }',
      expect.any(AbortSignal),
    ))
    expect(await screen.findByText('output:main() { println("second") }')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('tab')[0])
    expect(screen.getByText('output:main() { println("first") }')).toBeTruthy()
    expect((screen.getByTestId('fake-playground-editor') as HTMLTextAreaElement).value)
      .toBe('main() { println("first") }')
  })

  it('renames a tab with the IDE-standard F2 shortcut without changing its id', () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    const tab = screen.getByRole('tab')
    const tabId = usePlaygroundSession.getState().activeTabId

    fireEvent.keyDown(tab, { key: 'F2' })
    const input = screen.getByTestId('playground-tab-name')
    fireEvent.change(input, { target: { value: '变量实验' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('tab').textContent).toContain('变量实验')
    expect(usePlaygroundSession.getState().activeTabId).toBe(tabId)
  })

  it('keeps tab controls flat and moves focus after opening or closing a tab', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    const firstTab = screen.getByRole('tab')
    expect(firstTab.querySelector('button, input')).toBeNull()

    fireEvent.click(screen.getByTestId('playground-new-tab'))
    const tabs = screen.getAllByRole('tab')
    await waitFor(() => expect(document.activeElement).toBe(tabs[1]))
    expect(tabs[1]?.querySelector('button, input')).toBeNull()

    fireEvent.click(screen.getByRole('button', {
      name: `关闭标签页: ${tabs[1]?.textContent}`,
    }))
    await waitFor(() => expect(document.activeElement).toBe(firstTab))
  })

  it('discloses shared draft scope and keeps mobile controls at least 44px tall', () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    expect(screen.getByTestId('playground-scope-note').textContent).toContain(
      '会在所有学习目标之间共享',
    )
    expect(screen.getByTestId('playground-scope-note').textContent).toContain('Ctrl+M')
    expect(screen.getByTestId('playground-close-tab').className).toContain('size-11')
    expect(screen.getByTestId('playground-new-tab').className).toContain('size-11')
    expect(screen.getByRole('tablist').contains(screen.getByTestId('playground-new-tab')))
      .toBe(false)
    expect(screen.getByTestId('playground-run').className).toContain('h-11')
  })

  it('requires confirmation before deleting a tab with edited code', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    fireEvent.change(screen.getByTestId('fake-playground-editor'), {
      target: { value: 'main() { println("keep me") }' },
    })
    await waitFor(() => {
      expect(usePlaygroundSession.getState().tabs[0]?.initialCode)
        .toBe('main() { println("keep me") }')
    })

    fireEvent.click(screen.getByTestId('playground-close-tab'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('此操作无法撤销')
    expect(dialog.querySelector('[data-slot="dialog-footer"]')?.className)
      .toContain('flex-col sm:flex-row')
    expect(usePlaygroundSession.getState().tabs).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '保留标签页' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('playground-close-tab'))
    fireEvent.click(screen.getByRole('button', { name: '删除标签页' }))
    await waitFor(() => expect(usePlaygroundSession.getState().tabs).toHaveLength(0))
  })

  it('returns focus to the edited-tab close button after dismissing deletion with Escape', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    fireEvent.change(screen.getByTestId('fake-playground-editor'), {
      target: { value: 'main() { println("keep focus") }' },
    })
    await waitFor(() => {
      expect(usePlaygroundSession.getState().tabs[0]?.initialCode)
        .toBe('main() { println("keep focus") }')
    })

    const closeButton = screen.getByTestId('playground-close-tab')
    fireEvent.click(closeButton)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(closeButton))
  })

  it('persists each edit into the active Playground tab shortly after it is typed', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    fireEvent.change(screen.getByTestId('fake-playground-editor'), {
      target: { value: 'main() { println("saved immediately") }' },
    })

    await waitFor(() => {
      expect(usePlaygroundSession.getState().tabs[0]?.initialCode)
        .toBe('main() { println("saved immediately") }')
    })
  })

  it('shows a dirty storage failure and lets the learner retry persistence', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })
    const retry = vi.fn(() => usePlaygroundSession.setState({
      dirty: false,
      persistenceError: null,
    }))
    act(() => usePlaygroundSession.setState({
      dirty: true,
      persistenceError: 'storage_unavailable',
      retryPersistence: retry,
    }))
    expect(screen.getByRole('alert').textContent).toContain('尚未保存')

    fireEvent.click(screen.getByRole('button', { name: '重试保存' }))
    await waitFor(() => {
      expect(retry).toHaveBeenCalledOnce()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(usePlaygroundSession.getState().dirty).toBe(false)
    })
  })

  it('explains a bounded-session failure without offering a futile retry', () => {
    const tabId = usePlaygroundSession.getState().activeTabId
    expect(tabId).not.toBeNull()
    act(() => usePlaygroundSession.getState().renameTab(
      tabId!,
      'x'.repeat(PLAYGROUND_SESSION_LIMITS.maxTitleBytes + 1),
    ))

    render(<PlaygroundView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert').textContent).toContain('超过本地保存限额')
    expect(screen.queryByRole('button', { name: '重试保存' })).toBeNull()
  })

  it('shows recoverable actions instead of silently overwriting a same-tab conflict', () => {
    const tab = usePlaygroundSession.getState().tabs[0]!
    const resolveConflict = vi.fn(() => null)
    usePlaygroundSession.setState({
      dirty: true,
      persistenceError: 'conflict',
      conflict: {
        tabId: tab.id,
        kind: 'content',
        localTab: {
          id: tab.id,
          title: tab.title,
          code: 'my local edit',
          titleVersion: tab.titleVersion,
          contentVersion: crypto.randomUUID(),
        },
        remoteTab: {
          id: tab.id,
          title: tab.title,
          code: 'other window edit',
          titleVersion: tab.titleVersion,
          contentVersion: crypto.randomUUID(),
        },
      },
      resolveConflict,
    })

    render(<PlaygroundView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert').textContent).toContain('未覆盖远端版本')
    fireEvent.click(screen.getByRole('button', { name: '另存为新标签页' }))
    expect(resolveConflict).toHaveBeenCalledWith('keep_copy')
    expect(screen.getByRole('alert').textContent).toContain('无法另存副本')
  })

  it('explains that an over-capacity rebase leaves both remote and local recovery choices intact', () => {
    const localTabId = crypto.randomUUID()
    const resolveConflict = vi.fn(() => null)
    usePlaygroundSession.setState({
      dirty: true,
      persistenceError: 'conflict',
      conflict: {
        tabId: localTabId,
        kind: 'capacity',
        localTab: {
          id: localTabId,
          title: 'Local draft',
          code: 'local()',
          titleVersion: crypto.randomUUID(),
          contentVersion: crypto.randomUUID(),
        },
        remoteTab: null,
      },
      resolveConflict,
    })

    render(<PlaygroundView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert').textContent)
      .toContain('已保存版本保持可用')
    fireEvent.click(screen.getByRole('button', { name: '另存为新标签页' }))
    fireEvent.click(screen.getByRole('button', { name: '使用已保存版本' }))
    expect(resolveConflict.mock.calls).toEqual([
      ['keep_copy'],
      ['use_remote'],
    ])
  })

  it('preserves an unflushed editor change when another browser tab commits first', async () => {
    const remote = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName: PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
        scope: 'workspace',
      }),
    })
    await remote.open()
    render(<PlaygroundView />, { wrapper: Wrapper })
    const editor = screen.getByTestId(
      'fake-playground-editor',
    ) as HTMLTextAreaElement

    fireEvent.change(editor, { target: { value: 'unflushed local edit' } })
    const tabId = remote.snapshot().tabs[0]!.id
    remote.setTabCode(tabId, 'committed remote edit')
    await remote.whenIdle()

    await waitFor(() => {
      expect(usePlaygroundSession.getState().persistenceError)
        .toBe('conflict')
    })
    expect(editor.value).toBe('unflushed local edit')
    expect(usePlaygroundSession.getState().conflict).toMatchObject({
      tabId,
      localTab: { code: 'unflushed local edit' },
      remoteTab: { code: 'committed remote edit' },
    })
    fireEvent.click(screen.getByRole('button', { name: '另存为新标签页' }))
    await usePlaygroundSession.getState().whenPersistenceIdle()
    expect(usePlaygroundSession.getState().persistenceError).toBeNull()
    expect(usePlaygroundSession.getState().tabs.map(tab => tab.initialCode))
      .toEqual(expect.arrayContaining([
        'committed remote edit',
        'unflushed local edit',
      ]))
    expect(editor.value).toBe('unflushed local edit')

    await remote.close()
  })

  it('keeps run progress isolated to the tab that started it', async () => {
    let finish!: (result: RunResult) => void
    runner.run.mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
      finish = resolve
    }))
    render(<PlaygroundView />, { wrapper: Wrapper })
    const firstTabId = usePlaygroundSession.getState().activeTabId

    fireEvent.click(screen.getByTestId('playground-run'))
    expect(screen.getByTestId('playground-run').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('playground-new-tab'))
    expect(screen.getByTestId('playground-run').hasAttribute('disabled')).toBe(false)

    await act(async () => finish({
      ok: true,
      phase: 'run',
      stdout: 'first done',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    expect(usePlaygroundSession.getState().tabs.find(
      tab => tab.id === firstTabId,
    )).toMatchObject({
      running: false,
      result: { stdout: 'first done' },
    })
    fireEvent.click(screen.getAllByRole('tab')[0])
    expect(await screen.findByText('first done')).toBeTruthy()
  })

  it('blocks a replacement run until an unmounted raw run really settles', async () => {
    let finishOld!: (result: RunResult) => void
    let finishNew!: (result: RunResult) => void
    runner.run
      .mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
        finishOld = resolve
      }))
      .mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
        finishNew = resolve
      }))
    render(<PlaygroundRouteHarness />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('playground-run'))
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(true)
    act(() => useWorkspaceStore.getState().setView('progress'))
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(false)

    act(() => useWorkspaceStore.getState().setView('playground'))
    fireEvent.click(await screen.findByTestId('playground-run'))
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(false)
    expect(runner.run).toHaveBeenCalledOnce()

    await act(async () => finishOld({
      ok: true,
      phase: 'run',
      stdout: 'stale result',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    expect(usePlaygroundSession.getState().tabs[0])
      .toMatchObject({ running: false, result: null })

    fireEvent.click(screen.getByTestId('playground-run'))
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(true)
    expect(runner.run).toHaveBeenCalledTimes(2)

    await act(async () => finishNew({
      ok: true,
      phase: 'run',
      stdout: 'current result',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    expect(await screen.findByText('current result')).toBeTruthy()
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(false)
  })

  it('releases a run when its workspace aborts even if the runner ignores the signal', async () => {
    let finish!: (result: RunResult) => void
    runner.run.mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
      finish = resolve
    }))
    render(<PlaygroundView />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('playground-run'))
    expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(true)
    act(() => workspaceAbortController.abort())
    await waitFor(() => {
      expect(usePlaygroundSession.getState().tabs[0]?.running).toBe(false)
    })

    await act(async () => finish({
      ok: true,
      phase: 'run',
      stdout: 'late result',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    expect(usePlaygroundSession.getState().tabs[0]?.result).toBeNull()
  })

  it('aborts an in-flight run when the source version changes', async () => {
    let finish!: (result: RunResult) => void
    runner.run.mockImplementationOnce(() => new Promise<RunResult>((resolve) => {
      finish = resolve
    }))
    render(<PlaygroundView />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('playground-run'))
    const signal = (runner.run.mock.calls[0] as unknown as [string, AbortSignal])[1]
    expect(signal.aborted).toBe(false)

    fireEvent.change(screen.getByTestId('fake-playground-editor'), {
      target: { value: 'main() { println("changed while running") }' },
    })
    await waitFor(() => {
      expect(signal.aborted).toBe(true)
      expect(usePlaygroundSession.getState().tabs[0]).toMatchObject({
        initialCode: 'main() { println("changed while running") }',
        running: false,
        result: null,
      })
    })

    await act(async () => finish({
      ok: true,
      phase: 'run',
      stdout: 'late result',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    }))
    expect(usePlaygroundSession.getState().tabs[0]?.result).toBeNull()
  })

  it('lets the learner resize the output panel with the keyboard and reset it', () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    const output = screen.getByTestId('playground-output')
    const resizer = screen.getByTestId('playground-output-resizer')
    expect(output.style.height).toBe('176px')
    expect(resizer.getAttribute('aria-valuenow')).toBe('176')

    fireEvent.keyDown(resizer, { key: 'ArrowUp' })
    expect(output.style.height).toBe('200px')
    expect(resizer.getAttribute('aria-valuenow')).toBe('200')

    fireEvent.keyDown(resizer, { key: 'Home' })
    expect(output.style.height).toBe('112px')

    fireEvent.keyDown(resizer, { key: 'End' })
    expect(output.style.height).toBe('480px')

    fireEvent.doubleClick(resizer)
    expect(output.style.height).toBe('176px')
  })

  it('shows the clean compiler diagnostic first and keeps runner noise collapsed', async () => {
    runner.run.mockResolvedValueOnce({
      ok: false,
      phase: 'compile',
      stdout: '',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: noisyCompilerError,
      compilerOutputTruncated: false,
      exitCode: null,
    })
    render(<PlaygroundView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId('playground-run'))

    const diagnostic = await screen.findByTestId('playground-stderr')
    expect(diagnostic.textContent).toContain('error: expected expression')
    expect(diagnostic.textContent).not.toContain('/opt/cangjie/bin/cjc')
    expect(diagnostic.textContent).not.toContain(ESC)
    expect(diagnostic.innerHTML).toContain('color:rgb(187,0,0)')
    expect(diagnostic.className).toContain('text-error-foreground')

    const raw = screen.getByTestId('playground-stderr-raw')
    expect(raw.getAttribute('open')).toBeNull()
    expect(raw.textContent).toContain('/opt/cangjie/bin/cjc')
    expect(raw.textContent).not.toContain(ESC)
  })

  it('renders runtime stdout and stderr as separate program channels', async () => {
    runner.run.mockResolvedValueOnce({
      ok: true,
      phase: 'run',
      stdout: 'answer on stdout',
      stdoutTruncated: true,
      stderr: 'warning on stderr',
      stderrTruncated: true,
      compilerOutput: 'compiler warning',
      compilerOutputTruncated: true,
      exitCode: 0,
    })
    render(<PlaygroundView />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('playground-run'))

    expect(await screen.findByText('answer on stdout')).toBeTruthy()
    expect(screen.getByTestId('playground-runtime-stderr').textContent)
      .toContain('warning on stderr')
    expect(screen.getByTestId('playground-runtime-stderr').className)
      .toContain('text-error-foreground')
    expect(screen.getByText('程序标准输出已截断。')).toBeTruthy()
    expect(screen.getByText('程序标准错误已截断。')).toBeTruthy()
    expect(screen.getByText('编译器输出已截断。')).toBeTruthy()
  })
})
