import type {
  Agent,
  ChatTransport,
  InferAgentUIMessage,
  ToolSet,
  UIMessageChunk,
} from 'ai'
import { DirectChatTransport } from 'ai'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'

const MAX_BUFFERED_TEACHER_TEXT_CHARS = 200_000
const MAX_TEACHER_RAW_CHUNKS = 4_096
const MAX_RETAINED_METADATA_CHARS = 512
const PROVIDER_CANCEL_GRACE_MS = 1_000
const TEACHER_TURN_DEADLINE_MS = 120_000
export interface TeacherOutputBoundary {
  commit: (turnSignal: AbortSignal) => Promise<void>
}

interface TeacherTurnOwnership {
  readonly wait: <T>(
    operation: PromiseLike<T>,
    signal: AbortSignal,
  ) => Promise<T>
  readonly observe: (operation: PromiseLike<unknown>) => Promise<void>
  readonly finish: () => void
}

function createTeacherTurnOwnership(
  release: () => void,
): TeacherTurnOwnership {
  let pendingOperations = 0
  let finished = false
  let released = false
  const releaseIfSettled = () => {
    if (!finished || pendingOperations !== 0 || released)
      return
    released = true
    release()
  }
  const track = <T>(operation: PromiseLike<T>): Promise<T> => {
    pendingOperations += 1
    const tracked = Promise.resolve(operation)
    tracked.then(
      () => {
        pendingOperations -= 1
        releaseIfSettled()
      },
      () => {
        pendingOperations -= 1
        releaseIfSettled()
      },
    )
    return tracked
  }

  return {
    wait: <T>(operation: PromiseLike<T>, signal: AbortSignal) =>
      awaitWithSignal(track(operation), signal),
    observe: operation => track(operation).then(
      () => undefined,
      () => undefined,
    ),
    finish() {
      finished = true
      releaseIfSettled()
    },
  }
}

function mergeSignal(
  upstream: AbortSignal | undefined,
  scope: AbortSignal,
  local: AbortSignal,
  deadline: AbortSignal,
): AbortSignal {
  // Always derive a fresh per-turn identity, even when the caller supplied no
  // signal. Tool budgets and read capabilities must never be reopened under a
  // signal object retained by a previous turn.
  return AbortSignal.any(
    upstream
      ? [upstream, scope, local, deadline]
      : [scope, local, deadline],
  )
}

async function cancelProviderReader(
  reader: ReadableStreamDefaultReader<UIMessageChunk>,
  reason: unknown,
  ownership: TeacherTurnOwnership,
): Promise<void> {
  let cancellation: Promise<void>
  try {
    cancellation = ownership.observe(reader.cancel(reason))
  }
  catch {
    return
  }
  // The UI may finish its cancellation handshake after a short grace period,
  // but ownership is retained until the provider's raw cancellation promise
  // settles. A provider that ignores cancellation therefore consumes one
  // finite turn slot instead of allowing an unbounded chain of zombie turns.
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, PROVIDER_CANCEL_GRACE_MS)
    cancellation.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      () => {
        clearTimeout(timer)
        resolve()
      },
    )
  })
}

function boundedMetadata<T extends string>(value: T): T
function boundedMetadata<T extends string>(value: T | undefined): T | undefined
function boundedMetadata<T extends string>(value: T | undefined): T | undefined {
  if (
    value !== undefined
    && (typeof value !== 'string' || value.length > MAX_RETAINED_METADATA_CHARS)
  ) {
    throw new RangeError(
      'Teacher response exceeded the retained metadata limit',
    )
  }
  return value
}

/**
 * Strip provider reasoning, tool payloads, retrieved documents, files, and
 * metadata before they enter assistant-ui state. Keeping this boundary in the
 * transport also protects copy/export features and future renderers.
 */
function sanitizeChunk(chunk: UIMessageChunk): UIMessageChunk | null {
  switch (chunk.type) {
    case 'text-start':
      return { type: chunk.type, id: boundedMetadata(chunk.id) }
    case 'text-delta':
      return {
        type: chunk.type,
        id: boundedMetadata(chunk.id),
        delta: chunk.delta,
      }
    case 'text-end':
      return { type: chunk.type, id: boundedMetadata(chunk.id) }
    case 'start':
      return {
        type: chunk.type,
        messageId: boundedMetadata(chunk.messageId),
      }
    case 'finish':
      return {
        type: chunk.type,
        finishReason: boundedMetadata(chunk.finishReason),
      }
    case 'start-step':
    case 'finish-step':
      return { type: chunk.type }
    case 'abort':
      return { type: chunk.type }
    case 'error':
      return { type: chunk.type, errorText: 'Teacher response failed.' }
    case 'reasoning-start':
    case 'reasoning-delta':
    case 'reasoning-end':
    case 'tool-input-start':
    case 'tool-input-delta':
    case 'tool-input-available':
    case 'tool-input-error':
    case 'tool-approval-request':
    case 'tool-output-available':
    case 'tool-output-error':
    case 'tool-output-denied':
    case 'source-url':
    case 'source-document':
    case 'file':
    case 'message-metadata':
      return null
    default:
      // Custom data chunks are not part of the teacher contract. Fail closed
      // rather than retaining a future provider payload by accident.
      return null
  }
}

/**
 * A teacher turn is exposed transactionally: consume and sanitize the complete
 * turn, persist the workspace exposure epoch, then release the buffered UI
 * chunks synchronously. This prevents any teacher text from racing the durable
 * aided-evidence boundary.
 */
function guardTeacherTurn(
  stream: ReadableStream<UIMessageChunk>,
  boundary: TeacherOutputBoundary,
  turnSignal: AbortSignal,
  ownership: TeacherTurnOwnership,
  abortTurn?: (reason: unknown) => void,
): ReadableStream<UIMessageChunk> {
  const reader = stream.getReader()
  let settled = false
  let consumerCancellationPending = false
  const settle = () => {
    if (settled)
      return
    settled = true
    ownership.finish()
  }

  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      const buffered: UIMessageChunk[] = []
      let textCharacters = 0
      let rawChunkCount = 0
      let hasVisibleTeacherText = false
      let pendingTextId: string | null = null
      let pendingTextDeltas: string[] = []

      const flushTextDeltas = () => {
        if (pendingTextId === null || pendingTextDeltas.length === 0)
          return
        buffered.push({
          type: 'text-delta',
          id: pendingTextId,
          delta: pendingTextDeltas.join(''),
        })
        pendingTextId = null
        pendingTextDeltas = []
      }

      try {
        while (true) {
          const next = await ownership.wait(reader.read(), turnSignal)
          if (next.done)
            break
          rawChunkCount += 1
          if (rawChunkCount > MAX_TEACHER_RAW_CHUNKS) {
            throw new RangeError(
              'Teacher response exceeded the raw chunk limit',
            )
          }
          const chunk = sanitizeChunk(next.value)
          if (!chunk)
            continue
          if (chunk.type === 'text-delta') {
            if (chunk.delta.length === 0)
              continue
            textCharacters += chunk.delta.length
            hasVisibleTeacherText ||= /\S/u.test(chunk.delta)
            if (textCharacters > MAX_BUFFERED_TEACHER_TEXT_CHARS) {
              throw new RangeError(
                'Teacher response exceeded the learner-facing text limit',
              )
            }
            if (pendingTextId !== null && pendingTextId !== chunk.id)
              flushTextDeltas()
            pendingTextId = chunk.id
            pendingTextDeltas.push(chunk.delta)
            continue
          }
          flushTextDeltas()
          buffered.push(chunk)
        }
        flushTextDeltas()

        if (hasVisibleTeacherText) {
          await ownership.wait(
            boundary.commit(turnSignal),
            turnSignal,
          )
        }

        // No await is permitted between the committed assistance marker and
        // releasing text, so browser events cannot insert an unmarked Attempt.
        for (const chunk of buffered)
          controller.enqueue(chunk)
        controller.close()
      }
      catch (error) {
        if (!consumerCancellationPending)
          await cancelProviderReader(reader, error, ownership)
        controller.error(error)
      }
      finally {
        if (!consumerCancellationPending)
          settle()
      }
    },
    async cancel(reason) {
      consumerCancellationPending = true
      abortTurn?.(reason)
      try {
        await cancelProviderReader(reader, reason, ownership)
      }
      finally {
        settle()
      }
    },
  })
}

/**
 * Wrap a browser-side Agent in a workspace-scoped, learner-safe transport.
 * Caller cancellation and workspace teardown both abort the provider stream.
 */
export function createScopedChatTransport<
  CALL_OPTIONS,
  TOOLS extends ToolSet,
>(
  agent: Agent<CALL_OPTIONS, TOOLS, never>,
  scopeSignal: AbortSignal,
  boundary?: TeacherOutputBoundary,
  prepareTurn?: (turnSignal: AbortSignal) => void | (() => void),
): ChatTransport<InferAgentUIMessage<Agent<CALL_OPTIONS, TOOLS, never>>> {
  const inner = new DirectChatTransport({ agent })
  let preparedTurnActive = false

  return {
    async sendMessages(opts) {
      if (prepareTurn && !boundary) {
        throw new Error(
          'A prepared teacher turn requires an output boundary to release its lease',
        )
      }
      if (prepareTurn && preparedTurnActive)
        throw new Error('A teacher turn is already running')
      const turnController = new AbortController()
      const turnSignal = mergeSignal(
        opts.abortSignal,
        scopeSignal,
        turnController.signal,
        AbortSignal.timeout(TEACHER_TURN_DEADLINE_MS),
      )
      let cleanupPreparedTurn: (() => void) | undefined
      let released = false
      const releaseTurn = () => {
        if (released)
          return
        released = true
        turnController.abort('Teacher turn settled')
        cleanupPreparedTurn?.()
        preparedTurnActive = false
      }
      const ownership = createTeacherTurnOwnership(releaseTurn)
      try {
        if (prepareTurn) {
          preparedTurnActive = true
          cleanupPreparedTurn = prepareTurn(turnSignal) || undefined
        }
        const stream = await ownership.wait(
          inner.sendMessages({
            ...opts,
            abortSignal: turnSignal,
          }),
          turnSignal,
        )
        return boundary
          ? guardTeacherTurn(
              stream,
              boundary,
              turnSignal,
              ownership,
              reason => turnController.abort(reason),
            )
          : stream
      }
      catch (error) {
        ownership.finish()
        throw error
      }
    },
    async reconnectToStream() {
      // A reconnected stream has no turn-local AbortSignal or prepared lease,
      // so it cannot satisfy the teacher output/evidence boundary. Direct
      // browser Teacher Chat deliberately has no resumable server stream.
      return null
    },
  }
}
