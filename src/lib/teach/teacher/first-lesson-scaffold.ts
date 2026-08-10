import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'

export interface FirstLessonScaffoldDependencies {
  catalog: ContentPackCatalog
  classroom: AIClassroom
  learningTrackId: string
  turnSignal: AbortSignal
}

/**
 * Complete the authored first-lesson surface when a provider returns useful
 * prose but omits one or both classroom mutation tools. The active Track id is
 * also the deterministic Tutoring Step id, so concurrent browser tabs replay
 * the same two commands instead of creating duplicate lesson cards.
 */
export async function ensureFirstLessonScaffold({
  catalog,
  classroom,
  learningTrackId,
  turnSignal,
}: FirstLessonScaffoldDependencies): Promise<void> {
  turnSignal.throwIfAborted()
  let snapshot = classroom.snapshot()
  if (snapshot.activeTrackId !== learningTrackId)
    return
  const track = snapshot.tracks.find(candidate => candidate.id === learningTrackId)
  const conceptId = track?.conceptIds[0]
  const contentVersion = conceptId && track?.contentVersions[conceptId]
  if (!track || !conceptId || !contentVersion)
    return

  const pack = catalog.require(conceptId, contentVersion)
  const keySkillIds = new Set(
    pack.learningSkills.filter(skill => skill.key).map(skill => skill.id),
  )
  const practiceTemplate = pack.exerciseTemplates.find(template =>
    template.purpose === 'practice'
    && keySkillIds.has(template.learningSkillId))
  ?? pack.exerciseTemplates.find(template => template.purpose === 'practice')
  if (!practiceTemplate) {
    throw new Error(
      `Course Content Pack ${conceptId}@${contentVersion} has no first-lesson Practice template`,
    )
  }

  const trackEntries = () => classroom.snapshot().stream.filter(entry =>
    entry.learningTrackId === learningTrackId
    && entry.conceptId === conceptId)
  if (!trackEntries().some(entry => entry.type === 'content_reference_group')) {
    await classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: learningTrackId,
      conceptId,
      learningSkillId: practiceTemplate.learningSkillId,
      blockIds: pack.blocks.map(block => block.id),
    }, {
      commitGuard: {
        assertActive: () => turnSignal.throwIfAborted(),
      },
    })
  }

  turnSignal.throwIfAborted()
  snapshot = classroom.snapshot()
  if (
    snapshot.activeTrackId === learningTrackId
    && !trackEntries().some(entry => entry.type === 'exercise_instance')
  ) {
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: learningTrackId,
      conceptId,
      contentVersion,
      templateId: practiceTemplate.id,
      personalizationInputs: {},
    }, {
      commitGuard: {
        assertActive: () => turnSignal.throwIfAborted(),
      },
    })
  }
}
