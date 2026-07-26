import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TeachMarkdown } from './TeachMarkdown'

describe('teach Markdown trust boundary', () => {
  it('never creates image requests and renders generated links as inert text', () => {
    const { container } = render(
      <TeachMarkdown markdown={'[encoded editor](https://attacker.invalid/?code=secret)\n\n![pixel](https://attacker.invalid/pixel)'} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('encoded editor')).toBeTruthy()
    expect(screen.getByText('[pixel]')).toBeTruthy()
  })

  it('allows safe links from validated content but still omits images', () => {
    const { container } = render(
      <TeachMarkdown
        source="validated"
        markdown={'[docs](https://developer.huawei.com/)\n\n![diagram](https://example.com/diagram.png)'}
      />,
    )

    expect(screen.getByRole('link', { name: 'docs' }).getAttribute('href'))
      .toBe('https://developer.huawei.com/')
    expect(container.querySelector('img')).toBeNull()
  })

  it('rejects protocol-relative, credential-bearing, and script links from validated content', () => {
    const { container } = render(
      <TeachMarkdown
        source="validated"
        markdown={[
          '[protocol relative](//attacker.invalid/path)',
          '[credentials](https://learner:secret@attacker.invalid/path)',
          '[script](javascript:alert(1))',
        ].join('\n\n')}
      />,
    )

    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('protocol relative')).toBeTruthy()
    expect(screen.getByText('credentials')).toBeTruthy()
    expect(screen.getByText('script')).toBeTruthy()
  })
})
