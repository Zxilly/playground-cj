import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AIBridgeProvider } from '@/components/tour/EditorBridgeContext'
import { useLearnerStore } from '@/stores/learner'
import { QuizTestTabs } from '@/components/tour/ai/QuizTestTabs'

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <AIBridgeProvider lang="zh" allSections={[]}>
        {children}
      </AIBridgeProvider>
    </I18nProvider>
  )
}

function activateQuiz() {
  useLearnerStore.getState().setActiveQuiz({
    quizId: 'q-test',
    conceptId: 'cj.var.basic',
    prompt: { zh: '打印 42', en: 'Print 42' },
    expectedOutput: '42',
    matchMode: 'exact',
    startedAt: 1,
    attempts: 1,
  })
}

describe('QuizTestTabs', () => {
  afterEach(() => {
    useLearnerStore.getState().clear()
    if (typeof window !== 'undefined')
      window.localStorage.removeItem('tour-ai:learner:v1')
  })

  it('evaluates program output and switches to results after a run', async () => {
    activateQuiz()
    const view = render(
      <Wrapper>
        <QuizTestTabs programOutput="" />
      </Wrapper>,
    )

    screen.getByText('打印 42')

    view.rerender(
      <Wrapper>
        <QuizTestTabs programOutput={'42\n'} />
      </Wrapper>,
    )

    expect(await screen.findByText('通过')).toBeTruthy()
  })
})
