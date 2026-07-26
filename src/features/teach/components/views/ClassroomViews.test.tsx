import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { createAIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import type { CourseContentPack } from '@/lib/teach/classroom/content-packs'
import type { ClassroomStorage } from '@/lib/teach/classroom/storage'
import { createMemoryClassroomStorage } from '@/lib/teach/classroom/storage'
import { LiveClassroomView } from './LiveClassroomView'
import { ReviewView } from './ReviewView'
import { ConceptProgressView } from './ConceptProgressView'

function pack(): CourseContentPack {
  const task = {
    type: 'code_output' as const,
    prompt: 'Print hello',
    starterCode: 'main() {}',
    expectedOutput: 'hello',
    matchMode: 'exact' as const,
    sourceRequirements: [{ type: 'top_level_main' as const }],
    hints: ['Call println from main.'],
  }
  return {
    id: 'pack:cj.program.main',
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: 'cj.program.main',
      title: 'Program entry',
      summary: 'Start and run a Cangjie program.',
      prerequisites: [],
    },
    blocks: [
      {
        id: 'block:intro',
        type: 'prose' as const,
        markdown: 'A program starts at `main`.',
        sourceReferences: [{
          sourceId: 'static-tour' as const,
          ref: '01-basics/01-program/01',
          title: 'Program entry',
        }],
      },
      {
        id: 'block:sample',
        type: 'code_sample' as const,
        code: 'main() {}',
        language: 'cangjie' as const,
        sampleType: 'program' as const,
        sourceReferences: [{
          sourceId: 'static-tour' as const,
          ref: '01-basics/01-program/02',
          title: 'Program sample',
        }],
      },
    ],
    learningSkills: [{
      id: 'skill:run-main',
      conceptId: 'cj.program.main',
      title: 'Run main',
      description: 'Run a program entry point.',
      key: true,
    }],
    exerciseTemplates: [
      {
        id: 'template:practice',
        version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningSkillId: 'skill:run-main',
        purpose: 'practice' as const,
        task,
      },
      {
        id: 'template:review',
        version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningSkillId: 'skill:run-main',
        purpose: 'review' as const,
        task: {
          ...task,
          expectedOutput: 'hello review',
        },
      },
    ],
    review: {
      status: 'approved' as const,
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

function dependentPack() {
  const next = structuredClone(pack())
  next.id = 'pack:cj.io.println'
  next.concept = {
    id: 'cj.io.println',
    title: 'Print output',
    summary: 'Write a value to standard output.',
    prerequisites: ['cj.program.main'],
  }
  next.blocks[0].id = 'block:println:intro'
  next.blocks[1].id = 'block:println:sample'
  next.learningSkills[0] = {
    id: 'skill:println',
    conceptId: 'cj.io.println',
    title: 'Print a value',
    description: 'Call println from main.',
    key: true,
  }
  next.exerciseTemplates = next.exerciseTemplates.map(template => ({
    ...template,
    id: `${template.id}:println`,
    learningSkillId: 'skill:println',
  }))
  return next
}

function renamedPack(index: number): CourseContentPack {
  const next = structuredClone(pack())
  const conceptId = `cj.capacity.${index}`
  next.id = `pack:${conceptId}`
  next.concept = {
    id: conceptId,
    title: `Capacity concept ${index}`,
    summary: `Capacity fixture ${index}.`,
    prerequisites: [],
  }
  next.blocks = next.blocks.map(block => ({
    ...block,
    id: `${block.id}:${index}`,
  }))
  next.learningSkills = [{
    ...next.learningSkills[0],
    id: `skill:capacity:${index}`,
    conceptId,
  }]
  next.exerciseTemplates = next.exerciseTemplates.map(template => ({
    ...template,
    id: `${template.id}:capacity:${index}`,
    learningSkillId: `skill:capacity:${index}`,
  }))
  return next
}

async function setup(packs = [pack()]) {
  const catalog = createContentPackCatalog(packs)
  let sequence = 0
  const classroom = createAIClassroom({
    catalog,
    storage: createMemoryClassroomStorage(),
    now: () => 1_000 + sequence,
    createId: () => `generated-${++sequence}`,
  })
  await classroom.open()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider
      lang="en"
      classroom={classroom}
      catalog={catalog}
      knowledge={{ id: 'test', search: async () => [] }}
      runner={{ run: async () => ({ ok: true, phase: 'run', stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 }) }}
      activeEditor={createActiveEditorRegistry()}
      now={() => 2_000}
    >
      {children}
    </WorkspaceProvider>
  )
  return { catalog, classroom, wrapper }
}

function workspaceWrapper(
  classroom: ReturnType<typeof createAIClassroom>,
  catalog: ReturnType<typeof createContentPackCatalog>,
  now: () => number = () => 2_000,
) {
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider
      lang="en"
      classroom={classroom}
      catalog={catalog}
      knowledge={{ id: 'test', search: async () => [] }}
      runner={{ run: async () => ({ ok: true, phase: 'run', stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 }) }}
      activeEditor={createActiveEditorRegistry()}
      now={now}
    >
      {children}
    </WorkspaceProvider>
  )
}

function activeTrackId(classroom: ReturnType<typeof createAIClassroom>): string {
  const id = classroom.snapshot().activeTrackId
  if (!id)
    throw new Error('expected an active Learning Track')
  return id
}

function createControlledExposureStorage() {
  const backing = createMemoryClassroomStorage()
  let markStarted!: () => void
  let releaseSave!: () => void
  let rejectSave!: (reason: Error) => void
  let intercepted = false
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  const saveGate = new Promise<void>((resolve, reject) => {
    releaseSave = resolve
    rejectSave = reject
  })
  const storage: ClassroomStorage = {
    load: backing.load,
    save: async (snapshot, expectedRevision) => {
      if (snapshot.teacherExposureEpoch && !intercepted) {
        intercepted = true
        markStarted()
        await saveGate
      }
      await backing.save(snapshot, expectedRevision)
    },
  }
  return {
    storage,
    started,
    release: releaseSave,
    reject: rejectSave,
  }
}

afterEach(() => {
  cleanup()
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})

describe('aI Classroom views', () => {
  it('labels Concept Progress as browser-local self-practice rather than attested evidence', async () => {
    const { classroom, wrapper } = await setup()

    render(<ConceptProgressView />, { wrapper })

    expect(screen.getByText(
      'This is browser-local self-practice progress, not a server-attested assessment or credential.',
    )).toBeTruthy()
    classroom.dispose()
  })

  it('starts a Learning Track only after an explicit learner form submission', async () => {
    const { classroom, wrapper } = await setup()
    render(<LiveClassroomView />, { wrapper })
    expect(classroom.snapshot().activeTrackId).toBeNull()
    fireEvent.change(screen.getByLabelText('What do you want to be able to do?'), {
      target: { value: 'Build small Cangjie programs independently' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start Learning Track' }))
    await waitFor(() => expect(classroom.snapshot().activeTrackId).not.toBeNull())
    expect(await screen.findByText('Build small Cangjie programs independently')).toBeTruthy()
    classroom.dispose()
  })

  it('renders compiler diagnostics by phase without misclassifying a runtime failure', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'compile-failure',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const compileExercise = classroom.snapshot().stream.find(
      entry => entry.type === 'exercise_instance',
    )!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:compile-failure',
      exerciseInstanceId: compileExercise.id,
      submission: { type: 'code_output', code: 'main() {' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: 'compile',
          stdout: '',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: 'error: expected expression',
          compilerOutputTruncated: true,
          exitCode: null,
        },
      },
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'runtime-failure',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const runtimeExercise = classroom.snapshot().stream.filter(
      entry => entry.type === 'exercise_instance',
    ).at(-1)!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:runtime-failure',
      exerciseInstanceId: runtimeExercise.id,
      submission: { type: 'code_output', code: 'main() { println("panic") }' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: 'run',
          stdout: 'panic',
          stdoutTruncated: true,
          stderr: 'runtime panic diagnostic',
          stderrTruncated: true,
          compilerOutput: 'compiler warning before execution',
          compilerOutputTruncated: true,
          exitCode: 2,
        },
      },
    })

    render(<LiveClassroomView />, { wrapper })

    expect(screen.getAllByTestId('exercise-compiler-output')).toHaveLength(1)
    expect(screen.getByTestId('exercise-compiler-output').textContent)
      .toContain('error: expected expression')
    expect(screen.getByText('runtime panic diagnostic')).toBeTruthy()
    expect(screen.getByText('compiler warning before execution')).toBeTruthy()
    expect(screen.getAllByText('Compiler output was truncated.')).toHaveLength(2)
    expect(screen.getByText('Program stdout was truncated.')).toBeTruthy()
    expect(screen.getByText('Program stderr was truncated.')).toBeTruthy()
    classroom.dispose()
  })

  it('lets the learner bound a Track to one target and its prerequisites', async () => {
    const { classroom, wrapper } = await setup([pack(), dependentPack()])
    render(<LiveClassroomView />, { wrapper })
    fireEvent.change(screen.getByLabelText('What do you want to be able to do?'), {
      target: { value: 'Understand the program entry point' },
    })
    fireEvent.change(screen.getByLabelText('How far should this track go?'), {
      target: { value: 'cj.program.main' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start Learning Track' }))
    await waitFor(() => expect(classroom.snapshot().activeTrackId).not.toBeNull())
    expect(classroom.snapshot().tracks[0]?.conceptIds).toEqual(['cj.program.main'])
    classroom.dispose()
  })

  it('does not silently truncate a course that exceeds one Learning Track', async () => {
    const { classroom, wrapper } = await setup(
      Array.from({ length: 65 }, (_, index) => renamedPack(index)),
    )
    render(<LiveClassroomView />, { wrapper })
    fireEvent.change(screen.getByLabelText('What do you want to be able to do?'), {
      target: { value: 'Choose an explicit bounded target' },
    })

    expect(screen.getByRole('alert').textContent).toContain(
      'one Learning Track can contain at most 64',
    )
    expect((screen.getByRole('button', {
      name: 'Start Learning Track',
    }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('How far should this track go?'), {
      target: { value: 'cj.capacity.0' },
    })
    expect(screen.queryByText(/one Learning Track can contain at most 64/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start Learning Track' }))
    await waitFor(() => expect(classroom.snapshot().activeTrackId).not.toBeNull())
    expect(classroom.snapshot().tracks[0]?.conceptIds).toEqual(['cj.capacity.0'])
    classroom.dispose()
  })

  it('starts a new explicit goal without mixing the previous Track stream into Live View', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'First goal',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'append_bridge_note',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'first-track-step',
      conceptId: 'cj.program.main',
      markdown: 'Only the first track should show this note.',
      teacherInteractionId: 'teacher:first-track',
    })

    render(<LiveClassroomView />, { wrapper })
    expect(screen.getByText('Only the first track should show this note.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new learning goal' }))
    fireEvent.change(screen.getByLabelText('What do you want to be able to do?'), {
      target: { value: 'Second goal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start Learning Track' }))

    await waitFor(() => expect(classroom.snapshot().tracks).toHaveLength(2))
    expect(await screen.findByText('Second goal')).toBeTruthy()
    expect(screen.queryByText('Only the first track should show this note.')).toBeNull()

    fireEvent.change(screen.getByLabelText('Active Learning Track'), {
      target: { value: classroom.snapshot().tracks[0]!.id },
    })
    expect(await screen.findByText('First goal')).toBeTruthy()
    expect(screen.getByText('Only the first track should show this note.')).toBeTruthy()
    classroom.dispose()
  })

  it('organizes current Core Content and removable retained artifacts by Concept', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'step-1',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill:run-main',
      blockIds: ['block:intro'],
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'step-evidence',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(
      entry => entry.type === 'exercise_instance',
    )!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt-success',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("hello") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'hello', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'append_skip_marker',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'step-1',
      conceptId: 'cj.program.main',
      blockIds: ['block:sample'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: [classroom.snapshot().evidence.at(-1)!.id],
      },
    })
    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: activeTrackId(classroom),
      artifactId: 'artifact-1',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point',
      markdown: 'The runtime calls `main` as the program entry.',
    })

    render(<ReviewView />, { wrapper })
    expect(screen.getByText('seen')).toBeTruthy()
    expect(screen.getByText('skipped')).toBeTruthy()
    expect(await screen.findByText('entry point')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove retained item' }))
    })
    expect(await screen.findByText('Dismissed retained topics')).toBeTruthy()
    expect(screen.getByText('entry point')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow retention again' }))
    })
    await waitFor(() => expect(screen.queryByText('Dismissed retained topics')).toBeNull())
    expect(classroom.snapshot().evidence).toHaveLength(1)
    classroom.dispose()
  })

  it('labels a Read-Only Clarification and keeps it limited to review continuity', async () => {
    const readOnly = pack()
    readOnly.review = { status: 'pending' }
    const catalog = createContentPackCatalog([readOnly])
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
    })
    await classroom.open()
    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'clarification:read-only',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point analogy',
      markdown: 'Remember the entry point through this personal analogy.',
    })

    render(<ReviewView />, {
      wrapper: workspaceWrapper(classroom, catalog),
    })

    expect(await screen.findByText('Read-only · review and Chat only')).toBeTruthy()
    expect(screen.getByText(
      'Remember the entry point through this personal analogy.',
    )).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Review Check' })).toBeNull()
    await classroom.dispose()
  })

  it('never renders retained teacher text before its exposure epoch is durably committed', async () => {
    const controlled = createControlledExposureStorage()
    const catalog = createContentPackCatalog([pack()])
    let sequence = 0
    const classroom = createAIClassroom({
      catalog,
      storage: controlled.storage,
      now: () => 1_000 + sequence,
      createId: () => `generated-${++sequence}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: activeTrackId(classroom),
      artifactId: 'artifact:secret',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'SECRET THEME BEFORE COMMIT',
      markdown: 'SECRET MARKDOWN BEFORE COMMIT',
    })

    render(<ReviewView />, { wrapper: workspaceWrapper(classroom, catalog) })
    await controlled.started

    expect(screen.getByRole('status').textContent).toContain('Preparing retained teacher content')
    expect(screen.queryByText('SECRET THEME BEFORE COMMIT')).toBeNull()
    expect(screen.queryByText('SECRET MARKDOWN BEFORE COMMIT')).toBeNull()
    expect(classroom.snapshot().teacherExposureEpoch).toBeNull()

    controlled.release()
    expect(await screen.findByText('SECRET THEME BEFORE COMMIT')).toBeTruthy()
    expect(screen.getByText('SECRET MARKDOWN BEFORE COMMIT')).toBeTruthy()
    expect(classroom.snapshot().teacherExposureEpoch).not.toBeNull()
    classroom.dispose()
  })

  it('keeps retained teacher text hidden when exposure persistence fails', async () => {
    const controlled = createControlledExposureStorage()
    const catalog = createContentPackCatalog([pack()])
    let sequence = 0
    const classroom = createAIClassroom({
      catalog,
      storage: controlled.storage,
      now: () => 1_000 + sequence,
      createId: () => `generated-${++sequence}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: activeTrackId(classroom),
      artifactId: 'artifact:must-stay-hidden',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'NEVER RENDER THIS THEME',
      markdown: 'NEVER RENDER THIS MARKDOWN',
    })

    render(<ReviewView />, { wrapper: workspaceWrapper(classroom, catalog) })
    await controlled.started
    controlled.reject(new Error('simulated durable-storage failure'))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Retained teacher content could not be revealed safely.',
    )
    expect(screen.queryByText('NEVER RENDER THIS THEME')).toBeNull()
    expect(screen.queryByText('NEVER RENDER THIS MARKDOWN')).toBeNull()
    expect(classroom.snapshot().teacherExposureEpoch).toBeNull()
    classroom.dispose()
  })

  it('gates a background remediation that becomes ready while Review View stays open', async () => {
    const controlled = createControlledExposureStorage()
    const catalog = createContentPackCatalog([pack()])
    let sequence = 0
    const classroom = createAIClassroom({
      catalog,
      storage: controlled.storage,
      now: () => 1_000 + sequence,
      createId: () => `generated-${++sequence}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-background',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const instance = classroom.snapshot().stream.find(
      entry => entry.type === 'exercise_instance',
    )
    if (!instance)
      throw new Error('expected an Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:background',
      exerciseInstanceId: instance.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("wrong") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'wrong', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    render(<ReviewView />, { wrapper: workspaceWrapper(classroom, catalog) })
    expect(screen.getByText('Preparing failure diagnosis…')).toBeTruthy()

    await act(async () => {
      await classroom.execute({
        type: 'retain_remediation',
        artifactId: 'ignored-for-automatic-shell',
        failedAttemptId: 'attempt:background',
        misconceptionTheme: 'BACKGROUND SECRET THEME',
        markdown: 'BACKGROUND SECRET MARKDOWN',
      })
    })
    await controlled.started

    expect(screen.getByRole('status').textContent).toContain('Preparing retained teacher content')
    expect(screen.queryByText('BACKGROUND SECRET THEME')).toBeNull()
    expect(screen.queryByText('BACKGROUND SECRET MARKDOWN')).toBeNull()

    controlled.release()
    expect(await screen.findByText('BACKGROUND SECRET THEME')).toBeTruthy()
    expect(screen.getByText('BACKGROUND SECRET MARKDOWN')).toBeTruthy()
    classroom.dispose()
  })

  it('creates and displays a Review Check without leaving Review View', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    useWorkspaceStore.getState().openReviewConcept('cj.program.main')

    render(<ReviewView />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Create Review Check' }))

    expect(await screen.findByText('Print hello')).toBeTruthy()
    expect(screen.getAllByText(/Review Check/)).toHaveLength(2)
    expect(useWorkspaceStore.getState().view).toBe('review')
    expect(classroom.snapshot().stream).toMatchObject([{
      type: 'exercise_instance',
      purpose: 'review',
      conceptId: 'cj.program.main',
    }])
    classroom.dispose()
  })

  it('creates a Review Check from the displayed current Content Version, not the Track pin', async () => {
    const original = pack()
    const storage = createMemoryClassroomStorage()
    const originalCatalog = createContentPackCatalog([original])
    let originalSequence = 0
    const originalClassroom = createAIClassroom({
      catalog: originalCatalog,
      storage,
      now: () => 1_000,
      createId: () => `original-${++originalSequence}`,
    })
    await originalClassroom.open()
    await originalClassroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Keep exact review provenance',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = originalClassroom.snapshot().activeTrackId
    if (!learningTrackId)
      throw new Error('expected an active Learning Track')
    await originalClassroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'historical-content',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill:run-main',
      blockIds: ['block:intro'],
    })
    originalClassroom.dispose()

    const current = structuredClone(original)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.blocks = current.blocks.map((block, index) =>
      index === 0 && block.type === 'prose'
        ? { ...block, markdown: 'The current explanation starts at `main`.' }
        : block)
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      task: {
        ...template.task,
        prompt: 'Print hello from the displayed current version',
      },
    }))
    const catalog = createContentPackCatalog(
      [original, current],
      { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
    )
    let sequence = 0
    const classroom = createAIClassroom({
      catalog,
      storage,
      now: () => 2_000,
      createId: () => `current-${++sequence}`,
    })
    await classroom.open()
    const wrapper = workspaceWrapper(classroom, catalog)

    render(<ReviewView />, { wrapper })

    expect(screen.getByText((_, element) =>
      element?.tagName === 'P'
      && element.textContent === 'The current explanation starts at main.',
    )).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Content Version'), {
      target: { value: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    })
    expect(useWorkspaceStore.getState().reviewContentVersion).toBe('cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(await screen.findByText((_, element) =>
      element?.tagName === 'P'
      && element.textContent === 'A program starts at main.',
    )).toBeTruthy()
    expect(screen.getByText('seen')).toBeTruthy()
    expect(screen.getByText(
      /Showing historical Content Version cv:sha256:a{64}/i,
    )).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Content Version'), {
      target: { value: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
    })
    expect(useWorkspaceStore.getState().reviewContentVersion).toBe('cv:sha256:3333333333333333333333333333333333333333333333333333333333333333')
    expect(await screen.findByText((_, element) =>
      element?.tagName === 'P'
      && element.textContent === 'The current explanation starts at main.',
    )).toBeTruthy()
    expect(screen.getByText(
      /new Review Check will use displayed Content Version cv:sha256:3{64}/i,
    )).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create Review Check' }))

    expect(await screen.findByText('Print hello from the displayed current version')).toBeTruthy()
    const review = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.purpose === 'review')
    expect(review).toMatchObject({
      learningTrackId,
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      templateVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    })
    expect(screen.getByText('Content vcv:3333333333…3333333333'))
      .toBeTruthy()
    classroom.dispose()
  })

  it('does not create a Review Check from a displayed read-only Content Version', async () => {
    const original = pack()
    const storage = createMemoryClassroomStorage()
    const originalCatalog = createContentPackCatalog([original])
    const originalClassroom = createAIClassroom({
      catalog: originalCatalog,
      storage,
      now: () => 1_000,
      createId: () => 'track-original',
    })
    await originalClassroom.open()
    await originalClassroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Keep the read-only boundary',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    originalClassroom.dispose()

    const readOnly = structuredClone(original)
    readOnly.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    readOnly.review = { status: 'pending' }
    const catalog = createContentPackCatalog(
      [original, readOnly],
      { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
    )
    const classroom = createAIClassroom({ catalog, storage })
    await classroom.open()

    render(<ReviewView />, {
      wrapper: workspaceWrapper(classroom, catalog),
    })

    expect(screen.queryByRole('button', { name: 'Create Review Check' })).toBeNull()
    expect(screen.getByText(
      /displayed Content Version cv:sha256:3{64} is read-only/i,
    )).toBeTruthy()
    classroom.dispose()
  })

  it('creates two distinct Review Checks when the learner clicks twice at the same clock time', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    useWorkspaceStore.getState().openReviewConcept('cj.program.main')

    render(<ReviewView />, { wrapper })
    const createButton = screen.getByRole('button', { name: 'Create Review Check' })
    fireEvent.click(createButton)
    await waitFor(() => {
      expect(classroom.snapshot().stream.filter(
        entry => entry.type === 'exercise_instance',
      )).toHaveLength(1)
    })
    fireEvent.click(createButton)

    await waitFor(() => {
      const checks = classroom.snapshot().stream.filter(
        entry => entry.type === 'exercise_instance',
      )
      expect(checks).toHaveLength(2)
      expect(new Set(checks.map(check => check.tutoringStepId)).size).toBe(2)
    })
    classroom.dispose()
  })

  it('shows secure identity generation failures instead of silently reusing a Review Check', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockImplementation(() => {
        throw new Error('secure entropy unavailable')
      })

    try {
      render(<ReviewView />, { wrapper })
      fireEvent.click(screen.getByRole('button', { name: 'Create Review Check' }))
      expect((await screen.findByRole('alert')).textContent).toContain('secure entropy unavailable')
      expect(classroom.snapshot().stream).toEqual([])
    }
    finally {
      randomUUID.mockRestore()
      classroom.dispose()
    }
  })

  it('does not offer a new Review Check for a Concept outside the active Learning Track', async () => {
    const { classroom, wrapper } = await setup([pack(), dependentPack()])
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main only',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    useWorkspaceStore.getState().openReviewConcept('cj.io.println')

    render(<ReviewView />, { wrapper })

    expect(screen.queryByRole('button', { name: 'Create Review Check' })).toBeNull()
    expect(screen.getByText(/outside the active Learning Track/i)).toBeTruthy()
    classroom.dispose()
  })

  it('does not offer a new Review Check before the selected Track Concept is enterable', async () => {
    const { classroom, wrapper } = await setup([pack(), dependentPack()])
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn output',
      conceptIds: ['cj.program.main', 'cj.io.println'],
      explicitLearnerGoal: true,
    })
    useWorkspaceStore.getState().openReviewConcept('cj.io.println')

    render(<ReviewView />, { wrapper })

    expect(screen.queryByRole('button', { name: 'Create Review Check' })).toBeNull()
    expect(screen.getByText(/not yet the frontier, encountered, or an adjustment target/i)).toBeTruthy()
    classroom.dispose()
  })

  it('keeps earlier-track Review Checks visible while stating that new checks belong to the active Track', async () => {
    const other = dependentPack()
    other.concept.prerequisites = []
    const { classroom, wrapper } = await setup([pack(), other])
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'First track',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_review_check',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'historical-review',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:review',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Second track',
      conceptIds: ['cj.io.println'],
      explicitLearnerGoal: true,
    })
    useWorkspaceStore.getState().openReviewConcept('cj.program.main')

    render(<ReviewView />, { wrapper })

    expect(screen.getByText('Print hello')).toBeTruthy()
    expect(screen.getByText(/earlier Learning Track.*new check.*active Learning Track/i)).toBeTruthy()
    const provenance = screen.getByTitle(/Learning Track .*: First track/)
    expect(provenance.textContent).toContain('Track: First track')
    expect(screen.getByText('Content vcv:aaaaaaaaaa…aaaaaaaaaa'))
      .toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Review Check' })).toBeNull()
    classroom.dispose()
  })

  it('shows an honest retained shell immediately after a failed Attempt', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-failure',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance')
    if (!exercise)
      throw new Error('expected an Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:failed',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("wrong") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'wrong', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    render(<ReviewView />, { wrapper })
    expect(screen.getByText('Preparing failure diagnosis…')).toBeTruthy()
    expect(screen.getByText(/failed attempt is already retained/i)).toBeTruthy()
    const originalRemediation = classroom.snapshot().reviewArtifacts[0]!
    fireEvent.click(screen.getByRole('button', { name: 'Remove retained item' }))
    expect(await screen.findByText('Dismissed retained topics')).toBeTruthy()
    expect(screen.getByText('Failed attempt · skill:run-main')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Allow retention again' }))
    await waitFor(() =>
      expect(screen.queryByText('Dismissed retained topics')).toBeNull())
    expect(classroom.snapshot().reviewArtifacts).toMatchObject([{
      type: 'remediation',
      diagnosticStatus: 'pending',
      attemptIds: ['attempt:failed'],
    }])
    expect(classroom.snapshot().reviewArtifacts[0]?.id)
      .not
      .toBe(originalRemediation.id)
    classroom.dispose()
  })

  it('stops after three diagnostic failures and retries only after an explicit learner click', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-for-diagnostic-retry',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance')
    if (!exercise)
      throw new Error('expected an Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:diagnostic-failed',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("wrong") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'wrong', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    for (const diagnosticAttempt of [1, 2, 3]) {
      await classroom.execute({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: 'attempt:diagnostic-failed',
        diagnosticAttempt,
        failure: 'generation_failed',
      })
    }

    render(<ReviewView />, { wrapper })

    expect(screen.getByText(/automated diagnosis stopped after 3 failed attempts/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry diagnostic' }))
    await waitFor(() => {
      expect(classroom.snapshot().reviewArtifacts[0]).toMatchObject({
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
      })
    })
    expect(screen.getByText(/diagnostic is still pending/i)).toBeTruthy()
    classroom.dispose()
  })

  it('warns about duplicate provider cost before explicitly recovering an old claim', async () => {
    const { catalog, classroom } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-for-abandoned-claim',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance')
    if (!exercise)
      throw new Error('expected an Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:abandoned-claim',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("wrong") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'wrong', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const artifact = classroom.snapshot().reviewArtifacts[0]
    if (artifact?.type !== 'remediation')
      throw new Error('expected a pending Remediation')
    await classroom.execute({
      type: 'claim_remediation_diagnostic',
      job: {
        artifactId: artifact.id,
        failedAttemptId: 'attempt:abandoned-claim',
        diagnosticAttempt: 1,
      },
      ownerNonce: 'owner:disappeared-tab',
      observedAt: 2_000,
    })
    const wrapper = workspaceWrapper(classroom, catalog, () => 100_000)

    render(<ReviewView />, { wrapper })

    fireEvent.click(screen.getByRole('button', {
      name: 'Review manual recovery',
    }))
    expect(screen.getByRole('alert').textContent).toMatch(
      /previous provider call may still be running.*duplicate charges/i,
    )
    expect(classroom.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticClaim: {
        ownerNonce: 'owner:disappeared-tab',
      },
    })

    fireEvent.click(screen.getByRole('button', {
      name: 'Accept risk and recover',
    }))
    await waitFor(() => {
      expect(classroom.snapshot().reviewArtifacts[0]).toMatchObject({
        diagnosticStatus: 'pending',
        diagnosticClaim: null,
      })
    })
    classroom.dispose()
  })

  it('persists revealed hint assistance across an exercise remount', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-1',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: { difficultyTarget: 'easy' },
    })

    const first = render(<LiveClassroomView />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }))
    expect(await screen.findByText('Call println from main.')).toBeTruthy()
    first.unmount()

    render(<LiveClassroomView />, { wrapper })
    expect(screen.getByText('Call println from main.')).toBeTruthy()
    expect(classroom.snapshot().assistanceEvents).toMatchObject([{
      type: 'hint',
      hintIndex: 0,
    }])
    classroom.dispose()
  })

  it('labels a successful retry as Practice Evidence instead of Independent Evidence', async () => {
    const { classroom, wrapper } = await setup()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Learn main',
      conceptIds: ['cj.program.main'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: activeTrackId(classroom),
      tutoringStepId: 'practice-retry',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance')
    if (!exercise)
      throw new Error('expected an Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:first-failure',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("wrong") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'wrong', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:retry-success',
      exerciseInstanceId: exercise.id,
      submission: {
        type: 'code_output',
        code: 'main() { println("hello") }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: 'hello', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(classroom.snapshot().evidence.map(item => item.type)).toEqual([
      'independent',
      'practice',
    ])
    render(<LiveClassroomView />, { wrapper })
    expect(screen.getByText('Practice Evidence')).toBeTruthy()
    expect(screen.queryByText('Independent Evidence')).toBeNull()
    classroom.dispose()
  })
})
