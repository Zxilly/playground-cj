// @vitest-environment node

import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { LanguageRegistration } from 'shiki/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import cangjieGrammar from '@/grammars/Cangjie.tmLanguage.json'

interface GrammarNode {
  include?: string
  patterns?: GrammarNode[]
  repository?: Record<string, GrammarNode>
}

function collectIncludes(node: GrammarNode, out: Set<string>) {
  if (typeof node.include === 'string' && node.include.startsWith('#'))
    out.add(node.include.slice(1))
  if (Array.isArray(node.patterns)) {
    for (const child of node.patterns)
      collectIncludes(child, out)
  }
  if (node.repository) {
    for (const value of Object.values(node.repository))
      collectIncludes(value, out)
  }
}

describe('cangjie TextMate grammar', () => {
  let highlighter: Awaited<ReturnType<typeof createHighlighterCore>>

  beforeAll(async () => {
    highlighter = await createHighlighterCore({
      themes: [import('shiki/themes/dark-plus.mjs')],
      langs: [cangjieGrammar as unknown as LanguageRegistration],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    })
  })

  afterAll(() => {
    highlighter?.dispose()
  })

  function detailedTokens(code: string) {
    return highlighter.codeToTokensBase(code, {
      lang: 'Cangjie',
      theme: 'dark-plus',
      includeExplanation: 'scopeName',
    })
  }

  function scopesOfExplanation(code: string, predicate: (content: string) => boolean): string[] {
    const lines = detailedTokens(code)
    for (const line of lines) {
      for (const token of line) {
        for (const explanation of token.explanation ?? []) {
          if (predicate(explanation.content))
            return explanation.scopes.map(s => s.scopeName)
        }
      }
    }
    return []
  }

  it('contains no dangling #include repository references', () => {
    const includes = new Set<string>()
    collectIncludes(cangjieGrammar as unknown as GrammarNode, includes)
    const repoKeys = new Set(Object.keys(cangjieGrammar.repository))
    const missing = [...includes].filter(name => !repoKeys.has(name))
    expect(missing).toEqual([])
  })

  it('scopes declaration keywords separately from declared names', () => {
    const classKeywordScopes = scopesOfExplanation('class Person {}', content => content.trim() === 'class')
    const classNameScopes = scopesOfExplanation('class Person {}', content => content.trim() === 'Person')
    expect(classKeywordScopes).toContain('keyword.control.Cangjie')
    expect(classKeywordScopes).not.toContain('support.class.Cangjie')
    expect(classNameScopes).toContain('support.class.Cangjie')

    const funcKeywordScopes = scopesOfExplanation('func greet() {}', content => content.trim() === 'func')
    const funcNameScopes = scopesOfExplanation('func greet() {}', content => content.trim() === 'greet')
    expect(funcKeywordScopes).toContain('keyword.control.Cangjie')
    expect(funcKeywordScopes).not.toContain('support.function.Cangjie')
    expect(funcNameScopes).toContain('support.function.Cangjie')

    const letKeywordScopes = scopesOfExplanation('let count = 1', content => content.trim() === 'let')
    const varNameScopes = scopesOfExplanation('let count = 1', content => content.trim() === 'count')
    expect(letKeywordScopes).toContain('keyword.control.Cangjie')
    expect(letKeywordScopes).not.toContain('support.variable.Cangjie')
    expect(varNameScopes).toContain('support.variable.Cangjie')
  })

  it('does not treat less-than comparisons as generic type annotations', () => {
    const rightOperandScopes = scopesOfExplanation('if (a < b) {}', content => content.trim() === 'b')
    expect(rightOperandScopes).not.toContain('support.class.Cangjie')
    expect(rightOperandScopes).toContain('support.variable.Cangjie')

    const genericTypeScopes = scopesOfExplanation('let xs: Array<MyItem>', content => content.trim() === 'MyItem')
    expect(genericTypeScopes).toContain('support.class.Cangjie')
  })

  it('preserves URLs with // inside string literals without breaking into comments', () => {
    const scopes = scopesOfExplanation(
      'let url = "https://example.com/a"',
      content => content.includes('https://example.com'),
    )
    expect(scopes).toContain('string.quoted.double.Cangjie')
    expect(scopes).not.toContain('comment.line.Cangjie')
  })

  it('matches # counts in raw strings and keeps content scoped as string', () => {
    const code = 'let s = ##"hello "# world"##'
    const innerScopes = scopesOfExplanation(code, content => content.includes('hello "# world'))
    expect(innerScopes).toContain('string.quoted.raw.Cangjie')
    expect(innerScopes).not.toContain('punctuation.definition.string.begin.Cangjie')
  })

  it('supports recursively nested block comments beyond 1 level', () => {
    const code = '/* outer /* mid /* inner */ stillMid */ stillOuter */ let x = 1'
    const outerScopes = scopesOfExplanation(code, content => content.includes('stillOuter'))
    expect(outerScopes).toContain('comment.block.Cangjie')

    const letScopes = scopesOfExplanation(code, content => content.trim() === 'let')
    expect(letScopes).toContain('keyword.control.Cangjie')
    expect(letScopes).not.toContain('comment.block.Cangjie')
  })

  it('respects word boundaries for rune/raw string prefixes and escape_string character class', () => {
    const runeScopes = scopesOfExplanation('let c = r\'a\'', content => content.includes('r\''))
    expect(runeScopes).toContain('string.quoted.single.Cangjie')

    const varScopes = scopesOfExplanation('var\'x\'', content => content === 'var')
    expect(varScopes).toContain('keyword.control.Cangjie')

    const escapeScopes = scopesOfExplanation('"a\\nb"', content => content === '\\n')
    expect(escapeScopes).toContain('constant.character.escape.string.byteArray.Cangjie')

    const pipeScopes = scopesOfExplanation('"a\\|b"', content => content.includes('\\|'))
    expect(pipeScopes).not.toContain('constant.character.escape.string.byteArray.Cangjie')
  })
})
