import { describe, expect, it, vi } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import { createClassroomTransaction } from './transaction'
import type { ClassroomAction } from './reducer'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'

function createBridge() {
  let session = createInitialClassroomSession({ lang: 'zh' })
  const dispatch = vi.fn((action: ClassroomAction) => {
    session = classroomReducer(session, action)
  })

  const bridge: AIClassroomBridgeValue = {
    editor: {
      getEditor: () => undefined,
      setEditor: () => {},
    },
    lang: 'zh',
    uiLang: 'zh',
    classroom: {
      getSession: () => session,
      dispatch,
      replaceChatAnnotations: vi.fn(),
      clearChatAnnotations: vi.fn(),
    },
  }

  return { bridge, dispatch, getSession: () => session }
}

const exerciseAction: ClassroomAction = {
  type: 'CREATE_EXERCISE_INSTANCE',
  exercise: {
    templateId: 'cj.io.println.print-value.cangjie',
    templateVersion: '2026-05-28',
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    prompt: 'Print Cangjie.',
    starterCode: '',
    expectedOutput: 'Cangjie',
    matchMode: 'exact',
    intent: 'mainline',
    personalizationInputs: { summary: 'test' },
  },
  now: 1002,
}

describe('classroom transaction', () => {
  it('buffers orchestration state changes until a single commit', () => {
    const { bridge, dispatch, getSession } = createBridge()
    const transaction = createClassroomTransaction(bridge)

    transaction.bridge.classroom?.dispatch({
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })
    transaction.bridge.classroom?.dispatch(exerciseAction)

    expect(dispatch).not.toHaveBeenCalled()
    expect(getSession().stream).toEqual([])
    expect(transaction.bridge.classroom?.getSession().phase).toBe('practice')
    expect(transaction.bridge.classroom?.getSession().currentExercise?.skillId).toBe('cj.io.println.print-value')

    transaction.commit([{ type: 'CONSUME_EVENT', now: 1003 }])

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'BATCH',
      actions: [
        expect.objectContaining({ type: 'APPEND_CONTENT_REFERENCE_GROUP' }),
        expect.objectContaining({ type: 'CREATE_EXERCISE_INSTANCE' }),
        expect.objectContaining({ type: 'CONSUME_EVENT' }),
      ],
    })
    expect(getSession().phase).toBe('practice')
    expect(getSession().stream).toHaveLength(2)
  })

  it('discards buffered changes when orchestration fails before commit', () => {
    const { bridge, dispatch, getSession } = createBridge()
    const transaction = createClassroomTransaction(bridge)

    transaction.bridge.classroom?.dispatch({
      type: 'APPEND_BRIDGE_NOTE',
      conceptIds: ['cj.io.println'],
      body: 'Partial note',
      now: 1001,
    })
    transaction.discard()

    expect(dispatch).not.toHaveBeenCalled()
    expect(getSession().stream).toEqual([])
    expect(transaction.bridge.classroom?.getSession().stream).toEqual([])
  })
})
