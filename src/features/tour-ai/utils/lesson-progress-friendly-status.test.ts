import { beforeAll, describe, expect, it } from 'vitest'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { LESSON_GENERATION_TOOL_NAMES } from '@/lib/ai/lesson-generation'
import { CLASSROOM_CHAT_TOOL_NAMES } from '@/lib/ai/classroom-chat'
import { friendlyToolStatus } from './lesson-progress-friendly-status'

beforeAll(() => {
  // friendlyToolStatus uses Lingui `t\`\`` template macros which read from the
  // global i18n singleton. Without an active locale, the runtime throws.
  // The empty messages bag makes `t` echo the source text, which is enough
  // for our assertions (we only inspect category + check the label is a
  // non-empty string).
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  globalI18n.load({ zh: i18n.messages })
  globalI18n.activate('zh')
})

describe('friendlyToolStatus', () => {
  it('returns a non-unknown category for every lesson-generation tool', () => {
    // If this fails, a new authoring tool was added to lesson-generation
    // without an explicit friendly label — the panel would silently show
    // "AI 正在处理…" for it. Add a mapping in lesson-progress-friendly-status.ts.
    const offenders = LESSON_GENERATION_TOOL_NAMES.filter(
      name => friendlyToolStatus(name).category === 'unknown',
    )
    expect(offenders).toEqual([])
  })

  it('returns a non-unknown category for every classroom chat tool', () => {
    const offenders = CLASSROOM_CHAT_TOOL_NAMES.filter(
      name => friendlyToolStatus(name).category === 'unknown',
    )
    expect(offenders).toEqual([])
  })

  it('falls through to category=unknown for tool names it has not been taught', () => {
    expect(friendlyToolStatus('totally_made_up_tool')).toMatchObject({
      category: 'unknown',
    })
  })

  it('groups all authoring tools under the same authoring category + label', () => {
    const authoring = [
      'append_heading',
      'append_paragraph',
      'append_concept_card',
      'append_code_example',
      'append_callout',
      'append_steps',
      'append_compare',
    ]
    const labels = new Set(authoring.map(n => friendlyToolStatus(n).label))
    expect(labels.size).toBe(1)
    expect([...labels][0]).toMatch(/编写/)
  })
})
