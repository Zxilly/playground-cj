import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page, Route } from 'playwright'
import toolchainLock from '../../cj-runner/cangjie-toolchain.lock.json'
import {
  contentPackExternalReviewAttestationSigningPayload,
  publishExternallyAttestedArtifact,
} from '../../src/lib/teach/classroom/content-pack-artifact'
import type {
  ContentPackExternalReviewAttestationUnsigned,
} from '../../src/lib/teach/classroom/content-pack-artifact'
import { lockedCangjieCompilerIdentity } from '../../src/lib/teach/classroom/cangjie-toolchain'
import enContentPacks from '../../src/lib/teach/classroom/generated/content-packs/en.json'
import manifest from '../../src/lib/teach/classroom/generated/content-packs/manifest.json'
import publicationHistory from '../../src/lib/teach/classroom/generated/content-packs/publication-history.json'
import reviewDeclaration from '../../src/lib/teach/classroom/generated/content-packs/repository-review-declaration.json'
import validationReceipt from '../../src/lib/teach/classroom/generated/content-packs/validation-receipt.json'
import { startNextDevServer } from '../helpers/next-dev-server'

const VIEWPORT = { width: 1280, height: 900 } as const
const MOCK_LLM_BASE_URL = 'https://mock-llm.invalid/v1'
const MOCK_COMPLETIONS_URL = `${MOCK_LLM_BASE_URL}/chat/completions`
const MAIN_CONTENT_VERSION = enContentPacks.currentVersions['cj.program.main']

function createExternallyAttestedEnglishContentPacks() {
  const historyHead = publicationHistory.entries.at(-1)
  if (!historyHead)
    throw new Error('Content Pack publication history is empty')

  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const unsignedAttestation: ContentPackExternalReviewAttestationUnsigned = {
    schemaVersion: 1,
    kind: 'external-content-pack-review-attestation',
    algorithm: 'Ed25519',
    keyId: 'e2e-curriculum-review',
    issuedAt: '2026-07-26T00:00:00Z',
    subject: {
      publicationEntrySha256: historyHead.entrySha256,
      manifestSha256: historyHead.manifestSha256,
      validationReceiptSha256: historyHead.validationReceiptSha256,
      artifacts: historyHead.artifacts,
      approvedPacks: [{
        locale: 'en',
        conceptId: 'cj.program.main',
        contentVersion: MAIN_CONTENT_VERSION,
      }],
    },
  }
  const attestation = {
    ...unsignedAttestation,
    signature: sign(
      null,
      Buffer.from(
        contentPackExternalReviewAttestationSigningPayload(
          unsignedAttestation,
        ),
        'utf8',
      ),
      privateKey,
    ).toString('base64'),
  }
  const response = publishExternallyAttestedArtifact(
    enContentPacks,
    manifest,
    reviewDeclaration,
    validationReceipt,
    publicationHistory,
    attestation,
    {
      'e2e-curriculum-review': publicKey.export({
        type: 'spki',
        format: 'pem',
      }).toString(),
    },
    lockedCangjieCompilerIdentity(toolchainLock),
  )
  const mainPack = response.packs.find(
    pack => pack.concept.id === 'cj.program.main'
      && pack.version === MAIN_CONTENT_VERSION,
  )
  if (mainPack?.review.status !== 'approved') {
    throw new Error(
      'The E2E external review attestation did not approve cj.program.main',
    )
  }
  return response
}

const EXTERNALLY_ATTESTED_EN_CONTENT_PACKS
  = createExternallyAttestedEnglishContentPacks()

interface ChatMessage {
  role?: string
  tool_calls?: Array<{ function?: { name?: string } }>
}

function calledTools(postData: string | null): Set<string> {
  const body = JSON.parse(postData ?? '{}') as { messages?: ChatMessage[] }
  return new Set((body.messages ?? []).flatMap(message =>
    message.role === 'assistant'
      ? (message.tool_calls ?? []).flatMap(call =>
          call.function?.name ? [call.function.name] : [])
      : []))
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function streamBody(turn: {
  text?: string
  toolCall?: { id: string, name: string, args: unknown }
}): string {
  const base = {
    id: `chatcmpl-${turn.toolCall?.id ?? 'done'}`,
    object: 'chat.completion.chunk',
    created: 1,
    model: 'mock-model',
  }
  const frames = [
    sseFrame({
      ...base,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    }),
  ]
  if (turn.text) {
    frames.push(sseFrame({
      ...base,
      choices: [{ index: 0, delta: { content: turn.text }, finish_reason: null }],
    }))
  }
  if (turn.toolCall) {
    frames.push(sseFrame({
      ...base,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: turn.toolCall.id,
            type: 'function',
            function: {
              name: turn.toolCall.name,
              arguments: JSON.stringify(turn.toolCall.args),
            },
          }],
        },
        finish_reason: null,
      }],
    }))
  }
  frames.push(sseFrame({
    ...base,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: turn.toolCall ? 'tool_calls' : 'stop',
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }))
  frames.push('data: [DONE]\n\n')
  return frames.join('')
}

async function fulfillTurn(route: Route, turn: Parameters<typeof streamBody>[0]) {
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream; charset=utf-8',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
    body: streamBody(turn),
  })
}

async function replaceExerciseCode(
  page: Page,
  exerciseIndex: number,
  code: string,
): Promise<void> {
  const exercise = page.getByTestId('exercise-instance').nth(exerciseIndex)
  const editor = exercise.locator('.monaco-editor')
  await editor.waitFor({ state: 'visible', timeout: 60_000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}

describe('aI classroom workspace e2e', () => {
  let browser: Browser
  let page: Page
  let server: Awaited<ReturnType<typeof startNextDevServer>>

  beforeAll(async () => {
    server = await startNextDevServer()
    browser = await chromium.launch({ headless: true })
  }, 180_000)

  beforeEach(async () => {
    page = await browser.newPage({ viewport: VIEWPORT })
    await page.route(
      /\/api\/teach\/content-packs(?:\?.*)?$/,
      async (route) => {
        const lang = new URL(route.request().url()).searchParams.get('lang')
        if (lang !== 'en') {
          await route.continue()
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          headers: { 'Cache-Control': 'no-store' },
          body: JSON.stringify(EXTERNALLY_ATTESTED_EN_CONTENT_PACKS),
        })
      },
    )
    await page.goto(`${server.url}/en`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(async (baseURL) => {
      localStorage.clear()
      localStorage.setItem('teach:onboarded', '1')
      localStorage.setItem('tour-ai:config', JSON.stringify({
        state: {
          config: {
            transport: 'direct',
            provider: 'openai-compatible',
            baseURL,
            apiKey: 'e2e-user-key',
            model: 'mock-model',
          },
          keySource: 'user',
        },
        version: 2,
      }))
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('playground-cj-ai-classroom-v8')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(
          'playground-cj-ai-classroom-content-packs-v1',
        )
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    }, MOCK_LLM_BASE_URL)

    await page.route('**/api/run', async (route) => {
      const code = route.request().postData() ?? ''
      const output = code.includes('main is the entry point')
        ? 'main is the entry point\n'
        : code.includes('Hello from main')
          ? 'Hello from main\n'
          : 'unexpected\n'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          phase: 'run',
          compiler_output: '',
          compiler_output_truncated: false,
          compiler_code: 0,
          bin_stdout: output,
          bin_stdout_truncated: false,
          bin_stderr: '',
          bin_stderr_truncated: false,
          bin_code: 0,
        }),
      })
    })

    await page.route(MOCK_COMPLETIONS_URL, async (route) => {
      const tools = calledTools(route.request().postData())
      if (!tools.has('read_classroom_state')) {
        await fulfillTurn(route, {
          toolCall: { id: 'read-state', name: 'read_classroom_state', args: {} },
        })
        return
      }
      if (!tools.has('read_content_pack')) {
        await fulfillTurn(route, {
          toolCall: {
            id: 'read-pack',
            name: 'read_content_pack',
            args: {
              conceptId: 'cj.program.main',
              contentVersion: MAIN_CONTENT_VERSION,
            },
          },
        })
        return
      }
      if (!tools.has('append_content_reference_group')) {
        await fulfillTurn(route, {
          toolCall: {
            id: 'append-core',
            name: 'append_content_reference_group',
            args: {
              conceptId: 'cj.program.main',
              learningSkillId: 'skill:cj.program.main:core',
              blockIds: [
                'block:cj.program.main:01-welcome/01-intro/01:prose',
                'block:cj.program.main:01-welcome/01-intro/01:code',
              ],
            },
          },
        })
        return
      }
      if (!tools.has('create_exercise_instance')) {
        await fulfillTurn(route, {
          toolCall: {
            id: 'create-practice',
            name: 'create_exercise_instance',
            args: {
              conceptId: 'cj.program.main',
              contentVersion: MAIN_CONTENT_VERSION,
              templateId: 'template:cj.program.main:practice',
              personalizationInputs: { difficultyTarget: 'easy' },
            },
          },
        })
        return
      }
      await fulfillTurn(route, {
        text: 'The first validated tutoring step is ready in Live View.',
      })
    })
  }, 180_000)

  afterEach(async () => {
    if (!page.isClosed())
      await page.close()
  })

  afterAll(async () => {
    await browser?.close()
    await server?.stop()
  })

  it('runs the complete evidence, review, assistance, and persistence path', async () => {
    await page.goto(`${server.url}/en/tour/ai`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('teach-workspace-shell').waitFor({
      state: 'visible',
      timeout: 60_000,
    })

    await page.getByLabel('What do you want to be able to do?').fill(
      'Build small Cangjie programs independently',
    )
    await page.getByRole('button', { name: 'Start Learning Track' }).click()
    await page.getByText('Build small Cangjie programs independently').waitFor()

    // Establish a genuinely independent baseline before exposing any Teacher
    // Chat text. A failed first Review Check remains Independent Evidence but
    // does not advance the Track frontier, so the main tutoring step can still
    // follow and become aided after Chat.
    await page.getByTestId('workspace-nav-review').click()
    await page.getByTestId('review-view').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Create Review Check' }).click()
    await expect.poll(() => page.getByText('Review Check').count()).toBeGreaterThan(0)
    const independentReviewCheck = page.getByTestId('exercise-instance').last()
    await replaceExerciseCode(page, 0, [
      'main() {',
      '    println("not the review answer")',
      '}',
    ].join('\n'))
    await independentReviewCheck
      .getByRole('button', { name: 'Run and record attempt' })
      .click()
    await independentReviewCheck.getByText('Not passed yet').waitFor()
    await independentReviewCheck.getByText('Independent Evidence').waitFor()

    await page.getByTestId('workspace-nav-live').click()
    const composer = page.getByTestId('workspace-chat').locator('textarea')
    await composer.fill('Please start my first tutoring step.')
    await composer.press('Enter')

    await page.getByTestId('exercise-instance').waitFor({
      state: 'visible',
      timeout: 60_000,
    })
    await expect.poll(() =>
      page.getByText('Complete the code with a top-level main that prints only').count(),
    ).toBeGreaterThan(0)

    const practice = page.getByTestId('exercise-instance').last()
    await practice.getByRole('button', { name: 'Show hint' }).click()
    await page.getByText('Define main at the top level without the func keyword.').waitFor()
    await replaceExerciseCode(
      page,
      await page.getByTestId('exercise-instance').count() - 1,
      [
        'main() {',
        '    println("Hello from main")',
        '}',
      ].join('\n'),
    )
    await practice.getByRole('button', { name: 'Run and record attempt' }).click()
    await practice.getByText('Passed').waitFor()
    await practice.getByText('Aided Evidence').waitFor()

    await page.getByTestId('workspace-nav-progress').click()
    await page.getByTestId('concept-progress-view').waitFor({ state: 'visible' })
    await page.getByText('Practicing').first().waitFor()

    await page.getByTestId('workspace-nav-review').click()
    await page.getByTestId('review-view').waitFor({ state: 'visible' })
    await expect.poll(() => page.getByText('seen').count()).toBeGreaterThan(0)
    expect(await page.getByTestId('review-view').isVisible()).toBe(true)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('live-classroom-view').waitFor({
      state: 'visible',
      timeout: 60_000,
    })
    expect(await page.getByRole('heading', {
      name: 'Build small Cangjie programs independently',
      exact: true,
    }).isVisible()).toBe(true)
    await expect.poll(() => page.getByTestId('exercise-instance').count()).toBe(2)
    expect(await page.getByText('Define main at the top level without the func keyword.').isVisible())
      .toBe(true)
    await expect.poll(() => page.getByText('Passed', { exact: true }).count())
      .toBe(1)
    expect(await page.getByText('Not passed yet').isVisible()).toBe(true)
    expect(await page.getByText('Aided Evidence').isVisible()).toBe(true)
    expect(await page.getByText(
      'Independent Evidence',
      { exact: true },
    ).isVisible()).toBe(true)
  }, 180_000)
})
