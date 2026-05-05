import { describe, expect, it, vi } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import { createClassroomTransaction } from './transaction'
import type { ClassroomAction } from './reducer'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'

function createBridge() {
  let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
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
    allSections: [],
    classroom: {
      getSession: () => session,
      dispatch,
      replaceChatAnnotations: vi.fn(),
      clearChatAnnotations: vi.fn(),
    },
  }

  return { bridge, dispatch, getSession: () => session }
}

describe('classroom transaction', () => {
  it('buffers LessonAuthor state changes until a single commit', () => {
    const { bridge, dispatch, getSession } = createBridge()
    const transaction = createClassroomTransaction(bridge)

    transaction.bridge.classroom?.dispatch({
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Let bindings', level: 2 }],
      now: 1001,
    })
    transaction.bridge.classroom?.dispatch({
      type: 'SET_CURRENT_QUIZ',
      quiz: {
        type: 'quiz',
        conceptId: 'cj.bindings.let',
        prompt: [{ text: 'Print 3.' }],
        starterCode: 'main() {\n    println(0)\n}',
        expectedOutput: '3',
        matchMode: 'exact',
      },
      now: 1002,
    })

    expect(dispatch).not.toHaveBeenCalled()
    expect(getSession().stream).toEqual([])
    expect(transaction.bridge.classroom?.getSession().phase).toBe('practice')
    expect(transaction.bridge.classroom?.getSession().currentQuiz?.conceptId).toBe('cj.bindings.let')

    transaction.commit([{ type: 'CONSUME_EVENT', now: 1003 }])

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'BATCH',
      actions: expect.arrayContaining([
        expect.objectContaining({ type: 'APPEND_LESSON_CONTENT' }),
        expect.objectContaining({ type: 'SET_CURRENT_QUIZ' }),
        expect.objectContaining({ type: 'CONSUME_EVENT' }),
      ]),
    })
    expect(getSession().phase).toBe('practice')
    expect(getSession().stream).toHaveLength(2)
  })

  it('discards buffered changes when LessonAuthor fails before commit', () => {
    const { bridge, dispatch, getSession } = createBridge()
    const transaction = createClassroomTransaction(bridge)

    transaction.bridge.classroom?.dispatch({
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Partial lesson', level: 2 }],
      now: 1001,
    })
    transaction.discard()

    expect(dispatch).not.toHaveBeenCalled()
    expect(getSession().stream).toEqual([])
    expect(transaction.bridge.classroom?.getSession().stream).toEqual([])
  })
})
