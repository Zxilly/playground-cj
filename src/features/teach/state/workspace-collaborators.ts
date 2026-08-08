import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import type { SettleAwareOperationOwnership } from '@/lib/ai/settle-aware-operation-ownership'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import { createSettleAwareOperationOwnership } from '@/lib/ai/settle-aware-operation-ownership'
import { createAIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createBuiltInCourseContentPackCatalog } from '@/lib/teach/classroom/built-in-course'
import { createIndexedDBClassroomStorage } from '@/lib/teach/classroom/storage'
import { createCangjieMcpKnowledgeSource } from '@/lib/teach/knowledge/cangjie-mcp-source'
import { defaultRunner } from '@/lib/teach/feedback/run-cangjie'
import { createActiveEditorRegistry } from './active-editor-store'

export interface WorkspaceCollaborators
  extends Omit<WorkspaceContextValue, 'lang'> {
  dispose: () => Promise<void>
}

export interface CreateWorkspaceCollaboratorsOptions {
  signal?: AbortSignal
  /** One deadline for lease waiting and persisted classroom state open. */
  timeoutMs?: number
  onStorageError?: (error: unknown) => void
}

type ContentLocale = 'en' | 'zh'

const CLASSROOM_STORAGE_SCOPE = 'classroom'
export const DEFAULT_WORKSPACE_INITIALIZATION_TIMEOUT_MS = 20_000

export class WorkspaceInitializationTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`AI Classroom loading exceeded the ${timeoutMs}ms initialization deadline`)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

interface WorkspaceResources {
  storage?: ReturnType<typeof createIndexedDBClassroomStorage>
  classroom?: ReturnType<typeof createAIClassroom>
}

let workspaceLeaseTail: Promise<void> = Promise.resolve()

function abortError(): DOMException {
  return new DOMException('AI Classroom loading was aborted', 'AbortError')
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : abortError()
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted)
    throw abortReason(signal)
}

type InitializationOperationOwnership = Pick<
  SettleAwareOperationOwnership,
  'wait' | 'finish'
>

interface InitializationBoundary {
  signal: AbortSignal
  close: () => void
}

function createInitializationBoundary(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): InitializationBoundary {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(
      'AI Classroom initialization timeout must be a positive safe integer',
    )
  }

  const controller = new AbortController()
  const abortFromCaller = () => {
    if (!controller.signal.aborted)
      controller.abort(abortError())
  }
  if (callerSignal?.aborted)
    abortFromCaller()
  else
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new WorkspaceInitializationTimeoutError(timeoutMs))
    }
  }, timeoutMs)

  let closed = false
  return {
    signal: controller.signal,
    close: () => {
      if (closed)
        return
      closed = true
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    },
  }
}

/**
 * One runtime owns the shared classroom scope until all of its resources have
 * closed. Waiting reservations remain FIFO, while an aborted reservation
 * removes itself without releasing the current owner.
 */
async function acquireWorkspaceLease(
  signal: AbortSignal,
): Promise<() => void> {
  const predecessor = workspaceLeaseTail
  let releaseReservation!: () => void
  const reservation = new Promise<void>((resolve) => {
    releaseReservation = resolve
  })
  workspaceLeaseTail = predecessor.then(() => reservation)

  try {
    await awaitWithSignal(predecessor, signal)
    throwIfAborted(signal)
  }
  catch (error) {
    releaseReservation()
    throw error
  }

  let released = false
  return () => {
    if (released)
      return
    released = true
    releaseReservation()
  }
}

/**
 * Attempt every release even if an earlier disposer fails. A single failure is
 * preserved verbatim; multiple failures are reported together.
 */
async function disposeWorkspaceResources(
  resources: WorkspaceResources,
  options: { closeStorageImmediately?: boolean } = {},
): Promise<void> {
  const attemptRelease = (release: () => void | Promise<void>): Promise<void> => {
    try {
      return Promise.resolve(release())
    }
    catch (error) {
      return Promise.reject(error)
    }
  }
  const orderedResults: Array<PromiseSettledResult<void>> = []
  const classroom = resources.classroom
  const classroomRelease = classroom
    ? attemptRelease(() => classroom.dispose())
    : undefined
  const storage = resources.storage
  const startStorageRelease = () => storage?.close
    ? attemptRelease(() => storage.close!())
    : undefined

  if (options.closeStorageImmediately) {
    const storageRelease = startStorageRelease()
    const dependentResults = await Promise.allSettled([
      ...(classroomRelease ? [classroomRelease] : []),
      ...(storageRelease ? [storageRelease] : []),
    ])
    orderedResults.push(...dependentResults)
  }
  else {
    if (classroomRelease) {
      const [classroomResult] = await Promise.allSettled([classroomRelease])
      orderedResults.push(classroomResult)
    }
    const storageRelease = startStorageRelease()
    if (storageRelease) {
      const [storageResult] = await Promise.allSettled([storageRelease])
      orderedResults.push(storageResult)
    }
  }

  const failures = orderedResults
    .filter((result): result is PromiseRejectedResult =>
      result.status === 'rejected')
    .map(result => result.reason)
  if (failures.length === 1)
    throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, 'Failed to dispose AI Classroom resources')
}

/**
 * Build and open the only production AI Classroom aggregate. The v8 IndexedDB
 * scope is shared across UI locales. The bilingual catalog is compiled into
 * the application so one Classroom Stream can reopen every exact Content
 * Version after the learner switches languages.
 */
export async function createWorkspaceCollaborators(
  lang: string,
  options: CreateWorkspaceCollaboratorsOptions = {},
): Promise<WorkspaceCollaborators> {
  const selectedLocale: ContentLocale = lang === 'en' ? 'en' : 'zh'
  const resources: WorkspaceResources = {}
  const boundary = createInitializationBoundary(
    options.signal,
    options.timeoutMs ?? DEFAULT_WORKSPACE_INITIALIZATION_TIMEOUT_MS,
  )
  let releaseLease: (() => void) | undefined
  let initializationOwnership: InitializationOperationOwnership | undefined
  try {
    releaseLease = await acquireWorkspaceLease(boundary.signal)
    initializationOwnership = createSettleAwareOperationOwnership()
    throwIfAborted(boundary.signal)

    const catalog = createBuiltInCourseContentPackCatalog(selectedLocale)
    resources.storage = createIndexedDBClassroomStorage({
      scope: CLASSROOM_STORAGE_SCOPE,
    })

    resources.classroom = createAIClassroom({
      catalog,
      storage: resources.storage,
      onStorageError: options.onStorageError,
    })
    await initializationOwnership.wait(
      resources.classroom.open(),
      boundary.signal,
    )
    throwIfAborted(boundary.signal)
    await initializationOwnership.finish()
    const openedClassroom = resources.classroom
    let disposal: Promise<void> | undefined
    boundary.close()

    return {
      classroom: openedClassroom,
      catalog,
      knowledge: createCangjieMcpKnowledgeSource(),
      runner: defaultRunner,
      activeEditor: createActiveEditorRegistry(),
      now: Date.now,
      dispose: () => {
        disposal ??= disposeWorkspaceResources(resources).finally(releaseLease)
        return disposal
      },
    }
  }
  catch (error) {
    const cleanup = disposeWorkspaceResources(resources, {
      // Initialization never became usable. Start every available release now;
      // a stuck aggregate open must not prevent storage close from being asked.
      closeStorageImmediately: true,
    })
    const ownedLeaseRelease = releaseLease
    releaseLease = undefined
    const fullySettled = Promise.allSettled([
      cleanup,
      initializationOwnership?.finish() ?? Promise.resolve(),
    ]).then(([cleanupResult]) => {
      ownedLeaseRelease?.()
      return cleanupResult
    })

    let cleanupError: unknown
    if (boundary.signal.aborted) {
      // The UI receives its deadline/abort promptly. The observed settlement
      // continues in the background and is the only path that releases the
      // shared-scope lease.
      void fullySettled
    }
    else {
      try {
        const cleanupResult = await awaitWithSignal(
          fullySettled,
          boundary.signal,
        )
        if (cleanupResult.status === 'rejected')
          cleanupError = cleanupResult.reason
      }
      catch {
        // A deadline that fires during cleanup still leaves fullySettled
        // observing ownership and releasing the lease only after convergence.
        void fullySettled
      }
    }
    boundary.close()
    if (cleanupError && !boundary.signal.aborted) {
      throw new AggregateError(
        [error, cleanupError],
        'AI Classroom initialization and cleanup both failed',
      )
    }
    throw error
  }
}
