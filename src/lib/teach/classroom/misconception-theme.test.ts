import { describe, expect, it } from 'vitest'
import { classroomCommandSchema } from './ai-classroom'
import { misconceptionThemeSchema } from './misconception-theme'

describe('misconception theme', () => {
  it('accepts meaningful Unicode text', () => {
    expect(misconceptionThemeSchema.parse('重新赋值！')).toBe('重新赋值！')
  })

  it.each(['!!!', '😀🔥', '  —  '])(
    'rejects punctuation-only normalized themes: %s',
    (theme) => {
      expect(misconceptionThemeSchema.safeParse(theme).success).toBe(false)
    },
  )

  it('rejects empty-normalized themes at both retention command boundaries', () => {
    expect(classroomCommandSchema.safeParse({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:clarification',
      conceptId: 'concept:one',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: '!!!',
      markdown: 'Useful explanation.',
    }).success).toBe(false)
    expect(classroomCommandSchema.safeParse({
      type: 'retain_remediation',
      artifactId: 'artifact:remediation',
      failedAttemptId: 'attempt:one',
      misconceptionTheme: '😀🔥',
      markdown: 'Useful diagnosis.',
    }).success).toBe(false)
  })
})
