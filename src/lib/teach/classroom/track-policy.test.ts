import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createAIClassroom } from './ai-classroom'
import { createContentPackCatalog } from './content-catalog'
import { createMemoryClassroomStorage } from './storage'
import { deriveTrackPolicyState } from './track-policy'

function trackPack(
  conceptId: string,
  expectedOutput: string,
): CourseContentPack {
  const suffix = conceptId.split('.').at(-1)!
  const skillId = `skill:${suffix}`
  const task = (purpose: 'practice' | 'placement' | 'review') => ({
    id: `template:${suffix}:${purpose}`,
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningSkillId: skillId,
    purpose,
    task: {
      type: 'code_output' as const,
      prompt: `${purpose} ${conceptId}`,
      starterCode: 'main() {}',
      expectedOutput: purpose === 'review'
        ? `${expectedOutput}:review`
        : expectedOutput,
      matchMode: 'exact' as const,
      sourceRequirements: [{ type: 'top_level_main' as const }],
      hints: [],
    },
  })
  return {
    id: `pack:${conceptId}`,
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: conceptId,
      title: conceptId,
      summary: `Learn ${conceptId}.`,
      prerequisites: [],
    },
    blocks: [
      {
        id: `block:${suffix}`,
        type: 'prose',
        markdown: `Core Content for ${conceptId}.`,
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '02-basics/01-bindings/01',
          title: conceptId,
        }],
      },
      {
        id: `block:${suffix}:program`,
        type: 'code_sample',
        code: `main() {\n    println("${expectedOutput}")\n}`,
        language: 'cangjie',
        sampleType: 'program',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '02-basics/01-bindings/01',
          title: conceptId,
        }],
      },
    ],
    learningSkills: [{
      id: skillId,
      conceptId,
      title: `Use ${conceptId}`,
      description: `Demonstrate ${conceptId}.`,
      key: true,
    }],
    exerciseTemplates: [
      task('practice'),
      task('placement'),
      task('review'),
    ],
    review: {
      status: 'approved',
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

describe('learning Track policy candidates', () => {
  it('derives complete bounded adjustment bases after recent windows would lose their IDs', async () => {
    const first = trackPack('track.first', '1')
    const second = trackPack('track.second', '2')
    const third = trackPack('track.third', '3')
    const catalog = createContentPackCatalog([first, second, third])
    let generatedId = 0
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++generatedId}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++generatedId}`,
      goal: 'Keep adjustment provenance discoverable',
      conceptIds: ['track.first', 'track.second', 'track.third'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'placement:second',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:placement',
      personalizationInputs: {},
    })
    const secondPlacement = classroom.snapshot().stream.at(-1)!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:second-placement',
      exerciseInstanceId: secondPlacement.id,
      submission: {
        type: 'code_output',
        code: 'main() { println(2) }',
      },
      observation: {
        type: 'run_result',
        result: {
          ok: true,
          phase: 'run',
          stdout: '2',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: 0,
        },
      },
    })
    const accelerateEvidenceId = classroom.snapshot().evidence.at(-1)!.id

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'placement:third',
      conceptId: 'track.third',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:third:placement',
      personalizationInputs: {},
    })
    const thirdPlacement = classroom.snapshot().stream.at(-1)!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:third-placement',
      exerciseInstanceId: thirdPlacement.id,
      submission: {
        type: 'code_output',
        code: 'main() { println(0) }',
      },
      observation: {
        type: 'run_result',
        result: {
          ok: true,
          phase: 'run',
          stdout: '0',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: 0,
        },
      },
    })
    const catchUpEvidenceId = classroom.snapshot().evidence.at(-1)!.id

    await classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'content:first',
      conceptId: 'track.first',
      learningSkillId: 'skill:first',
      blockIds: ['block:first'],
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'practice:first',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const firstPractice = classroom.snapshot().stream.at(-1)!
    const encounterId = firstPractice.id
    for (let index = 1; index <= 65; index += 1) {
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: `attempt:first-failure:${index}`,
        exerciseInstanceId: firstPractice.id,
        submission: {
          type: 'code_output',
          code: 'main() { println(0) }',
        },
        observation: {
          type: 'run_result',
          result: {
            ok: true,
            phase: 'run',
            stdout: '0',
            stdoutTruncated: false,
            stderr: '',
            stderrTruncated: false,
            compilerOutput: '',
            compilerOutputTruncated: false,
            exitCode: 0,
          },
        },
      })
    }

    const snapshot = classroom.snapshot()
    const track = snapshot.tracks[0]
    const policy = deriveTrackPolicyState(snapshot, track, catalog)
    expect(policy.adjustmentCandidates).toEqual({
      accelerate: [{
        type: 'accelerate',
        conceptId: 'track.second',
        placementEvidenceId: accelerateEvidenceId,
      }],
      focusedCatchUp: [{
        type: 'focused_catch_up',
        conceptId: 'track.third',
        failureEvidenceId: catchUpEvidenceId,
      }],
      review: [{
        type: 'review',
        conceptId: 'track.first',
        encounteredStreamEntryId: encounterId,
      }],
      delay: {
        type: 'delay',
        conceptId: 'track.first',
        nextConceptId: 'track.second',
        blockedEvidenceIds: snapshot.evidence.slice(-3).map(item => item.id),
      },
    })
  })

  it('rejects a Track larger than the complete capability projection limit', async () => {
    const onlyPack = trackPack('track.only', '1')
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([onlyPack]),
      storage: createMemoryClassroomStorage(),
    })
    await classroom.open()

    await expect(classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Too large for one bounded capability projection',
      conceptIds: Array.from(
        { length: 65 },
        (_, index) => `track.concept.${index}`,
      ),
      explicitLearnerGoal: true,
    } as never)).rejects.toThrow(/64|too big|maximum/i)
  })
})
