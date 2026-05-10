import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { ClassroomSessionProvider } from '@/features/tour-ai/context/classroom-session-context'
import { ViewportRefProvider } from '@/features/tour-ai/context/classroom-viewport-context'
import { ClassroomChapterIndex } from './ClassroomChapterIndex'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function renderWith(session: ReturnType<typeof createInitialClassroomSession>) {
  const ref: { current: HTMLDivElement | null } = { current: null }
  return render(
    <Wrapper>
      <ClassroomSessionProvider value={{
        session,
        dispatch: () => {},
        hydrated: true,
        annotationState: createEditorAnnotationState(),
      }}
      >
        <ViewportRefProvider value={ref}>
          <ClassroomChapterIndex />
        </ViewportRefProvider>
      </ClassroomSessionProvider>
    </Wrapper>,
  )
}

describe('classroomChapterIndex', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders disabled trigger when stream has no headings', () => {
    renderWith(createInitialClassroomSession({ lang: 'zh' }))
    const btn = screen.getByRole('button', { name: /课程目录/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders enabled trigger with headings present', () => {
    const base = createInitialClassroomSession({ lang: 'zh' })
    const session = {
      ...base,
      stream: [{
        id: 's1',
        type: 'lesson_blocks' as const,
        createdAt: 1,
        blocks: [
          { type: 'heading' as const, text: '入门', level: 2 as const },
          { type: 'heading' as const, text: '语法', level: 2 as const },
        ],
      }],
    }
    renderWith(session)
    const btn = screen.getByRole('button', { name: /课程目录/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })
})
