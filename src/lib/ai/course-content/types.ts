import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import type { LocaleText } from '@/lib/ai/concept-graph/types'

export type CourseContentBlockContent = LessonContentBlock

export interface SourceReference {
  kind: 'static_tour'
  tourPath: string
  chapterId: string
  subChapterId?: string
  sectionId?: string
  language?: 'zh' | 'en'
  anchor?: string
}

export interface CoreContentBlock {
  blockId: string
  conceptId: string
  contentVersion: string
  order: number
  content: CourseContentBlockContent
  localizedContent?: Partial<Record<'zh' | 'en', CourseContentBlockContent>>
  sourceRefs: SourceReference[]
  runnable?: {
    status: 'runnable' | 'not_runnable'
    reason?: string
  }
}

export interface CourseConcept {
  conceptId: string
  title: LocaleText
  summary: LocaleText
  blockIds: string[]
  skillIds: string[]
}

export interface LearningSkill {
  skillId: string
  conceptIds: string[]
  title: LocaleText
  summary: LocaleText
  evidenceCriteria: string[]
}

export type ExerciseIntent = 'mainline' | 'placement_check' | 'review_check'
export type ExerciseMatchMode = 'exact' | 'contains' | 'regex'

export interface ExerciseTemplate {
  templateId: string
  templateVersion: string
  skillId: string
  conceptIds: string[]
  title: LocaleText
  prompt: LocaleText
  starterCode: string
  expectedOutput: string
  matchMode: ExerciseMatchMode
  intent: ExerciseIntent
  difficulty: 1 | 2 | 3 | 4 | 5
  sourceRefs: SourceReference[]
}

export interface LearningTrackDefinition {
  trackId: string
  title: LocaleText
  conceptIds: string[]
  skillIds: string[]
}

export interface CourseContentPack {
  packId: string
  contentVersion: string
  generatedAt: string
  concepts: CourseConcept[]
  blocks: CoreContentBlock[]
  skills: LearningSkill[]
  exerciseTemplates: ExerciseTemplate[]
  tracks: LearningTrackDefinition[]
}

export type ConceptValidationStatus = 'validated' | 'read_only' | 'invalid'

export interface ContentPackValidationIssue {
  path: string
  message: string
}

export interface ContentPackValidationResult {
  ok: boolean
  issues: ContentPackValidationIssue[]
  conceptStatuses: Record<string, ConceptValidationStatus>
}
