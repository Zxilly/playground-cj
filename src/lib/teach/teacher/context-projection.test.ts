import { describe, expect, it } from 'vitest'
import { createContentPackCatalog } from '../classroom/content-catalog'
import { createEmptyClassroom } from '../classroom/state'
import { projectTeacherContext } from './context-projection'

describe('teacher context projection', () => {
  it('projects an empty live classroom through the domain interface', () => {
    const snapshot = createEmptyClassroom()

    const projection = projectTeacherContext({
      snapshot,
      catalog: createContentPackCatalog([]),
      scope: { mode: 'live', learningTrackId: null },
    })

    expect(projection).toMatchObject({
      teacherExposureActive: false,
      activeTrack: null,
      trackPolicy: null,
      concepts: [],
      chatScope: { mode: 'live', learningTrackId: null },
      displayedReviewContentVersion: null,
      recentAttempts: [],
      recentEvidence: [],
      activeExercises: [],
      retainedArtifacts: [],
      pendingRemediations: [],
      activeRetentionSuppressions: [],
    })
    expect(projection.collectionBounds.concepts).toEqual({
      matchedCount: 0,
      returnedCount: 0,
      limit: 64,
      truncated: false,
      strategy: 'scope-priority',
    })
    expect(snapshot).toEqual(createEmptyClassroom())
  })
})
