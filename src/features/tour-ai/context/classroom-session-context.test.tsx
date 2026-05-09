import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { ClassroomSessionProvider, useClassroomSession } from './classroom-session-context'

describe('classroomSessionContext', () => {
  const session = createInitialClassroomSession({ lang: 'zh' })
  const annotationState = createEditorAnnotationState()
  function dispatch() {}

  it('provides session/dispatch/hydrated/annotationState to subtree', () => {
    function wrapper({ children }: { children: React.ReactNode }) {
      return (
        <ClassroomSessionProvider value={{ session, dispatch, hydrated: true, annotationState }}>
          {children}
        </ClassroomSessionProvider>
      )
    }
    const { result } = renderHook(() => useClassroomSession(), { wrapper })
    expect(result.current.session).toBe(session)
    expect(result.current.hydrated).toBe(true)
    expect(result.current.annotationState).toBe(annotationState)
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomSession())).toThrow(/ClassroomSessionProvider/)
  })
})
