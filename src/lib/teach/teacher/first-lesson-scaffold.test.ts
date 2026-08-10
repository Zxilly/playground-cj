import { describe, expect, it } from 'vitest'
import { createAIClassroom } from '@/lib/teach/classroom/ai-classroom'
import {
  BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS,
  createBuiltInCourseContentPackCatalog,
} from '@/lib/teach/classroom/built-in-course'
import { createMemoryClassroomStorage } from '@/lib/teach/classroom/storage'
import { ensureFirstLessonScaffold } from './first-lesson-scaffold'

async function firstLesson() {
  const catalog = createBuiltInCourseContentPackCatalog('en')
  const classroom = createAIClassroom({
    catalog,
    storage: createMemoryClassroomStorage(),
  })
  await classroom.open()
  const conceptId = BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS[0]!
  await classroom.execute({
    type: 'start_learning_track',
    trackId: 'track:first-lesson',
    goal: 'Write a minimal Cangjie program.',
    conceptIds: [conceptId],
    explicitLearnerGoal: true,
  })
  return { catalog, classroom, conceptId }
}

describe('first lesson scaffold', () => {
  it('creates authored content and a practice exercise exactly once', async () => {
    const { catalog, classroom, conceptId } = await firstLesson()
    const turnSignal = new AbortController().signal

    await Promise.all([
      ensureFirstLessonScaffold({
        catalog,
        classroom,
        learningTrackId: 'track:first-lesson',
        turnSignal,
      }),
      ensureFirstLessonScaffold({
        catalog,
        classroom,
        learningTrackId: 'track:first-lesson',
        turnSignal,
      }),
    ])

    const entries = classroom.snapshot().stream.filter(entry =>
      entry.learningTrackId === 'track:first-lesson')
    expect(entries.map(entry => entry.type)).toEqual([
      'content_reference_group',
      'exercise_instance',
    ])
    expect(entries.every(entry => entry.conceptId === conceptId)).toBe(true)
    expect(entries.filter(entry => 'tutoringStepId' in entry).every(
      entry => entry.tutoringStepId === 'track:first-lesson',
    ))
      .toBe(true)
  })

  it('fills only the missing exercise after a provider appended content', async () => {
    const { catalog, classroom, conceptId } = await firstLesson()
    const pack = catalog.require(conceptId)
    await classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId: 'track:first-lesson',
      tutoringStepId: 'teacher:model-content',
      conceptId,
      learningSkillId: pack.learningSkills[0]!.id,
      blockIds: pack.blocks.map(block => block.id),
    })

    await ensureFirstLessonScaffold({
      catalog,
      classroom,
      learningTrackId: 'track:first-lesson',
      turnSignal: new AbortController().signal,
    })

    const entries = classroom.snapshot().stream.filter(entry =>
      entry.learningTrackId === 'track:first-lesson')
    expect(entries.filter(entry => entry.type === 'content_reference_group'))
      .toHaveLength(1)
    expect(entries.filter(entry => entry.type === 'exercise_instance'))
      .toHaveLength(1)
  })

  it('does not commit after the turn is aborted', async () => {
    const { catalog, classroom } = await firstLesson()
    const turn = new AbortController()
    turn.abort(new DOMException('Learner stopped the turn', 'AbortError'))

    await expect(ensureFirstLessonScaffold({
      catalog,
      classroom,
      learningTrackId: 'track:first-lesson',
      turnSignal: turn.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(classroom.snapshot().stream).toEqual([])
  })
})
