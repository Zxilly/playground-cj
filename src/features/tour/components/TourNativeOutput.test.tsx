import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TourNativeOutput } from './TourNativeOutput'

const native = vi.hoisted(() => ({
  state: { channels: new Map(), owner: undefined as object | undefined, parking: undefined as HTMLDivElement | undefined },
  ensureHost: vi.fn(),
  createChannel: vi.fn(),
  attach: vi.fn(),
  visible: new Set<(visible: boolean) => void>(),
  active: new Set<(id: string) => void>(),
  activeName: undefined as string | undefined,
}))

vi.mock('@/lib/hmr-store', () => ({
  HMR_SLOT_KEYS: { TOUR_OUTPUT_CHANNELS: 'tour.outputChannels' },
  hmrSlot: () => native.state,
}))
vi.mock('@/lib/monaco/vscode-api/extension-host', () => ({ ensureExtensionHost: native.ensureHost }))
vi.mock('@codingame/monaco-vscode-extension-api', () => ({
  window: { createOutputChannel: native.createChannel },
}))
vi.mock('@codingame/monaco-vscode-api/services', () => ({
  IOutputService: 'outputService',
  getService: async () => ({
    getActiveChannel: () => native.activeName ? { label: native.activeName } : undefined,
    getChannelDescriptor: (id: string) => ({ label: id }),
    onActiveOutputChannel: (listener: (id: string) => void) => {
      native.active.add(listener)
      return { dispose: () => native.active.delete(listener) }
    },
  }),
}))
vi.mock('@codingame/monaco-vscode-views-service-override', () => ({
  Parts: { PANEL_PART: 'native-panel' },
  renderPanelPart: native.attach,
  onPartVisibilityChange: (_part: string, listener: (visible: boolean) => void) => {
    native.visible.add(listener)
    return { dispose: () => native.visible.delete(listener) }
  },
  setPartVisibility: (_part: string, visible: boolean) => {
    native.visible.forEach(listener => listener(visible))
  },
}))

function selectChannel(name: string) {
  if (native.activeName === name)
    return
  native.activeName = name
  native.active.forEach(listener => listener(name))
}

const baseProps = {
  locale: 'en',
  expanded: true,
  revealRequest: 0,
  programOutput: '\x1B[32mhello\x1B[0m',
  compilerOutput: 'compiler diagnostics',
  activeTab: 'program' as const,
  onActiveTabChange: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  native.state.channels.clear()
  native.state.owner = undefined
  native.state.parking = undefined
  native.activeName = undefined
  native.active.clear()
  native.visible.clear()
  native.ensureHost.mockReset().mockResolvedValue(undefined)
  native.createChannel.mockReset().mockImplementation((name: string) => {
    const channel = {
      name,
      text: '',
      replace: vi.fn((text: string) => { channel.text = text }),
      clear: vi.fn(() => { channel.text = '' }),
      show: vi.fn(() => queueMicrotask(() => {
        selectChannel(name)
        native.visible.forEach(listener => listener(true))
      })),
      dispose: vi.fn(),
    }
    queueMicrotask(() => {
      if (!native.activeName)
        selectChannel(name)
    })
    return channel
  })
  const panel = document.createElement('div')
  panel.dataset.nativeOutputPane = ''
  native.attach.mockReset().mockImplementation((container: HTMLElement) => {
    container.append(panel)
    return { dispose: vi.fn() }
  })
  baseProps.onActiveTabChange.mockReset()
  baseProps.onClose.mockReset()
})

afterEach(() => {
  cleanup()
  native.state.parking?.remove()
})

describe('tourNativeOutput', () => {
  it('reveals the requested output on each run even when React selection is unchanged', async () => {
    const view = render(<TourNativeOutput {...baseProps} />)
    await waitFor(() => expect(native.activeName).toBe('Program Output'))
    const { program, tool } = native.state.channels.get('en')
    act(() => {
      program.clear()
      selectChannel('Cangjie')
    })
    expect(baseProps.onActiveTabChange).not.toHaveBeenCalled()

    view.rerender(<TourNativeOutput {...baseProps} revealRequest={1} />)
    await waitFor(() => expect(native.activeName).toBe('Program Output'))
    expect(program.show).toHaveBeenCalledTimes(2)
    expect(program.text).toBe('')
    expect(program.replace).toHaveBeenCalledExactlyOnceWith('hello')
    expect(tool.replace).toHaveBeenCalledExactlyOnceWith('compiler diagnostics')

    act(() => selectChannel('Cangjie'))
    view.rerender(<TourNativeOutput {...baseProps} revealRequest={1} />)
    expect(native.activeName).toBe('Cangjie')
    expect(program.show).toHaveBeenCalledTimes(2)
    view.rerender(<TourNativeOutput {...baseProps} revealRequest={2} expanded={false} />)
    expect(program.show).toHaveBeenCalledTimes(2)
  })

  it('honors the requested initial channel and keeps native Clear when changing selections', async () => {
    const view = render(<TourNativeOutput {...baseProps} activeTab="tool" />)
    await waitFor(() => expect(native.activeName).toBe('Compiler Output'))
    const { program, tool } = native.state.channels.get('en')
    expect(program.text).toBe('hello')
    expect(tool.text).toBe('compiler diagnostics')
    expect(baseProps.onActiveTabChange).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-native-output-pane]')).not.toBeNull()
    expect(view.container.querySelector('[role="tablist"]')).toBeNull()

    act(() => selectChannel('Program Output'))
    expect(baseProps.onActiveTabChange).toHaveBeenLastCalledWith('program')
    view.rerender(<TourNativeOutput {...baseProps} />)
    expect(program.show).not.toHaveBeenCalled()
    act(() => program.clear())
    view.rerender(<TourNativeOutput {...baseProps} activeTab="tool" />)
    await waitFor(() => expect(native.activeName).toBe('Compiler Output'))
    view.rerender(<TourNativeOutput {...baseProps} />)
    await waitFor(() => expect(native.activeName).toBe('Program Output'))
    expect(program.text).toBe('')
    expect(program.replace).toHaveBeenCalledExactlyOnceWith('hello')

    view.rerender(<TourNativeOutput {...baseProps} compilerOutput="next compiler message" />)
    expect(tool.text).toBe('next compiler message')
    expect(native.activeName).toBe('Program Output')
  })

  it('distinguishes native close from React collapse and reuses channels across remounts', async () => {
    const view = render(<TourNativeOutput {...baseProps} />)
    await waitFor(() => expect(native.activeName).toBe('Program Output'))
    const { program, tool } = native.state.channels.get('en')
    act(() => native.visible.forEach(listener => listener(false)))
    expect(baseProps.onClose).toHaveBeenCalledOnce()
    view.rerender(<TourNativeOutput {...baseProps} expanded={false} />)
    view.unmount()
    expect(baseProps.onClose).toHaveBeenCalledOnce()
    expect(native.active.size).toBe(0)
    expect(native.visible.size).toBe(0)
    expect(native.state.parking?.querySelector('[data-native-output-pane]')).not.toBeNull()
    expect(program.dispose).not.toHaveBeenCalled()
    expect(tool.dispose).not.toHaveBeenCalled()

    const remount = render(<TourNativeOutput {...baseProps} />)
    await waitFor(() => expect(native.attach).toHaveBeenCalledTimes(2))
    expect(native.createChannel).toHaveBeenCalledTimes(2)
    expect(remount.container.querySelector('[data-native-output-pane]')).not.toBeNull()
    act(() => selectChannel('Compiler Output'))
    expect(baseProps.onActiveTabChange).toHaveBeenLastCalledWith('tool')
  })

  it('does not create or attach channels after unmounting during extension-host startup', async () => {
    let ready!: () => void
    native.ensureHost.mockReturnValue(new Promise<void>((resolve) => {
      ready = resolve
    }))
    const view = render(<TourNativeOutput {...baseProps} />)
    view.unmount()
    await act(async () => {
      ready()
    })
    expect(native.createChannel).not.toHaveBeenCalled()
    expect(native.attach).not.toHaveBeenCalled()
    expect(baseProps.onClose).not.toHaveBeenCalled()
  })
})
