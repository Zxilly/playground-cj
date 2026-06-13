import { describe, expect, it } from 'vitest'
import { buildTeacherSystemPrompt } from './system-prompt'

describe('buildTeacherSystemPrompt', () => {
  describe('zh', () => {
    const prompt = buildTeacherSystemPrompt('zh')

    it('returns a non-trivial Chinese prompt', () => {
      expect(prompt.length).toBeGreaterThan(200)
    })

    it('requires search_docs before drawing factual conclusions', () => {
      expect(prompt).toContain('search_docs')
      expect(prompt).toMatch(/先.*search_docs|结论前.*search_docs/)
    })

    it('forbids parametric guessing about Cangjie', () => {
      expect(prompt).toMatch(/参数化臆测|臆测/)
    })

    it('states the equal-length quiz rule', () => {
      expect(prompt).toMatch(/选项.*等长|等长/)
    })

    it('states lesson must be short, single-takeaway, and inside the ZPD', () => {
      expect(prompt).toContain('ZPD')
      expect(prompt).toMatch(/单一收获|单一/)
      expect(prompt).toMatch(/短/)
    })

    it('requires a mission interview before producing lessons', () => {
      expect(prompt).toMatch(/mission/i)
      expect(prompt).toMatch(/访谈|未定/)
    })

    it('prefers structured blocks and treats raw_html as a fallback', () => {
      expect(prompt).toContain('raw_html')
      expect(prompt).toMatch(/兜底|仅当|优先.*结构块|结构块.*优先/)
    })

    it('scopes knowledge to Knowledge+Skills with no community/external resources', () => {
      expect(prompt).toMatch(/社区/)
      expect(prompt).toMatch(/外部资源|外部/)
    })
  })

  describe('en', () => {
    const prompt = buildTeacherSystemPrompt('en')

    it('returns a non-trivial English prompt', () => {
      expect(prompt.length).toBeGreaterThan(200)
    })

    it('requires search_docs before drawing factual conclusions', () => {
      expect(prompt).toContain('search_docs')
    })

    it('forbids parametric guessing about Cangjie', () => {
      expect(prompt).toMatch(/parametric|guess/i)
    })

    it('states the equal-length quiz rule', () => {
      expect(prompt).toMatch(/equal.length|equal length/i)
    })

    it('mentions ZPD and single takeaway', () => {
      expect(prompt).toContain('ZPD')
      expect(prompt).toMatch(/single/i)
    })

    it('requires a mission interview before producing lessons', () => {
      expect(prompt).toMatch(/mission/i)
      expect(prompt).toMatch(/interview/i)
    })

    it('prefers structured blocks and treats raw_html as a fallback', () => {
      expect(prompt).toContain('raw_html')
      expect(prompt).toMatch(/fallback/i)
    })

    it('scopes knowledge with no community/external resources', () => {
      expect(prompt).toMatch(/community/i)
      expect(prompt).toMatch(/external/i)
    })
  })
})
