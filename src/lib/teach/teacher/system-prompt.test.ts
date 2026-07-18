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

    it('describes driving the learner\'s active code_task editor', () => {
      expect(prompt).toContain('read_editor_code')
      expect(prompt).toContain('set_editor_code')
    })

    it('makes the central workspace primary and chat auxiliary', () => {
      expect(prompt).toContain('中央工作区是主交互面')
      expect(prompt).toMatch(/Chat.*附属|附属.*Chat/)
      expect(prompt).toContain('navigate_workspace')
      expect(prompt).toMatch(/整个中央工作区路由/)
    })

    it('routes temporary and pre-mission code to the visible Playground', () => {
      expect(prompt).toContain('open_playground_tab')
      expect(prompt).toContain('mission 确立前')
      expect(prompt).toMatch(/不要.*直接 run_code/)
      expect(prompt).toContain('多个 tab')
    })

    it('requires self-consistent code-task output judging without exposing schema retries', () => {
      expect(prompt).toMatch(/expectedOutput.*逐字/)
      expect(prompt).toMatch(/自由填写.*不得使用固定 exact/)
      expect(prompt).toMatch(/不要.*叙述 JSON.*schema/)
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
      expect(prompt).toMatch(/equal.length/i)
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

    it('describes driving the learner\'s active code_task editor', () => {
      expect(prompt).toContain('read_editor_code')
      expect(prompt).toContain('set_editor_code')
    })

    it('makes the central workspace primary and chat auxiliary', () => {
      expect(prompt).toMatch(/central workspace.*primary interaction surface/i)
      expect(prompt).toMatch(/Chat is auxiliary/i)
      expect(prompt).toContain('navigate_workspace')
      expect(prompt).toMatch(/entire central route/i)
    })

    it('routes temporary and pre-mission code to the visible Playground', () => {
      expect(prompt).toContain('open_playground_tab')
      expect(prompt).toMatch(/pre-mission code.*MUST go to Playground/i)
      expect(prompt).toMatch(/multiple tabs/i)
      expect(prompt).toMatch(/Do not substitute.*direct run_code/i)
    })

    it('requires self-consistent code-task output judging without exposing schema retries', () => {
      expect(prompt).toMatch(/expectedOutput must exactly match/i)
      expect(prompt).toMatch(/open-ended values.*fixed exact output/i)
      expect(prompt).toMatch(/Do not narrate JSON.*schema validation/i)
    })
  })
})
