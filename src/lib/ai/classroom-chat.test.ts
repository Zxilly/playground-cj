/* eslint-disable prefer-arrow-callback */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildClassroomChatSystemPrompt, CLASSROOM_CHAT_SYSTEM_PROMPT, createClassroomChat } from './classroom-chat'

const toolLoopAgentMock = vi.hoisted(() => vi.fn(function ToolLoopAgent(options: unknown) {
  return { options }
}))
const createConfiguredModelMock = vi.hoisted(() => vi.fn(() => ({ model: 'configured' })))
const toolkitToToolSetMock = vi.hoisted(() => vi.fn(() => ({ read_classroom_state: { type: 'tool' } })))

vi.mock('ai', () => ({
  ToolLoopAgent: toolLoopAgentMock,
}))

vi.mock('./model-provider', () => ({
  createConfiguredModel: createConfiguredModelMock,
}))

vi.mock('./toolkit-to-tool-set', () => ({
  toolkitToToolSet: toolkitToToolSetMock,
}))

describe('chat contract', () => {
  beforeEach(() => {
    toolLoopAgentMock.mockClear()
    createConfiguredModelMock.mockClear()
    toolkitToToolSetMock.mockClear()
  })

  it('constructs chat with the classroom chat model name and converted tools', () => {
    const toolkit = {
      read_classroom_state: {
        parameters: { type: 'object' },
        execute: () => ({}),
      },
    } as Parameters<typeof createClassroomChat>[1]

    const chat = createClassroomChat({ apiKey: 'key' }, toolkit, 'zh')

    expect(createConfiguredModelMock).toHaveBeenCalledWith({ apiKey: 'key' }, 'tour-classroom-chat')
    expect(toolkitToToolSetMock).toHaveBeenCalledWith(toolkit)
    expect(toolLoopAgentMock).toHaveBeenCalledWith({
      model: { model: 'configured' },
      instructions: buildClassroomChatSystemPrompt('zh'),
      tools: { read_classroom_state: { type: 'tool' } },
    })
    expect(chat).toEqual({
      options: expect.objectContaining({
        instructions: buildClassroomChatSystemPrompt('zh'),
      }),
    })
  })

  it('adds the current user language to chat system instructions', () => {
    expect(buildClassroomChatSystemPrompt('zh')).toContain('The learner is using zh')
    expect(buildClassroomChatSystemPrompt('en')).toContain('The learner is using en')
  })

  it('keeps dynamic classroom state out of the static chat instructions', () => {
    expect(CLASSROOM_CHAT_SYSTEM_PROMPT).not.toContain('currentQuiz:')
    expect(CLASSROOM_CHAT_SYSTEM_PROMPT).not.toContain('lastRun:')
    expect(CLASSROOM_CHAT_SYSTEM_PROMPT).not.toContain('stream:')
    expect(CLASSROOM_CHAT_SYSTEM_PROMPT).not.toContain('ClassroomChat')
    expect(CLASSROOM_CHAT_SYSTEM_PROMPT).not.toContain('Agent')
  })
})
