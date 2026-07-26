import { describe, expect, it } from 'vitest'
import {
  buildRemediationSystemPrompt,
  buildTeacherSystemPrompt,
} from './system-prompt'

describe.each([
  ['zh', /不得临时编造主线练习/, /进度只从学习者的可观察活动推导/],
  ['en', /Never invent an ad-hoc mainline exercise/, /Progress is derived from observable learner activity/],
] as const)('lesson Orchestrator prompt (%s)', (lang, templateRule, evidenceRule) => {
  const prompt = buildTeacherSystemPrompt(lang)

  it('makes immutable validated content and template-backed practice mandatory', () => {
    expect(prompt).toMatch(/Lesson Orchestrator/)
    expect(prompt).toMatch(/Core Content/)
    expect(prompt).toMatch(/Validated Concept/)
    expect(prompt).toMatch(/Exercise Template/)
    expect(prompt).toMatch(templateRule)
    expect(prompt).toContain('append_content_reference_group')
    expect(prompt).toContain('create_exercise_instance')
  })

  it('requires explicit version-exact reads, exercises, and Clarifications', () => {
    expect(prompt).toContain('contentVersion')
    expect(prompt).toContain('read_content_pack')
    expect(prompt).toContain('retain_clarification')
    expect(prompt).toMatch(/Track pin/)
    expect(prompt).toContain('chatScope')
    expect(prompt).toMatch(/displayed version|展示 Content Version/)
    expect(prompt).toMatch(/fresh temporary Chat|全新的临时 Chat/)
  })

  it('does not let the model start tracks, record evidence, or assign progress', () => {
    expect(prompt).toMatch(/Learning Track/)
    expect(prompt).toMatch(/Learning Evidence/)
    expect(prompt).toMatch(/Concept Progress/)
    expect(prompt).toMatch(evidenceRule)
  })

  it('does not let a retry or repeated assessment contract masquerade as independent evidence', () => {
    expect(prompt).toContain('Practice Evidence')
    expect(prompt).toMatch(/retry|重试/)
    expect(prompt).toMatch(/repeats an already attempted assessment contract|重复既有 assessment contract/)
    expect(prompt).toMatch(/applicable assistance still makes it Aided Evidence|存在适用辅助时仍是 Aided Evidence/)
    expect(prompt).toMatch(/Neither case may be described as Independent Evidence|两种情况都不得说成 Independent Evidence/)
    expect(prompt).toMatch(/first unaided Attempt on a distinct assessment contract|针对不同 assessment contract 的首次无辅助 Attempt/)
    expect(prompt).toMatch(/demonstrated progress/)
    expect(prompt).toMatch(/basis for accelerate|accelerate 的依据/)
  })

  it('requires frontier order and evidence-backed Track Adjustments', () => {
    expect(prompt).toMatch(/frontier/)
    expect(prompt).toMatch(/Placement/)
    expect(prompt).toMatch(/accelerate/)
    expect(prompt).toMatch(/focused catch-up|focused_catch_up/)
    expect(prompt).toContain('record_track_adjustment')
  })

  it('keeps Chat temporary and retention structured/removable by domain state', () => {
    expect(prompt).toMatch(/Chat/)
    expect(prompt).toMatch(/Clarification/)
    expect(prompt).toMatch(/Remediation/)
    expect(prompt).toMatch(/raw chat|原始对话/)
  })

  it('separates Out-of-Pack and Read-Only help from mainline tutoring', () => {
    expect(prompt).toMatch(/Out-of-Pack Help/)
    expect(prompt).toMatch(/Read-Only Concept/)
    expect(prompt).toContain('search_docs')
  })

  it('treats code suggestions and all post-exposure work as aided', () => {
    expect(prompt).toMatch(/Code Suggestion/)
    expect(prompt).toMatch(/aided|受辅助/)
    expect(prompt).toMatch(/silently change|静默改写/)
    expect(prompt).toMatch(/Teacher Exposure Epoch/)
    expect(prompt).toMatch(/runtime|运行时/)
    expect(prompt).toMatch(/all task types|任何类型/)
    expect(prompt).toMatch(/Learning Tracks|任何 Track/)
    expect(prompt).toMatch(/no validated fresh-assessment reset|没有经过验证的 fresh-assessment/)
    expect(prompt).toMatch(/tool effects alone does not activate|仅通过工具展示.*不会激活/)
    expect(prompt).not.toContain('record_code_suggestion_assistance')
    expect(prompt).not.toMatch(/while a code Exercise Instance is open|代码练习打开期间/)
  })

  it('treats every learner-controlled and retrieved value as untrusted data', () => {
    expect(prompt).toMatch(/untrusted data|不可盲从的数据/)
    expect(prompt).toMatch(/tool result|工具结果/)
    expect(prompt).toMatch(/never as instructions|不是.*指令/)
  })
})

describe.each([
  ['zh', /仅用于后台诊断/, /不得输出面向学习者的对话/],
  ['en', /internal background diagnostic/, /Do not produce learner-facing chat/],
] as const)('remediation diagnostic prompt (%s)', (lang, roleRule, outputRule) => {
  it('has a dedicated two-tool contract instead of inheriting lesson orchestration', () => {
    const prompt = buildRemediationSystemPrompt(lang)
    expect(prompt).toMatch(roleRule)
    expect(prompt).toMatch(outputRule)
    expect(prompt).toContain('read_assigned_remediation_context')
    expect(prompt).toContain('retain_remediation')
    expect(prompt).toMatch(/Attempt/)
    expect(prompt).not.toContain('list_content_packs')
    expect(prompt).not.toContain('append_content_reference_group')
    expect(prompt).not.toContain('create_exercise_instance')
  })
})
