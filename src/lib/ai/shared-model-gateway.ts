import { z } from 'zod'
import { awaitWithSignal } from './abortable-operation'

const MAX_REQUEST_BYTES = 256 * 1024
const MAX_OUTPUT_TOKENS = 4096
// Streaming providers may add a JSON/SSE envelope for every output token. 512
// bytes per token leaves ample room for UTF-8 text and per-chunk metadata, while
// 128 KiB covers fixed completion/tool/usage fields without making the gateway
// an unbounded response relay.
const MAX_UPSTREAM_RESPONSE_BYTES = MAX_OUTPUT_TOKENS * 512 + 128 * 1024
const MAX_SSE_EVENTS = MAX_OUTPUT_TOKENS * 2 + 128
const MAX_SSE_LINES = MAX_SSE_EVENTS * 8
const MAX_SSE_EVENT_BYTES = 256 * 1024
const SSE_PARSE_YIELD_BYTES = 64 * 1024
const SSE_PARSE_YIELD_EVENTS = 256

const textContentPartSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().max(100_000),
})

const toolCallSchema = z.strictObject({
  id: z.string().min(1).max(256),
  type: z.literal('function'),
  function: z.strictObject({
    name: z.string().min(1).max(128),
    arguments: z.string().max(100_000),
  }),
})

const messageSchema = z.discriminatedUnion('role', [
  z.strictObject({
    role: z.enum(['system', 'developer']),
    content: z.string().max(100_000),
  }),
  z.strictObject({
    role: z.literal('user'),
    content: z.union([
      z.string().max(100_000),
      z.array(textContentPartSchema).min(1).max(100),
    ]),
  }),
  z.strictObject({
    role: z.literal('assistant'),
    content: z.string().max(100_000).nullable(),
    reasoning_content: z.string().max(100_000).optional(),
    tool_calls: z.array(toolCallSchema).max(64).optional(),
  }),
  z.strictObject({
    role: z.literal('tool'),
    tool_call_id: z.string().min(1).max(256),
    content: z.string().max(100_000),
  }),
])

const jsonSchemaSchema = z.record(z.string(), z.unknown())

const toolSchema = z.strictObject({
  type: z.literal('function'),
  function: z.strictObject({
    name: z.string().min(1).max(128),
    description: z.string().max(4_000).optional(),
    parameters: jsonSchemaSchema.optional(),
    strict: z.boolean().optional(),
  }),
})

const toolChoiceSchema = z.union([
  z.enum(['none', 'auto', 'required']),
  z.strictObject({
    type: z.literal('function'),
    function: z.strictObject({
      name: z.string().min(1).max(128),
    }),
  }),
])

const responseFormatSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text') }),
  z.strictObject({ type: z.literal('json_object') }),
  z.strictObject({
    type: z.literal('json_schema'),
    json_schema: z.strictObject({
      name: z.string().min(1).max(128),
      description: z.string().max(4_000).optional(),
      strict: z.boolean().optional(),
      schema: jsonSchemaSchema,
    }),
  }),
])

const chatCompletionRequestSchema = z.strictObject({
  model: z.string().min(1).max(256),
  messages: z.array(messageSchema).min(1).max(128),
  stream: z.boolean().optional(),
  stream_options: z.strictObject({
    include_usage: z.boolean(),
  }).optional(),
  max_tokens: z.number().int().positive().max(MAX_OUTPUT_TOKENS).nullish(),
  temperature: z.number().min(0).max(2).nullish(),
  top_p: z.number().min(0).max(1).nullish(),
  frequency_penalty: z.number().min(-2).max(2).nullish(),
  presence_penalty: z.number().min(-2).max(2).nullish(),
  stop: z.union([
    z.string().max(1_000),
    z.array(z.string().max(1_000)).max(4),
  ]).nullish(),
  seed: z.number().int().nullish(),
  tools: z.array(toolSchema).max(64).optional(),
  tool_choice: toolChoiceSchema.optional(),
  parallel_tool_calls: z.boolean().optional(),
  response_format: responseFormatSchema.optional(),
  reasoning_effort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  verbosity: z.enum(['low', 'medium', 'high']).optional(),
})

const responseTextSchema = z.string().max(MAX_UPSTREAM_RESPONSE_BYTES)

const responseToolCallSchema = z.object({
  id: z.string().min(1).max(256),
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1).max(128),
    arguments: responseTextSchema,
  }).passthrough(),
}).passthrough()

const tokenUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
}).passthrough()

const chatCompletionResponseSchema = z.object({
  id: z.string().min(1).max(256),
  object: z.literal('chat.completion'),
  created: z.number().int().nonnegative(),
  model: z.string().min(1).max(256),
  choices: z.array(z.object({
    index: z.number().int().nonnegative(),
    finish_reason: z.string().max(128).nullable(),
    message: z.object({
      role: z.literal('assistant'),
      content: responseTextSchema.nullable(),
      reasoning_content: responseTextSchema.nullish(),
      refusal: responseTextSchema.nullish(),
      tool_calls: z.array(responseToolCallSchema).max(64).optional(),
    }).passthrough(),
  }).passthrough()).min(1).max(64),
  usage: tokenUsageSchema.optional(),
}).passthrough()

const streamedToolCallSchema = z.object({
  index: z.number().int().nonnegative().optional(),
  id: z.string().min(1).max(256).optional(),
  type: z.literal('function').optional(),
  function: z.object({
    name: z.string().min(1).max(128).optional(),
    arguments: responseTextSchema.optional(),
  }).passthrough().optional(),
}).passthrough()

const chatCompletionChunkSchema = z.object({
  id: z.string().min(1).max(256),
  object: z.literal('chat.completion.chunk'),
  created: z.number().int().nonnegative(),
  model: z.string().min(1).max(256),
  choices: z.array(z.object({
    index: z.number().int().nonnegative(),
    delta: z.object({
      role: z.literal('assistant').optional(),
      content: responseTextSchema.nullish(),
      reasoning_content: responseTextSchema.nullish(),
      refusal: responseTextSchema.nullish(),
      tool_calls: z.array(streamedToolCallSchema).max(64).optional(),
    }).passthrough(),
    finish_reason: z.string().max(128).nullable().optional(),
  }).passthrough()).max(64),
  usage: tokenUsageSchema.nullish(),
}).passthrough().refine(
  value => value.choices.length > 0
    || (value.usage !== null && value.usage !== undefined),
)

interface SharedCredential {
  readonly apiKey: string
}

export interface SharedModelGatewayDependencies {
  readonly resolveIdentity: (headers: Headers) => string
  readonly consumeRequestPermit: (identity: string, signal?: AbortSignal) => Promise<boolean>
  readonly acquireCredential: (identity: string, signal?: AbortSignal) => Promise<SharedCredential>
  readonly fetch: typeof globalThis.fetch
  readonly upstreamBaseURL: string
  readonly model: string
  readonly timeoutMs: number
  readonly tryAcquireRequestSlot: () => (() => void) | null
}

class GatewayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

class InvalidUpstreamResponseError extends Error {
  constructor() {
    super('The shared AI service returned an invalid upstream response.')
  }
}

interface RequestSlotOwnership {
  readonly wait: <T>(operation: PromiseLike<T>, signal: AbortSignal) => Promise<T>
  readonly observe: (operation: PromiseLike<unknown>) => Promise<void>
  readonly finish: () => void
}

// A deadline may stop the caller from waiting, but it does not prove that an
// abort-ignoring dependency stopped working. Keep the finite admission slot
// until both the logical request and every observed operation have settled.
function createRequestSlotOwnership(release: () => void): RequestSlotOwnership {
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

function responseHeaders(contentType = 'application/json; charset=utf-8'): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  })
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message, type: code } },
    { status, headers: responseHeaders() },
  )
}

interface OwnedBodyReader {
  readonly read: (
    signal: AbortSignal,
  ) => Promise<ReadableStreamReadResult<Uint8Array>>
  readonly cancel: (reason?: unknown) => Promise<void>
}

function createOwnedBodyReader(
  body: ReadableStream<Uint8Array>,
  ownership: RequestSlotOwnership,
): OwnedBodyReader {
  const reader = body.getReader()
  let cancellation: Promise<void> | null = null
  const cancel = (reason?: unknown): Promise<void> => {
    cancellation ??= ownership.observe(reader.cancel(reason))
    return cancellation
  }

  return {
    async read(signal) {
      let abortHandled = false
      const handleAbort = () => {
        if (abortHandled)
          return
        abortHandled = true
        void cancel(signal.reason)
      }
      signal.addEventListener('abort', handleAbort, { once: true })
      if (signal.aborted) {
        handleAbort()
        signal.throwIfAborted()
      }
      try {
        return await ownership.wait(reader.read(), signal)
      }
      finally {
        signal.removeEventListener('abort', handleAbort)
      }
    },
    cancel,
  }
}

async function readRequestJson(
  request: Request,
  signal: AbortSignal,
  ownership: RequestSlotOwnership,
): Promise<unknown> {
  if (!request.body)
    throw new GatewayRequestError(400, 'invalid_request', 'A JSON request body is required.')

  const reader = createOwnedBodyReader(request.body, ownership)
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null) {
    const length = Number(declaredLength)
    if (!Number.isSafeInteger(length) || length < 0) {
      void reader.cancel()
      throw new GatewayRequestError(400, 'invalid_request', 'Invalid Content-Length.')
    }
    if (length > MAX_REQUEST_BYTES) {
      void reader.cancel()
      throw new GatewayRequestError(413, 'request_too_large', 'Request body is too large.')
    }
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read(signal)
    if (done)
      break
    total += value.byteLength
    if (total > MAX_REQUEST_BYTES) {
      void reader.cancel()
      throw new GatewayRequestError(413, 'request_too_large', 'Request body is too large.')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch {
    throw new GatewayRequestError(400, 'invalid_request', 'Request body must be valid UTF-8.')
  }

  try {
    return JSON.parse(text) as unknown
  }
  catch {
    throw new GatewayRequestError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
}

function buildUpstreamURL(baseURL: string): string {
  const parsed = new URL(baseURL)
  parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/chat/completions`
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

function sanitizedUpstreamFailure(status: number): Response {
  if (status === 429) {
    return errorResponse(
      429,
      'insufficient_user_quota',
      'The shared AI quota is exhausted.',
    )
  }
  return errorResponse(502, 'upstream_unavailable', 'The shared AI service is unavailable.')
}

type UpstreamResponseKind = 'json' | 'sse'

function validateJsonCompletion(text: string): void {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  }
  catch {
    throw new InvalidUpstreamResponseError()
  }
  if (!chatCompletionResponseSchema.safeParse(value).success)
    throw new InvalidUpstreamResponseError()
}

type SseEventKind = 'chunk' | 'done' | 'empty' | 'metadata'

function validateSseEvent(rawEvent: string): SseEventKind {
  const data: string[] = []
  let hasMetadata = false
  for (const line of rawEvent.split(/\r\n|\r|\n/)) {
    if (line === '')
      continue
    if (line.startsWith(':')) {
      hasMetadata = true
      continue
    }

    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    let value = separator === -1 ? '' : line.slice(separator + 1)
    if (value.startsWith(' '))
      value = value.slice(1)

    if (field === 'data') {
      data.push(value)
      continue
    }
    if (field === 'event') {
      if (value !== '' && value !== 'message')
        throw new InvalidUpstreamResponseError()
      hasMetadata = true
      continue
    }
    if (field === 'id') {
      if (value.includes('\0'))
        throw new InvalidUpstreamResponseError()
      hasMetadata = true
      continue
    }
    if (field === 'retry') {
      if (!/^\d+$/.test(value))
        throw new InvalidUpstreamResponseError()
      hasMetadata = true
      continue
    }
    throw new InvalidUpstreamResponseError()
  }

  if (data.length === 0)
    return hasMetadata ? 'metadata' : 'empty'

  const payload = data.join('\n')
  if (payload === '[DONE]')
    return 'done'

  let value: unknown
  try {
    value = JSON.parse(payload) as unknown
  }
  catch {
    throw new InvalidUpstreamResponseError()
  }
  if (!chatCompletionChunkSchema.safeParse(value).success)
    throw new InvalidUpstreamResponseError()
  return 'chunk'
}

function concatenateBytes(
  chunks: readonly Uint8Array[],
  totalBytes: number,
): Uint8Array {
  const output = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

interface IncrementalSseValidator {
  readonly push: (bytes: Uint8Array) => Promise<Uint8Array | null>
  readonly finish: () => Promise<Uint8Array | null>
}

function createIncrementalSseValidator(signal: AbortSignal): IncrementalSseValidator {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const eventChunks: Uint8Array[] = []
  let eventBytes = 0
  let lineBytes = 0
  let eventCount = 0
  let lineCount = 0
  let bytesSinceYield = 0
  let eventsSinceYield = 0
  let pendingCarriageReturn = false
  let sawStreamChunk = false
  let sawDone = false

  const append = (bytes: Uint8Array, lineContent: boolean) => {
    if (bytes.byteLength === 0)
      return
    eventChunks.push(bytes)
    eventBytes += bytes.byteLength
    if (lineContent)
      lineBytes += bytes.byteLength
    if (eventBytes > MAX_SSE_EVENT_BYTES)
      throw new InvalidUpstreamResponseError()
  }

  const completeEvent = (
    output: Uint8Array[],
  ): number => {
    eventCount += 1
    eventsSinceYield += 1
    if (eventCount > MAX_SSE_EVENTS)
      throw new InvalidUpstreamResponseError()

    const event = concatenateBytes(eventChunks, eventBytes)
    let text: string
    try {
      text = decoder.decode(event)
    }
    catch {
      throw new InvalidUpstreamResponseError()
    }
    const eventKind = validateSseEvent(text)
    if (sawDone && eventKind !== 'empty')
      throw new InvalidUpstreamResponseError()
    if (eventKind === 'chunk')
      sawStreamChunk = true
    if (eventKind === 'done') {
      if (sawDone)
        throw new InvalidUpstreamResponseError()
      sawDone = true
    }

    output.push(event)
    eventChunks.length = 0
    const completedBytes = eventBytes
    eventBytes = 0
    return completedBytes
  }

  const completeLine = (output: Uint8Array[]): number => {
    lineCount += 1
    if (lineCount > MAX_SSE_LINES)
      throw new InvalidUpstreamResponseError()
    if (lineBytes !== 0) {
      lineBytes = 0
      return 0
    }
    return completeEvent(output)
  }

  const yieldIfNeeded = async () => {
    if (
      bytesSinceYield < SSE_PARSE_YIELD_BYTES
      && eventsSinceYield < SSE_PARSE_YIELD_EVENTS
    ) {
      return
    }
    bytesSinceYield = 0
    eventsSinceYield = 0
    signal.throwIfAborted()
    await awaitWithSignal(
      new Promise<void>(resolve => setTimeout(resolve, 0)),
      signal,
    )
  }

  const push = async (bytes: Uint8Array): Promise<Uint8Array | null> => {
    const output: Uint8Array[] = []
    let outputBytes = 0
    let index = 0

    if (pendingCarriageReturn) {
      pendingCarriageReturn = false
      if (bytes[0] === 0x0A) {
        append(Uint8Array.of(0x0D, 0x0A), false)
        outputBytes += completeLine(output)
        index = 1
        bytesSinceYield += 2
      }
      else {
        append(Uint8Array.of(0x0D), false)
        outputBytes += completeLine(output)
        bytesSinceYield += 1
      }
      await yieldIfNeeded()
    }

    let segmentStart = index
    while (index < bytes.byteLength) {
      const byte = bytes[index]!
      if (byte !== 0x0A && byte !== 0x0D) {
        index += 1
        bytesSinceYield += 1
        if (bytesSinceYield >= SSE_PARSE_YIELD_BYTES) {
          append(bytes.subarray(segmentStart, index), true)
          segmentStart = index
          await yieldIfNeeded()
        }
        continue
      }

      append(bytes.subarray(segmentStart, index), true)
      if (byte === 0x0A) {
        append(bytes.subarray(index, index + 1), false)
        index += 1
        bytesSinceYield += 1
        outputBytes += completeLine(output)
      }
      else if (index + 1 < bytes.byteLength) {
        const newlineEnd = bytes[index + 1] === 0x0A ? index + 2 : index + 1
        append(bytes.subarray(index, newlineEnd), false)
        bytesSinceYield += newlineEnd - index
        index = newlineEnd
        outputBytes += completeLine(output)
      }
      else {
        pendingCarriageReturn = true
        index += 1
      }
      segmentStart = index
      await yieldIfNeeded()
    }
    append(bytes.subarray(segmentStart), true)

    return output.length === 0
      ? null
      : concatenateBytes(output, outputBytes)
  }

  return {
    push,
    async finish() {
      const output: Uint8Array[] = []
      let outputBytes = 0
      if (pendingCarriageReturn) {
        pendingCarriageReturn = false
        append(Uint8Array.of(0x0D), false)
        outputBytes += completeLine(output)
      }
      if (eventBytes !== 0) {
        if (lineBytes !== 0) {
          lineCount += 1
          if (lineCount > MAX_SSE_LINES)
            throw new InvalidUpstreamResponseError()
          lineBytes = 0
        }
        outputBytes += completeEvent(output)
      }
      await yieldIfNeeded()
      if (!sawStreamChunk || !sawDone)
        throw new InvalidUpstreamResponseError()
      return output.length === 0
        ? null
        : concatenateBytes(output, outputBytes)
    },
  }
}

function validatedUpstreamBody(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  kind: UpstreamResponseKind,
  ownership: RequestSlotOwnership,
): ReadableStream<Uint8Array> {
  const reader = createOwnedBodyReader(body, ownership)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const encoder = new TextEncoder()
  const sseValidator = kind === 'sse'
    ? createIncrementalSseValidator(signal)
    : null
  let totalBytes = 0
  let bufferedText = ''
  let finished = false
  let handleAbort = () => {}
  const finish = () => {
    if (finished)
      return
    finished = true
    signal.removeEventListener('abort', handleAbort)
    ownership.finish()
  }
  const cancelUpstream = (reason: unknown) => reader.cancel(reason)
  handleAbort = () => {
    if (finished)
      return
    void cancelUpstream(signal.reason)
    finish()
  }
  signal.addEventListener('abort', handleAbort, { once: true })
  if (signal.aborted)
    handleAbort()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const result = await reader.read(signal)
          if (result.done) {
            if (kind === 'json') {
              try {
                bufferedText += decoder.decode()
              }
              catch {
                throw new InvalidUpstreamResponseError()
              }
              validateJsonCompletion(bufferedText)
              controller.enqueue(encoder.encode(bufferedText))
            }
            else {
              const output = await sseValidator!.finish()
              if (output)
                controller.enqueue(output)
            }
            controller.close()
            finish()
            return
          }

          totalBytes += result.value.byteLength
          if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES)
            throw new InvalidUpstreamResponseError()

          if (kind === 'json') {
            try {
              bufferedText += decoder.decode(result.value, { stream: true })
            }
            catch {
              throw new InvalidUpstreamResponseError()
            }
          }
          else {
            const output = await sseValidator!.push(result.value)
            if (output) {
              controller.enqueue(output)
              return
            }
          }
        }
      }
      catch (error) {
        void cancelUpstream(error)
        controller.error(error)
        finish()
      }
    },
    cancel(reason) {
      const cancellation = cancelUpstream(reason)
      finish()
      return cancellation
    },
  })
}

export function createSharedModelGateway(
  dependencies: SharedModelGatewayDependencies,
): (request: Request) => Promise<Response> {
  const upstreamURL = buildUpstreamURL(dependencies.upstreamBaseURL)

  return async (request: Request): Promise<Response> => {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(dependencies.timeoutMs),
    ])
    let slotOwnership: RequestSlotOwnership | null = null
    let responseOwnsSlot = false
    let requestBodyStarted = false
    try {
      if (request.method !== 'POST')
        return errorResponse(405, 'method_not_allowed', 'Only POST is supported.')

      const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (contentType !== 'application/json')
        return errorResponse(415, 'unsupported_media_type', 'Content-Type must be application/json.')

      const acquiredSlot = dependencies.tryAcquireRequestSlot()
      if (acquiredSlot === null) {
        return errorResponse(
          503,
          'server_busy',
          'The shared AI service is at its concurrency limit.',
        )
      }
      slotOwnership = createRequestSlotOwnership(acquiredSlot)

      const identity = dependencies.resolveIdentity(request.headers)
      const permitted = await slotOwnership.wait(
        dependencies.consumeRequestPermit(identity, signal),
        signal,
      )
      if (!permitted)
        return errorResponse(429, 'rate_limit_exceeded', 'Too many shared AI requests.')

      requestBodyStarted = true
      const input = chatCompletionRequestSchema.safeParse(
        await readRequestJson(request, signal, slotOwnership),
      )
      if (!input.success)
        return errorResponse(400, 'invalid_request', 'Request does not match the chat completion schema.')

      const credential = await slotOwnership.wait(
        dependencies.acquireCredential(identity, signal),
        signal,
      )
      if (!credential.apiKey)
        throw new Error('shared credential is empty')

      const body = {
        ...input.data,
        model: dependencies.model,
        max_tokens: input.data.max_tokens ?? MAX_OUTPUT_TOKENS,
      }
      const activeSlotOwnership = slotOwnership
      const upstreamOperation = Promise.resolve(
        dependencies.fetch(upstreamURL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credential.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal,
        }),
      ).then((response) => {
        // A fetch implementation may ignore abort and resolve after the
        // request already timed out. Own and await cancellation of that late
        // body before this fetch operation can settle and release its slot.
        if (!signal.aborted || !response.body)
          return response

        return activeSlotOwnership.observe(
          response.body.cancel(signal.reason),
        ).then(() => response)
      })
      const upstream = await activeSlotOwnership.wait(
        upstreamOperation,
        signal,
      )

      if (!upstream.ok) {
        if (upstream.body)
          void slotOwnership.observe(upstream.body.cancel())
        return sanitizedUpstreamFailure(upstream.status)
      }

      const upstreamContentType = upstream.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      const expectedContentType = input.data.stream ? 'text/event-stream' : 'application/json'
      if (upstreamContentType !== expectedContentType) {
        if (upstream.body)
          void slotOwnership.observe(upstream.body.cancel())
        return errorResponse(502, 'invalid_upstream_response', 'The shared AI service returned an invalid response.')
      }
      if (!upstream.body)
        return errorResponse(502, 'invalid_upstream_response', 'The shared AI service returned an invalid response.')

      const declaredResponseLength = upstream.headers.get('content-length')
      if (declaredResponseLength !== null) {
        const length = Number(declaredResponseLength)
        if (
          !Number.isSafeInteger(length)
          || length < 0
          || length > MAX_UPSTREAM_RESPONSE_BYTES
        ) {
          void slotOwnership.observe(upstream.body.cancel())
          return errorResponse(502, 'invalid_upstream_response', 'The shared AI service returned an invalid response.')
        }
      }

      const responseBody = validatedUpstreamBody(
        upstream.body,
        signal,
        input.data.stream ? 'sse' : 'json',
        slotOwnership,
      )
      responseOwnsSlot = true
      signal.throwIfAborted()
      return new Response(responseBody, {
        status: 200,
        headers: responseHeaders(
          expectedContentType === 'text/event-stream'
            ? 'text/event-stream; charset=utf-8'
            : 'application/json; charset=utf-8',
        ),
      })
    }
    catch (error) {
      if (error instanceof GatewayRequestError)
        return errorResponse(error.status, error.code, error.message)
      if (
        typeof error === 'object'
        && error !== null
        && 'name' in error
        && error.name === 'TimeoutError'
      ) {
        return errorResponse(504, 'upstream_timeout', 'The shared AI service timed out.')
      }
      return errorResponse(503, 'shared_service_unavailable', 'The shared AI service is unavailable.')
    }
    finally {
      if (!responseOwnsSlot) {
        if (!requestBodyStarted && request.body && slotOwnership) {
          requestBodyStarted = true
          void slotOwnership.observe(request.body.cancel())
        }
        slotOwnership?.finish()
      }
    }
  }
}
