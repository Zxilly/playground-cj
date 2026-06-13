'use client'

import { use } from 'react'
import type { LessonNavigationContextValue } from './lesson-navigation-context'
import { LessonNavigationContext } from './lesson-navigation-context'

/** Access the workspace navigation actions from any lesson block. */
export function useLessonNavigation(): LessonNavigationContextValue {
  return use(LessonNavigationContext)
}
