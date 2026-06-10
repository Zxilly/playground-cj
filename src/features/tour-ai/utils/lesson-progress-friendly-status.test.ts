import { beforeAll, describe, expect, it } from 'vitest'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { CLASSROOM_CHAT_TOOL_NAMES } from '@/lib/ai/classroom-chat'
import {
  LESSON_GENERATION_TOOL_NAMES,
  LESSON_ORCHESTRATION_TOOL_NAMES,
} from '@/features/tour-ai/agent/toolkit/lesson-toolkit-metadata'
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
    // If this fails, a new lesson-generation tool was added
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

  it('uses specific learner-facing labels for each orchestration action', () => {
    expect(LESSON_ORCHESTRATION_TOOL_NAMES).toEqual(new Set([
      'append_content_reference_group',
      'append_bridge_note',
      'append_skip_marker',
      'create_exercise_instance',
      'save_clarification',
      'save_remediation',
    ]))
    expect(Object.fromEntries([...LESSON_ORCHESTRATION_TOOL_NAMES].map(name => [name, friendlyToolStatus(name).label]))).toEqual({
      append_content_reference_group: '正在准备讲解内容',
      append_bridge_note: '正在连接学习路径',
      append_skip_marker: '正在记录跳过内容',
      create_exercise_instance: '正在准备练习题',
      save_clarification: '正在保存复习说明',
      save_remediation: '正在保存练习提示',
    })
  })
})
