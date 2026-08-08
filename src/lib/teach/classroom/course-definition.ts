/** Ordered Concepts that form the current AI Mode Course. */
export const CURRENT_COURSE_CONCEPT_IDS = [
  'cj.program.main',
  'cj.io.println',
  'cj.var.immutable',
  'cj.var.mutable',
] as const

export type CurrentCourseConceptId = typeof CURRENT_COURSE_CONCEPT_IDS[number]
