import { render, type RenderResult } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AIClassroomBridgeProvider } from './AIClassroomBridgeProvider'
import { useAIClassroomBridge } from './useAIClassroomBridge'

vi.mock('@/modules/cangjie-editor/context/useEditorBridge', () => ({
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

function renderProvider(stub: ReturnType<typeof makeStub>) {
  let captured: ReturnType<typeof useAIClassroomBridge> | null = null
  function Probe() {
    captured = useAIClassroomBridge()
    return null
  }
  const utils = render(
    <AIClassroomBridgeProvider allSections={[]} classroom={stub as never}>
      <Probe />
    </AIClassroomBridgeProvider>,
  )
  return { utils, get captured() { return captured! } }
}

describe('AIClassroomBridgeProvider', () => {
  it('forwards dispatch while mounted', () => {
    const stub = makeStub()
    const { captured } = renderProvider(stub)

    captured.classroom!.dispatch({ type: 'CONSUME_EVENT' } as never)

    expect(stub.dispatch).toHaveBeenCalledTimes(1)
  })

  it('drops dispatch calls after provider unmount', () => {
    const stub = makeStub()
    const { utils, get } = (() => {
      const stub2 = stub
      let captured: ReturnType<typeof useAIClassroomBridge> | null = null
      function Probe() {
        captured = useAIClassroomBridge()
        return null
      }
      const u = render(
        <AIClassroomBridgeProvider allSections={[]} classroom={stub2 as never}>
          <Probe />
        </AIClassroomBridgeProvider>,
      )
      return { utils: u, get: () => captured! }
    })()

    utils.unmount()
    get().classroom!.dispatch({ type: 'CONSUME_EVENT' } as never)
    expect(stub.dispatch).not.toHaveBeenCalled()
  })

  it('drops replaceChatAnnotations and clearChatAnnotations after unmount', () => {
    const stub = makeStub()
    let captured: ReturnType<typeof useAIClassroomBridge> | null = null
    function Probe() {
      captured = useAIClassroomBridge()
      return null
    }
    const utils = render(
      <AIClassroomBridgeProvider allSections={[]} classroom={stub as never}>
        <Probe />
      </AIClassroomBridgeProvider>,
    )

    utils.unmount()
    captured!.classroom!.replaceChatAnnotations([])
    captured!.classroom!.clearChatAnnotations()

    expect(stub.replaceChatAnnotations).not.toHaveBeenCalled()
    expect(stub.clearChatAnnotations).not.toHaveBeenCalled()
  })

  it('getSession still works after unmount (read-only is allowed)', () => {
    const stub = makeStub()
    stub.getSession.mockReturnValue({ snapshot: true })
    let captured: ReturnType<typeof useAIClassroomBridge> | null = null
    function Probe() {
      captured = useAIClassroomBridge()
      return null
    }
    const utils = render(
      <AIClassroomBridgeProvider allSections={[]} classroom={stub as never}>
        <Probe />
      </AIClassroomBridgeProvider>,
    )

    utils.unmount()
    const result = captured!.classroom!.getSession()
    expect(result).toEqual({ snapshot: true })
  })
})
