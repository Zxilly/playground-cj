import { describe, expect, it } from 'vitest'
import { createBuiltInCourseContentPackCatalog } from '@/lib/teach/classroom/built-in-course'
import { resolveTopicToConceptId } from './topic-resolution'

describe('topic resolution from ?topic= query param', () => {
  const catalog = createBuiltInCourseContentPackCatalog('en')

  it('matches exact concept IDs', () => {
    expect(resolveTopicToConceptId('cj.var.immutable', catalog)).toBe('cj.var.immutable')
    expect(resolveTopicToConceptId('CJ.PROGRAM.MAIN', catalog)).toBe('cj.program.main')
  })

  it('matches tour step source references', () => {
    expect(resolveTopicToConceptId('01-welcome/01-intro/01', catalog)).toBe('cj.program.main')
  })

  it('matches short concept segments and titles', () => {
    expect(resolveTopicToConceptId('println', catalog)).toBe('cj.io.println')
    expect(resolveTopicToConceptId('mutable', catalog)).toBe('cj.var.mutable')
    expect(resolveTopicToConceptId('Program entry', catalog)).toBe('cj.program.main')
  })

  it('returns null for blank or unknown topics', () => {
    expect(resolveTopicToConceptId('', catalog)).toBeNull()
    expect(resolveTopicToConceptId('completely-unknown-topic', catalog)).toBeNull()
  })
})
