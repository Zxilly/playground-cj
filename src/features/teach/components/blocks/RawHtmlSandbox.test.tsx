import { act, cleanup, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RawHtmlBlockSchemaType } from '@/lib/teach/lessons/blocks'
import { RawHtmlSandbox } from './RawHtmlSandbox'

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

const block: RawHtmlBlockSchemaType = {
  type: 'raw_html',
  html: '<div id="widget">hello sandbox</div>',
}

/**
 * Dispatch a window `message` event whose `source` is the sandbox iframe's
 * contentWindow so the component's origin/source guard treats it as trusted.
 */
function postFromIframe(iframe: HTMLIFrameElement, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data,
      source: iframe.contentWindow,
    }))
  })
}

describe('rawHtmlSandbox', () => {
  it('renders an iframe with the html in srcDoc', () => {
    render(<RawHtmlSandbox block={block} />)
    const iframe = screen.getByTestId('raw-html-sandbox') as HTMLIFrameElement
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('srcdoc')).toContain('hello sandbox')
  })

  it('sandboxes scripts but never grants same-origin', () => {
    render(<RawHtmlSandbox block={block} />)
    const iframe = screen.getByTestId('raw-html-sandbox')
    const sandbox = iframe.getAttribute('sandbox') ?? ''
    expect(sandbox.split(/\s+/)).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
  })

  it('injects a CSP meta tag into the document', () => {
    render(<RawHtmlSandbox block={block} />)
    const srcDoc = screen.getByTestId('raw-html-sandbox').getAttribute('srcdoc') ?? ''
    expect(srcDoc).toContain('http-equiv="Content-Security-Policy"')
  })

  it('forwards a teach:run message to the runner', () => {
    const onRun = vi.fn()
    render(<RawHtmlSandbox block={block} onRun={onRun} />)
    const iframe = screen.getByTestId('raw-html-sandbox') as HTMLIFrameElement
    postFromIframe(iframe, { type: 'teach:run', code: 'main() {}' })
    expect(onRun).toHaveBeenCalledWith('main() {}')
  })

  it('adjusts iframe height on a teach:height message', () => {
    render(<RawHtmlSandbox block={block} />)
    const iframe = screen.getByTestId('raw-html-sandbox') as HTMLIFrameElement
    postFromIframe(iframe, { type: 'teach:height', px: 420 })
    expect(iframe.style.height).toBe('420px')
  })

  it('ignores non-whitelisted message types', () => {
    const onRun = vi.fn()
    render(<RawHtmlSandbox block={block} onRun={onRun} />)
    const iframe = screen.getByTestId('raw-html-sandbox') as HTMLIFrameElement
    const before = iframe.style.height
    postFromIframe(iframe, { type: 'teach:eval', code: 'steal()' })
    postFromIframe(iframe, { type: 'navigate', url: 'http://evil' })
    expect(onRun).not.toHaveBeenCalled()
    expect(iframe.style.height).toBe(before)
  })

  it('ignores messages whose source is not the sandbox iframe', () => {
    const onRun = vi.fn()
    render(<RawHtmlSandbox block={block} onRun={onRun} />)
    act(() => {
      // No `source`, so it cannot be the iframe's contentWindow.
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'teach:run', code: 'x' } }))
    })
    expect(onRun).not.toHaveBeenCalled()
  })
})
