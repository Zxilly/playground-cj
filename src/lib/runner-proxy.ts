/**
 * Server-side proxy for the Cangjie runner. Only the explicitly configured
 * server-side URL is used: silently sending source code to a public fallback
 * would both hide a deployment error and cross an unexpected trust boundary.
 */
import { createHash } from 'node:crypto'
import cangjieToolchainLock from '../../cj-runner/cangjie-toolchain.lock.json'
import type { RunnerRunResponse } from './runner-contract'
import { awaitWithSignal } from './ai/abortable-operation'
import {
  MAX_RUNNER_OUTPUT_BYTES,
  parseRunnerRunResponse,
} from './runner-contract'
import { getRunnerAdmissionGate } from './runner-admission'
import type { RunnerDependencyGuard } from './runner-dependency-guard'
import { getRunnerDependencyGuard } from './runner-dependency-guard'
import { canonicalJson } from './teach/classroom/canonical-json'

export const MAX_RUNNER_REQUEST_BYTES = 256 * 1024
// JSON.stringify may encode one valid output byte (for example NUL) as a
// six-byte `\u0000` escape. Budget compiler output plus both runtime streams at
// that worst case; the fixed allowance covers names, codes, phase, and syntax.
const MAX_JSON_BYTES_PER_OUTPUT_BYTE = 6
const MAX_RUNNER_RESPONSE_ENVELOPE_BYTES = 4 * 1024
export const MAX_RUNNER_RESPONSE_BYTES
  = 3 * MAX_RUNNER_OUTPUT_BYTES * MAX_JSON_BYTES_PER_OUTPUT_BYTE
    + MAX_RUNNER_RESPONSE_ENVELOPE_BYTES
export const MAX_CONCURRENT_RUNNER_REQUESTS = 4
export const RUNNER_REQUEST_BODY_TIMEOUT_MS = 5_000
export const RUNNER_UPSTREAM_TIMEOUT_MS = 25_000
export const RUNNER_TOTAL_TIMEOUT_MS = 28_000
export const MIN_RUNNER_SHARED_TOKEN_BYTES = 32
export const MAX_RUNNER_SHARED_TOKEN_BYTES = 512
export const RUNNER_TOOLCHAIN_LOCK_HEADER
  = 'X-Playground-Cangjie-Toolchain-Lock-Sha256'
const RUNNER_TOOLCHAIN_STATUS_HEADER
  = 'X-Playground-Cangjie-Toolchain-Status'
export const RUNNER_TOOLCHAIN_LOCK_SHA256 = createHash('sha256')
  .update(canonicalJson(cangjieToolchainLock), 'utf8')
  .digest('hex')

type RunnerAction = 'run'
type ParsedRunnerResponse = RunnerRunResponse
type RunnerUrlResolution
  = | { error: 'invalid' | 'missing' }
    | { url: URL }
type RunnerTokenResolution
  = | { error: 'invalid' | 'missing' }
    | { token: string | null }
type RunnerModalProxyAuthResolution
  = | { error: 'invalid' | 'missing' }
    | { key: string | null, secret: string | null }

class BodyTooLargeError extends Error {}
class InvalidContentLengthError extends Error {}
class InvalidUtf8Error extends Error {}
class InvalidRunnerResponseError extends Error {}
class RequestBodyTimeoutError extends Error {}

// This bulkhead protects one Next.js process from exhausting its local sockets
// and memory. Deployment-wide request admission is enforced through Redis.
let activeRunnerRequests = 0

interface RunnerSlotOwnership {
  readonly wait: <T>(
    operation: PromiseLike<T>,
    signal: AbortSignal,
    dependency: string,
  ) => Promise<T>
  readonly observe: (
    operation: PromiseLike<unknown>,
    dependency: string,
  ) => Promise<void>
  readonly finish: () => void
}

// Returning on a deadline does not prove that an abort-ignoring Redis, stream,
// or fetch operation stopped. The local slot remains owned until the logical
// request and every raw operation it started have both settled.
function createRunnerSlotOwnership(
  release: () => void,
  dependencyGuard: RunnerDependencyGuard,
): RunnerSlotOwnership {
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
    wait: <T>(
      operation: PromiseLike<T>,
      signal: AbortSignal,
      dependency: string,
    ) => {
      const tracked = track(operation)
      dependencyGuard.watch(tracked, signal, dependency)
      return awaitWithSignal(tracked, signal)
    },
    observe: (operation, dependency) => {
      const tracked = track(operation)
      dependencyGuard.watchCancellation(tracked, dependency)
      return tracked.then(
        () => undefined,
        () => undefined,
      )
    },
    finish() {
      finished = true
      releaseIfSettled()
    },
  }
}

function jsonError(
  status: number,
  code: string,
  error: string,
  options: {
    details?: Record<string, unknown>
    headers?: HeadersInit
  } = {},
): Response {
  const headers = new Headers(options.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')

  return Response.json(
    { error, code, ...options.details },
    { status, headers },
  )
}

function methodNotAllowed(): Response {
  return jsonError(405, 'method_not_allowed', 'Only POST requests are supported.', {
    headers: { Allow: 'POST' },
  })
}

function parseMediaType(value: string | null): string | null {
  if (!value)
    return null

  const [mediaType, ...parameters] = value.split(';')
  const normalizedMediaType = mediaType.trim().toLowerCase()
  if (!normalizedMediaType)
    return null

  let sawCharset = false
  for (const parameter of parameters) {
    const [rawName, ...rawValueParts] = parameter.split('=')
    if (rawValueParts.length === 0)
      return null

    const name = rawName.trim().toLowerCase()
    const rawValue = rawValueParts.join('=').trim()
    if (!name || !rawValue)
      return null

    if (name !== 'charset' || sawCharset)
      return null
    sawCharset = true
    const startsQuoted = rawValue.startsWith('"')
    const endsQuoted = rawValue.endsWith('"')
    if (startsQuoted !== endsQuoted)
      return null
    const charset = (
      startsQuoted
        ? rawValue.slice(1, -1)
        : rawValue
    ).toLowerCase()
    if (!charset || charset.includes('"'))
      return null
    if (charset !== 'utf-8' && charset !== 'utf8')
      return null
  }

  return normalizedMediaType
}

function acceptsMediaType(mediaType: string | null): boolean {
  return mediaType === 'text/plain' || mediaType === 'application/json'
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isSameOriginBrowserRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase() ?? null
  if (fetchSite && fetchSite !== 'same-origin')
    return false

  const origin = request.headers.get('origin')
  let matchesOrigin = false
  if (origin) {
    try {
      matchesOrigin = new URL(origin).origin === new URL(request.url).origin
    }
    catch {
      return false
    }
    if (!matchesOrigin)
      return false
  }

  // Origin and Sec-Fetch-Site are forbidden browser headers. Requiring at
  // least one prevents a cross-site form POST from spending runner capacity.
  return fetchSite === 'same-origin' || matchesOrigin
}

function resolveRunnerUrl(action: RunnerAction): RunnerUrlResolution {
  const configuredUrl = process.env.CJ_RUNNER_URL?.trim()
  if (!configuredUrl)
    return { error: 'missing' }

  let url: URL
  try {
    url = new URL(configuredUrl)
  }
  catch {
    return { error: 'invalid' }
  }

  const loopbackHttp = process.env.NODE_ENV !== 'production'
    && url.protocol === 'http:'
    && isLoopbackHostname(url.hostname)
  if (
    (url.protocol !== 'https:' && !loopbackHttp)
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    return { error: 'invalid' }
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${action}`
  return { url }
}

function resolveRunnerSharedToken(runnerUrl: URL): RunnerTokenResolution {
  const token = process.env.CJ_RUNNER_SHARED_TOKEN
  if (token == null || token === '') {
    return process.env.NODE_ENV !== 'production' && isLoopbackHostname(runnerUrl.hostname)
      ? { token: null }
      : { error: 'missing' }
  }
  if (
    token !== token.trim()
    || token.length < MIN_RUNNER_SHARED_TOKEN_BYTES
    || token.length > MAX_RUNNER_SHARED_TOKEN_BYTES
    || !/^[\x21-\x7E]+$/.test(token)
  ) {
    return { error: 'invalid' }
  }
  return { token }
}

function resolveRunnerModalProxyAuth(
  runnerUrl: URL,
): RunnerModalProxyAuthResolution {
  const key = process.env.CJ_RUNNER_MODAL_PROXY_KEY
  const secret = process.env.CJ_RUNNER_MODAL_PROXY_SECRET
  const isModalEndpoint = runnerUrl.hostname.endsWith('.modal.run')

  if (!key && !secret) {
    return isModalEndpoint
      ? { error: 'missing' }
      : { key: null, secret: null }
  }
  if (
    !key
    || !secret
    || key !== key.trim()
    || secret !== secret.trim()
    || !/^wk-[A-Za-z0-9]+$/.test(key)
    || !/^ws-[A-Za-z0-9]+$/.test(secret)
  ) {
    return { error: 'invalid' }
  }
  return { key, secret }
}

function validateContentLength(request: Request): void {
  const value = request.headers.get('content-length')
  if (value == null)
    return

  if (!/^\d+$/.test(value))
    throw new InvalidContentLengthError()

  const length = Number(value)
  if (!Number.isSafeInteger(length))
    throw new InvalidContentLengthError()
  if (length > MAX_RUNNER_REQUEST_BYTES)
    throw new BodyTooLargeError()
}

interface OwnedBodyReader {
  readonly read: (
    signal: AbortSignal,
  ) => Promise<ReadableStreamReadResult<Uint8Array>>
  readonly cancel: (reason?: unknown) => Promise<void>
}

function createOwnedBodyReader(
  body: ReadableStream<Uint8Array>,
  ownership: RunnerSlotOwnership,
  dependency: string,
): OwnedBodyReader {
  const reader = body.getReader()
  let cancellation: Promise<void> | null = null
  const cancel = (reason?: unknown): Promise<void> => {
    cancellation ??= ownership.observe(
      reader.cancel(reason),
      `${dependency} cancellation`,
    )
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
        return await ownership.wait(
          reader.read(),
          signal,
          `${dependency} read`,
        )
      }
      finally {
        signal.removeEventListener('abort', handleAbort)
      }
    },
    cancel,
  }
}

function cancelUnreadRequestBody(
  request: Request,
  ownership: RunnerSlotOwnership,
  reason: unknown,
): void {
  const body = request.body
  if (!body || request.bodyUsed || body.locked)
    return

  let cancellation: Promise<void>
  try {
    cancellation = body.cancel(reason)
  }
  catch {
    // An unlocked, unused Web Stream should return a cancellation promise.
    // A synchronous implementation error has no raw promise to retain.
    return
  }
  void ownership.observe(cancellation, 'unread request body cancellation')
}

async function readBoundedUtf8Body(
  request: Request,
  ownership: RunnerSlotOwnership,
  requestDeadlineSignal: AbortSignal,
): Promise<string> {
  validateContentLength(request)

  if (!request.body)
    return ''

  const reader = createOwnedBodyReader(
    request.body,
    ownership,
    'request body stream',
  )
  const chunks: Uint8Array[] = []
  let byteLength = 0
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => {
    timeoutController.abort(
      new DOMException('Runner request body timed out.', 'TimeoutError'),
    )
  }, RUNNER_REQUEST_BODY_TIMEOUT_MS)
  const signal = AbortSignal.any([
    request.signal,
    requestDeadlineSignal,
    timeoutController.signal,
  ])

  try {
    while (true) {
      const { done, value } = await reader.read(signal)
      if (done)
        break

      byteLength += value.byteLength
      if (byteLength > MAX_RUNNER_REQUEST_BYTES) {
        void reader.cancel('request body too large')
        throw new BodyTooLargeError()
      }
      chunks.push(value)
    }
  }
  catch (error) {
    if (timeoutController.signal.aborted)
      throw new RequestBodyTimeoutError()
    throw error
  }
  finally {
    clearTimeout(timeout)
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  }
  catch {
    throw new InvalidUtf8Error()
  }
}

function parseJsonObject(body: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  }
  catch {
    return null
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed))
    return null

  return parsed as Record<string, unknown>
}

function isValidJsonRunBody(body: string): boolean {
  const payload = parseJsonObject(body)
  if (!payload)
    return false

  if (Object.keys(payload).some(key => key !== 'code' && key !== 'stdin'))
    return false

  return typeof payload.code === 'string'
    && (payload.stdin === undefined || typeof payload.stdin === 'string')
}

function parseRunnerResponse(body: string): ParsedRunnerResponse | null {
  const payload = parseJsonObject(body)
  if (!payload)
    return null

  return parseRunnerRunResponse(payload)
}

function acquireRunnerSlot(): (() => void) | null {
  if (activeRunnerRequests >= MAX_CONCURRENT_RUNNER_REQUESTS)
    return null
  activeRunnerRequests += 1
  let released = false
  return () => {
    if (released)
      return
    released = true
    activeRunnerRequests -= 1
  }
}

function isJsonResponse(response: Response): boolean {
  return parseMediaType(response.headers.get('content-type')) === 'application/json'
}

async function readRunnerResponse(
  response: Response,
  signal: AbortSignal,
  ownership: RunnerSlotOwnership,
): Promise<string> {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const length = Number(declaredLength)
    if (Number.isSafeInteger(length) && length > MAX_RUNNER_RESPONSE_BYTES) {
      void discardResponseBody(response, ownership)
      throw new InvalidRunnerResponseError()
    }
  }

  if (!response.body)
    throw new InvalidRunnerResponseError()

  const reader = createOwnedBodyReader(
    response.body,
    ownership,
    'runner response body',
  )
  const chunks: Uint8Array[] = []
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read(signal)
    if (done)
      break

    byteLength += value.byteLength
    if (byteLength > MAX_RUNNER_RESPONSE_BYTES) {
      void reader.cancel('runner response too large')
      throw new InvalidRunnerResponseError()
    }
    chunks.push(value)
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  }
  catch {
    throw new InvalidRunnerResponseError()
  }
}

function discardResponseBody(
  response: Response,
  ownership: RunnerSlotOwnership,
): Promise<void> {
  if (!response.body)
    return Promise.resolve()
  return ownership.observe(
    response.body.cancel(),
    'runner response body cancellation',
  )
}

function logUpstreamFailure(action: RunnerAction, error: unknown): void {
  console.error(`[runner-proxy] ${action} request failed`, error)
}

export async function proxyToRunner(request: Request, action: RunnerAction): Promise<Response> {
  if (request.method.toUpperCase() !== 'POST')
    return methodNotAllowed()

  const contentType = request.headers.get('content-type')
  const mediaType = parseMediaType(contentType)
  if (!acceptsMediaType(mediaType)) {
    return jsonError(
      415,
      'unsupported_media_type',
      'Content-Type must be text/plain or application/json with UTF-8 content.',
    )
  }

  if (!isSameOriginBrowserRequest(request)) {
    return jsonError(
      403,
      'cross_origin_request_rejected',
      'Runner requests must originate from this application.',
    )
  }

  const runnerUrl = resolveRunnerUrl(action)
  if ('error' in runnerUrl) {
    if (runnerUrl.error === 'invalid') {
      return jsonError(
        503,
        'runner_invalid_configuration',
        'CJ_RUNNER_URL must be an HTTPS base URL without credentials, query parameters, or a fragment; non-production loopback HTTP is the only exception.',
      )
    }
    return jsonError(
      503,
      'runner_not_configured',
      'Runner service is not configured. Set CJ_RUNNER_URL to an HTTP(S) base URL.',
    )
  }

  const runnerToken = resolveRunnerSharedToken(runnerUrl.url)
  if ('error' in runnerToken) {
    return jsonError(
      503,
      'runner_invalid_auth_configuration',
      runnerToken.error === 'missing'
        ? 'CJ_RUNNER_SHARED_TOKEN must be set except for an explicit non-production loopback runner.'
        : `CJ_RUNNER_SHARED_TOKEN must contain ${MIN_RUNNER_SHARED_TOKEN_BYTES}-${MAX_RUNNER_SHARED_TOKEN_BYTES} printable ASCII bytes without spaces.`,
    )
  }

  const modalProxyAuth = resolveRunnerModalProxyAuth(runnerUrl.url)
  if ('error' in modalProxyAuth) {
    return jsonError(
      503,
      'runner_invalid_modal_auth_configuration',
      modalProxyAuth.error === 'missing'
        ? 'Modal runner endpoints require CJ_RUNNER_MODAL_PROXY_KEY and CJ_RUNNER_MODAL_PROXY_SECRET.'
        : 'Modal runner proxy credentials are malformed or incomplete.',
    )
  }

  let admissionGate
  try {
    admissionGate = getRunnerAdmissionGate()
  }
  catch {
    return jsonError(
      503,
      'runner_admission_unavailable',
      'Runner admission control is unavailable.',
    )
  }

  const dependencyGuard = getRunnerDependencyGuard()
  if (!dependencyGuard.canAccept()) {
    return jsonError(
      503,
      'runner_dependency_cancellation_pending',
      'Runner proxy is recycling an unhealthy dependency. Retry shortly.',
      { headers: { 'Retry-After': '1' } },
    )
  }

  const releaseRunnerSlot = acquireRunnerSlot()
  if (releaseRunnerSlot === null) {
    return jsonError(
      503,
      'runner_proxy_busy',
      'Runner proxy is handling too many requests. Retry shortly.',
      { headers: { 'Retry-After': '1' } },
    )
  }
  const slotOwnership = createRunnerSlotOwnership(
    releaseRunnerSlot,
    dependencyGuard,
  )
  const requestDeadlineController = new AbortController()
  const requestDeadline = setTimeout(() => {
    requestDeadlineController.abort(
      new DOMException('Runner request deadline exceeded.', 'TimeoutError'),
    )
  }, RUNNER_TOTAL_TIMEOUT_MS)
  const finishRequest = () => {
    clearTimeout(requestDeadline)
    slotOwnership.finish()
  }

  const admissionTimeoutController = new AbortController()
  const admissionTimeout = setTimeout(() => {
    admissionTimeoutController.abort(
      new DOMException('Runner admission timed out.', 'TimeoutError'),
    )
  }, admissionGate.timeoutMs)
  const admissionSignal = AbortSignal.any([
    request.signal,
    requestDeadlineController.signal,
    admissionTimeoutController.signal,
  ])
  try {
    const identity = admissionGate.resolveIdentity(request.headers)
    const permitted = await slotOwnership.wait(
      admissionGate.consume(identity, admissionSignal),
      admissionSignal,
      'runner Redis admission',
    )
    if (!permitted) {
      cancelUnreadRequestBody(
        request,
        slotOwnership,
        'runner admission rejected the request',
      )
      finishRequest()
      return jsonError(
        429,
        'runner_rate_limit_exceeded',
        'Too many runner requests. Retry later.',
        { headers: { 'Retry-After': '60' } },
      )
    }
  }
  catch {
    cancelUnreadRequestBody(
      request,
      slotOwnership,
      admissionSignal.reason
      ?? 'runner admission was unavailable',
    )
    finishRequest()
    if (request.signal.aborted)
      return jsonError(499, 'request_aborted', 'Request was cancelled.')
    if (requestDeadlineController.signal.aborted)
      return jsonError(504, 'runner_timeout', 'Runner request timed out.')
    return jsonError(
      503,
      'runner_admission_unavailable',
      'Runner admission control is unavailable.',
      { headers: { 'Retry-After': '1' } },
    )
  }
  finally {
    clearTimeout(admissionTimeout)
  }

  let body: string
  try {
    body = await readBoundedUtf8Body(
      request,
      slotOwnership,
      requestDeadlineController.signal,
    )
  }
  catch (error) {
    if (error instanceof BodyTooLargeError) {
      cancelUnreadRequestBody(request, slotOwnership, error)
      finishRequest()
      return jsonError(
        413,
        'request_body_too_large',
        `Request body exceeds the ${MAX_RUNNER_REQUEST_BYTES}-byte limit.`,
      )
    }
    if (error instanceof InvalidContentLengthError) {
      cancelUnreadRequestBody(request, slotOwnership, error)
      finishRequest()
      return jsonError(400, 'invalid_content_length', 'Content-Length must be a non-negative integer.')
    }
    if (error instanceof InvalidUtf8Error) {
      finishRequest()
      return jsonError(400, 'invalid_utf8', 'Request body must be valid UTF-8.')
    }
    if (error instanceof RequestBodyTimeoutError) {
      finishRequest()
      return jsonError(408, 'request_body_timeout', 'Request body was not received in time.')
    }
    if (request.signal.aborted) {
      finishRequest()
      return jsonError(499, 'request_aborted', 'Request was cancelled.')
    }
    if (requestDeadlineController.signal.aborted) {
      finishRequest()
      return jsonError(504, 'runner_timeout', 'Runner request timed out.')
    }

    console.error('[runner-proxy] Failed to read request body', error)
    finishRequest()
    return jsonError(400, 'invalid_request_body', 'Request body could not be read.')
  }

  if (mediaType === 'application/json' && !isValidJsonRunBody(body)) {
    finishRequest()
    return jsonError(
      400,
      'invalid_json_body',
      'JSON body must contain only a string "code" field and an optional string "stdin" field.',
    )
  }

  if (request.signal.aborted) {
    finishRequest()
    return jsonError(499, 'request_aborted', 'Request was cancelled.')
  }

  const timeoutController = new AbortController()
  const timeout = setTimeout(() => {
    timeoutController.abort(new DOMException('Runner request timed out.', 'TimeoutError'))
  }, RUNNER_UPSTREAM_TIMEOUT_MS)
  const upstreamSignal = AbortSignal.any([
    request.signal,
    requestDeadlineController.signal,
    timeoutController.signal,
  ])

  try {
    const upstreamOperation = Promise.resolve(fetch(runnerUrl.url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType!,
        [RUNNER_TOOLCHAIN_LOCK_HEADER]: RUNNER_TOOLCHAIN_LOCK_SHA256,
        ...(runnerToken.token
          ? { Authorization: `Bearer ${runnerToken.token}` }
          : {}),
        ...(modalProxyAuth.key && modalProxyAuth.secret
          ? {
              'Modal-Key': modalProxyAuth.key,
              'Modal-Secret': modalProxyAuth.secret,
            }
          : {}),
      },
      body,
      redirect: 'error',
      signal: upstreamSignal,
    })).then((response) => {
      // An abort-ignoring fetch may produce a late response after this request
      // has already returned. Cancel and own that body before the fetch promise
      // settles so the slot cannot be released between those two operations.
      if (upstreamSignal.aborted && response.body) {
        void slotOwnership.observe(
          response.body.cancel(upstreamSignal.reason),
          'late runner response body cancellation',
        )
      }
      return response
    })
    const upstream = await slotOwnership.wait(
      upstreamOperation,
      upstreamSignal,
      'runner fetch',
    )

    if (!upstream.ok) {
      const upstreamStatus = upstream.status
      const retryAfter = upstream.headers.get('retry-after')
      void discardResponseBody(upstream, slotOwnership)
      console.error(`[runner-proxy] ${action} upstream returned HTTP ${upstreamStatus}`)

      const toolchainMismatch = upstreamStatus === 503
        && upstream.headers.get(RUNNER_TOOLCHAIN_STATUS_HEADER) === 'mismatch'
      const status = (
        upstreamStatus >= 400 && upstreamStatus < 500
      ) || toolchainMismatch
        ? upstreamStatus
        : 502
      return jsonError(
        status,
        toolchainMismatch
          ? 'runner_toolchain_mismatch'
          : 'runner_upstream_error',
        toolchainMismatch
          ? 'Runner deployment uses a different Cangjie toolchain lock.'
          : `Runner service returned HTTP ${upstreamStatus}.`,
        {
          details: { upstreamStatus },
          headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
        },
      )
    }

    if (!isJsonResponse(upstream)) {
      const upstreamContentType = upstream.headers.get('content-type')
      void discardResponseBody(upstream, slotOwnership)
      console.error(
        `[runner-proxy] ${action} upstream returned unexpected Content-Type`,
        upstreamContentType,
      )
      return jsonError(
        502,
        'invalid_runner_response',
        'Runner service returned an invalid response.',
      )
    }

    const upstreamBody = await readRunnerResponse(
      upstream,
      upstreamSignal,
      slotOwnership,
    )
    const payload = parseRunnerResponse(upstreamBody)
    if (!payload) {
      console.error(`[runner-proxy] ${action} upstream returned an invalid JSON payload`)
      return jsonError(
        502,
        'invalid_runner_response',
        'Runner service returned an invalid response.',
      )
    }

    return new Response(JSON.stringify(payload), {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  catch (error) {
    if (request.signal.aborted)
      return jsonError(499, 'request_aborted', 'Request was cancelled.')

    if (
      timeoutController.signal.aborted
      || requestDeadlineController.signal.aborted
    ) {
      console.error(`[runner-proxy] ${action} upstream timed out after ${RUNNER_UPSTREAM_TIMEOUT_MS} ms`)
      return jsonError(504, 'runner_timeout', 'Runner service timed out.')
    }

    if (error instanceof InvalidRunnerResponseError) {
      console.error(`[runner-proxy] ${action} upstream response exceeded limits or was not valid UTF-8`)
      return jsonError(
        502,
        'invalid_runner_response',
        'Runner service returned an invalid response.',
      )
    }

    logUpstreamFailure(action, error)
    return jsonError(502, 'runner_unreachable', 'Runner service is unavailable.')
  }
  finally {
    clearTimeout(timeout)
    finishRequest()
  }
}
