import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AIClassroomBridgeProvider } from './AIClassroomBridgeProvider'
import { useAIClassroomBridge } from './useAIClassroomBridge'

vi.mock('@/modules/cangjie-editor/context/useEditorBridge', () => ({
  // eslint-disable-next-line react/component-hook-factories
  useEditorBridge: () => ({
    editor: { getEditor: () => null, setEditor: vi.fn() },
    lang: 'zh',
  }),
}))

function makeStub() {
  return {
    getSession: vi.fn(),
    dispatch: vi.fn(),
    replaceChatAnnotations: vi.fn(),
    clearChatAnnotations: vi.fn(),
  }
}

// Module-level probe component — captures bridge value into the module-level variable.
// Must be reset to null before each test that uses it.
let capturedBridge: ReturnType<typeof useAIClassroomBridge> | null = null
function BridgeProbe() {
  capturedBridge = useAIClassroomBridge()
  return null
}

function renderProvider(stub: ReturnType<typeof makeStub>) {
  capturedBridge = null
  const utils = render(
    <AIClassroomBridgeProvider allSections={[]} classroom={stub as never}>
      <BridgeProbe />
    </AIClassroomBridgeProvider>,
  )
  return {
    utils,
    get captured() {
      return capturedBridge!
    },
  }
}

describe('aIClassroomBridgeProvider', () => {
  it('forwards dispatch while mounted', () => {
    const stub = makeStub()
    const { captured } = renderProvider(stub)

    captured.classroom!.dispatch({ type: 'CONSUME_EVENT' } as never)

    expect(stub.dispatch).toHaveBeenCalledTimes(1)
  })

  it('drops dispatch calls after provider unmount', () => {
    const stub = makeStub()
    const { utils, captured } = renderProvider(stub)
    const savedCapture = captured

    utils.unmount()
    savedCapture.classroom!.dispatch({ type: 'CONSUME_EVENT' } as never)
    expect(stub.dispatch).not.toHaveBeenCalled()
  })

  it('drops replaceChatAnnotations and clearChatAnnotations after unmount', () => {
    const stub = makeStub()
    const { utils, captured } = renderProvider(stub)
    const savedCapture = captured

    utils.unmount()
    savedCapture.classroom!.replaceChatAnnotations([])
    savedCapture.classroom!.clearChatAnnotations()

    expect(stub.replaceChatAnnotations).not.toHaveBeenCalled()
    expect(stub.clearChatAnnotations).not.toHaveBeenCalled()
  })

  it('getSession still works after unmount (read-only is allowed)', () => {
    const stub = makeStub()
    stub.getSession.mockReturnValue({ snapshot: true })
    const { utils, captured } = renderProvider(stub)
    const savedCapture = captured

    utils.unmount()
    const result = savedCapture.classroom!.getSession()
    expect(result).toEqual({ snapshot: true })
  })
})
