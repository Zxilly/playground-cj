import type { ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutputPanel } from '@/features/playground/components/OutputPanel'
import { NO_RUNNER_TRUNCATION } from '@/lib/runner-contract'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

vi.mock('@/app/font', () => ({
  fontFamily: 'monospace',
}))

describe('outputPanel', () => {
  afterEach(cleanup)

  it('renders tool and program output in separate labelled containers', () => {
    const { container } = render(
      <Wrapper>
        <OutputPanel
          toolOutput="compile ok"
          programOutput="hello world"
          truncation={NO_RUNNER_TRUNCATION}
        />
      </Wrapper>,
    )
    const panels = container.querySelectorAll('pre')

    screen.getByText('编译信息')
    screen.getByText('程序输出')
    expect(within(panels[0]).getByText('compile ok')).toBeTruthy()
    expect(within(panels[1]).getByText('hello world')).toBeTruthy()
  })

  it('renders ANSI output as HTML while escaping program text', () => {
    const { container } = render(
      <Wrapper>
        <OutputPanel
          toolOutput={'\u001B[32mok\u001B[0m'}
          programOutput="<script>alert(1)</script>"
          truncation={NO_RUNNER_TRUNCATION}
        />
      </Wrapper>,
    )
    const panels = container.querySelectorAll('pre')

    expect(panels[0].innerHTML).toContain('color:rgb(0,187,0)')
    expect(panels[1].querySelector('script')).toBeNull()
    expect(panels[1].textContent).toContain('<script>alert(1)</script>')
  })

  it('promotes the compiler diagnostic and keeps the ANSI runner command collapsed', () => {
    const { container } = render(
      <Wrapper>
        <OutputPanel
          toolOutput={'\u001B[36m$ /cangjie/bin/cjc main.cj\u001B[0m\nCangjie Compiler 1.1\n\u001B[31merror: expected expression\u001B[0m'}
          programOutput=""
          truncation={NO_RUNNER_TRUNCATION}
        />
      </Wrapper>,
    )

    const visibleCompiler = container.querySelector('pre')
    expect(visibleCompiler?.textContent).toContain('error: expected expression')
    expect(visibleCompiler?.textContent).not.toContain('/cangjie/bin/cjc')
    expect(visibleCompiler?.innerHTML).toContain('color:rgb(187,0,0)')
    const raw = screen.getByText('查看原始编译信息').closest('details')
    expect(raw?.getAttribute('open')).toBeNull()
    expect(raw?.textContent).toContain('/cangjie/bin/cjc')
  })

  it('renders truncation metadata as notices separate from channel text', () => {
    render(
      <Wrapper>
        <OutputPanel
          toolOutput="compiler prefix"
          programOutput="program prefix"
          truncation={{
            compilerOutput: true,
            programStdout: true,
            programStderr: true,
          }}
        />
      </Wrapper>,
    )

    expect(screen.getByText('编译器输出已截断。')).toBeTruthy()
    expect(screen.getByText('程序标准输出已截断。')).toBeTruthy()
    expect(screen.getByText('程序标准错误已截断。')).toBeTruthy()
  })
})
