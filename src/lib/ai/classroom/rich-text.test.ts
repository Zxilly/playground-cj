import { describe, expect, it } from 'vitest'
import { richTextPlainText, richTextToMarkdown } from './rich-text'

describe('richTextToMarkdown', () => {
  it('passes plain text through with markdown metacharacters escaped', () => {
    expect(richTextToMarkdown([{ type: 'text', text: 'hello world' }])).toBe('hello world')
    expect(richTextToMarkdown([{ type: 'text', text: 'use *star* and _under_' }])).toBe('use \\*star\\* and \\_under\\_')
  })

  it('renders strong spans as **bold**', () => {
    expect(richTextToMarkdown([{ type: 'strong', text: 'important' }])).toBe('**important**')
  })

  it('renders inline code spans with backticks', () => {
    expect(richTextToMarkdown([{ type: 'code', code: 'let x = 1' }])).toBe('`let x = 1`')
  })

  it('escapes pathological inline code containing backticks', () => {
    // CommonMark §6.1: use a longer fence than any backtick run inside the code,
    // and pad with a space when the code starts or ends with a backtick.
    expect(richTextToMarkdown([{ type: 'code', code: 'foo `bar` baz' }])).toBe('``foo `bar` baz``')
    expect(richTextToMarkdown([{ type: 'code', code: '`leading' }])).toBe('`` `leading ``')
  })

  it('emits a fenced block for multi-line code, honouring the language hint', () => {
    const md = richTextToMarkdown([{ type: 'code', code: 'main() {\n  println("hi")\n}', lang: 'cangjie' }])
    expect(md).toBe('\n\n```cangjie\nmain() {\n  println("hi")\n}\n```\n\n')
  })

  it('mixes spans inline in order', () => {
    const md = richTextToMarkdown([
      { type: 'text', text: 'use ' },
      { type: 'code', code: 'let' },
      { type: 'text', text: ' for ' },
      { type: 'strong', text: 'immutable' },
      { type: 'text', text: ' bindings' },
    ])
    expect(md).toBe('use `let` for **immutable** bindings')
  })
})

describe('richTextPlainText', () => {
  it('joins spans into a stripped plaintext string', () => {
    expect(richTextPlainText([
      { type: 'text', text: 'use ' },
      { type: 'code', code: 'let' },
      { type: 'strong', text: ' for immutable' },
    ])).toBe('use let for immutable')
  })
})
