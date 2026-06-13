import { cleanup, render as rtlRender, screen, within } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GlossaryTerm } from '@/lib/teach/workspace/documents'
import { GlossaryProvider } from '@/features/teach/context/GlossaryProvider'
import { ProseBlock } from './ProseBlock'
import { HeadingBlock } from './HeadingBlock'
import { CalloutBlock } from './CalloutBlock'
import { CodeSampleBlock } from './CodeSampleBlock'
import { GlossaryRefBlock } from './GlossaryRefBlock'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

describe('proseBlock', () => {
  it('renders markdown text', () => {
    render(<ProseBlock block={{ type: 'prose', markdown: 'Hello **world**' }} />)
    expect(screen.getByText('world')).toBeTruthy()
    expect(screen.getByText('world').tagName).toBe('STRONG')
  })

  it('renders one citation per provided citation', () => {
    render(
      <ProseBlock
        block={{
          type: 'prose',
          markdown: 'see docs',
          citations: [
            { sourceId: 'cangjie-mcp', ref: 'std/option', title: 'Option' },
            { sourceId: 'cangjie-mcp', ref: 'std/array', title: 'Array' },
          ],
        }}
      />,
    )
    const citations = screen.getAllByTestId('block-citation')
    expect(citations).toHaveLength(2)
    expect(citations[0].textContent).toContain('Option')
  })

  it('renders no citation list when there are no citations', () => {
    render(<ProseBlock block={{ type: 'prose', markdown: 'no refs' }} />)
    expect(screen.queryByTestId('block-citation')).toBeNull()
  })
})

describe('headingBlock', () => {
  it('renders an h2 for level 2', () => {
    render(<HeadingBlock block={{ type: 'heading', level: 2, text: 'Section' }} />)
    const heading = screen.getByRole('heading', { name: 'Section' })
    expect(heading.tagName).toBe('H2')
  })

  it('renders an h3 for level 3', () => {
    render(<HeadingBlock block={{ type: 'heading', level: 3, text: 'Sub' }} />)
    expect(screen.getByRole('heading', { name: 'Sub' }).tagName).toBe('H3')
  })
})

describe('calloutBlock', () => {
  it('marks the variant via data attribute', () => {
    render(<CalloutBlock block={{ type: 'callout', variant: 'warning', markdown: 'careful' }} />)
    const root = screen.getByTestId('callout-block')
    expect(root.getAttribute('data-variant')).toBe('warning')
    expect(root.textContent).toContain('careful')
  })

  it('renders insight variant differently from note', () => {
    render(<CalloutBlock block={{ type: 'callout', variant: 'note', markdown: 'a' }} />)
    const note = screen.getByTestId('callout-block').className
    cleanup()
    render(<CalloutBlock block={{ type: 'callout', variant: 'insight', markdown: 'b' }} />)
    const insight = screen.getByTestId('callout-block').className
    expect(note).not.toBe(insight)
  })
})

describe('codeSampleBlock', () => {
  it('renders the code and the language', () => {
    render(
      <CodeSampleBlock
        block={{ type: 'code_sample', code: 'main() {}', language: 'cangjie' }}
      />,
    )
    const code = screen.getByTestId('code-sample-code')
    expect(code.textContent).toContain('main() {}')
    expect(code.getAttribute('data-language')).toBe('cangjie')
  })

  it('renders the optional explanation when present', () => {
    render(
      <CodeSampleBlock
        block={{
          type: 'code_sample',
          code: 'x',
          language: 'cangjie',
          explanation: 'this declares x',
        }}
      />,
    )
    expect(screen.getByText('this declares x')).toBeTruthy()
  })

  it('omits the explanation region when absent', () => {
    render(<CodeSampleBlock block={{ type: 'code_sample', code: 'x', language: 'cangjie' }} />)
    expect(screen.queryByTestId('code-sample-explanation')).toBeNull()
  })
})

describe('glossaryRefBlock', () => {
  const terms: GlossaryTerm[] = [
    { term: 'binding', definition: 'a name bound to a value', avoid: ['variable'], addedAt: 1 },
  ]

  it('renders the term definition when the term exists in the glossary', () => {
    render(
      <GlossaryProvider terms={terms}>
        <GlossaryRefBlock block={{ type: 'glossary_ref', term: 'binding' }} />
      </GlossaryProvider>,
    )
    const card = screen.getByTestId('glossary-ref')
    expect(within(card).getByText('binding')).toBeTruthy()
    expect(card.textContent).toContain('a name bound to a value')
  })

  it('matches the term case-insensitively', () => {
    render(
      <GlossaryProvider terms={terms}>
        <GlossaryRefBlock block={{ type: 'glossary_ref', term: 'Binding' }} />
      </GlossaryProvider>,
    )
    expect(screen.getByTestId('glossary-ref').textContent).toContain('a name bound to a value')
  })

  it('renders a placeholder when the term is not in the glossary', () => {
    render(
      <GlossaryProvider terms={terms}>
        <GlossaryRefBlock block={{ type: 'glossary_ref', term: 'unknown' }} />
      </GlossaryProvider>,
    )
    expect(screen.getByTestId('glossary-ref-missing')).toBeTruthy()
    expect(screen.queryByTestId('glossary-ref')).toBeNull()
  })
})
