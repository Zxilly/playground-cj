/* eslint-disable react/component-hook-factories */
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuizPracticeCard } from './QuizPracticeCard'
import { ClassroomActivityProvider } from '@/features/tour-ai/context/classroom-activity-context'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'

vi.mock('@/features/tour/components/TourEditor', () => ({
  TourEditor: ({ code }: { code: string }) => <div data-testid="tour-editor">{code}</div>,
}))

vi.mock('@/const', () => ({
  examples: [],
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <ClassroomActivityProvider>{children}</ClassroomActivityProvider>
    </I18nProvider>
  )
}

describe('quizPracticeCard', () => {
  it('resets the live editor back to the quiz starter code', () => {
    const setValue = vi.fn()
    const bridge = {
      editor: {
        getEditor: () => ({ getModel: () => ({ setValue }) }),
        setEditor: vi.fn(),
      },
    } as unknown as AIClassroomBridgeValue

    render(
      <Wrapper>
        <QuizPracticeCard
          quiz={{
            id: 'quiz:1',
            conceptId: 'cj.hello',
            prompt: [{ text: 'Print hello.' }],
            starterCode: 'main() {\n    println("Hello")\n}',
            expectedOutput: 'Hello',
            matchMode: 'exact',
            status: 'active',
            createdAt: 1,
          }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={bridge}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '重置代码' }))

    expect(setValue).toHaveBeenCalledWith('main() {\n    println("Hello")\n}')
  })
})
