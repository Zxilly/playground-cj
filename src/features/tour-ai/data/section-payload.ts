import type { FlatSection } from '@/tour/types'

export function createAIClassroomSections(allSections: FlatSection[]): FlatSection[] {
  const current = allSections[0]
  if (!current)
    return []

  return [{
    chapterId: current.chapterId,
    chapterSlug: current.chapterSlug,
    chapterStep: current.chapterStep,
    chapterName: current.chapterName,
    subChapterId: current.subChapterId,
    subChapterName: current.subChapterName,
    sectionId: current.sectionId,
    sectionName: current.sectionName,
    markdown: { zh: '', en: '' },
    code: current.code,
  }]
}
