import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClassroomScrollFollower } from './ClassroomScrollFollower'

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

describe('classroomScrollFollower', () => {
  it('renders nothing when visible=false', () => {
    const { container } = render(
      <Wrapper>
        <ClassroomScrollFollower visible={false} onClick={() => {}} />
      </Wrapper>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders accessible button when visible=true', () => {
    const onClick = vi.fn()
    render(
      <Wrapper>
        <ClassroomScrollFollower visible={true} onClick={onClick} />
      </Wrapper>,
    )
    const btn = screen.getByRole('button', { name: /滚动到最新/ })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
