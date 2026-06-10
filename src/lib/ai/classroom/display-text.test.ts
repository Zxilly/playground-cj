import { describe, expect, it } from 'vitest'
import { compactPlainText } from './display-text'

describe('compactPlainText', () => {
  it('strips html-like tags and condenses whitespace for learner-facing errors', () => {
    expect(compactPlainText('<html>\n<body><h1>502 Bad Gateway</h1></body>\n</html>')).toBe('502 Bad Gateway')
  })

  it('caps very long text', () => {
    expect(compactPlainText('a'.repeat(20), 8)).toBe('aaaaa...')
  })
})
