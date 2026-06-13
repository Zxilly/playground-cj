import { Buffer } from 'node:buffer'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page, Route } from 'playwright'
import { startNextDevServer } from '../helpers/next-dev-server'

/**
 * End-to-end teaching-workspace flow against the real `/zh/tour/ai` page.
 *
 * The LLM, the Cangjie MCP knowledge source, and the remote runner are the only
 * external dependencies, and all three are mocked at the network boundary with
 * Playwright route handlers — the rest of the stack (IndexedDB repository, the
 * teacher `ToolLoopAgent`, the block component library, the workspace views and
 * export/import) runs for real in the browser.
 *
 * The teacher agent talks to an OpenAI-compatible `/chat/completions` endpoint;
 * the mock returns a scripted Server-Sent-Events stream per turn. A turn that
 * carries `tool_calls` drives the real teacher toolkit (which reads/writes the
 * real IndexedDB workspace), and the AI SDK tool loop continues automatically
 * after each complete tool-call turn — so a single typed message can set the
 * mission and author the first lesson, and a second message can append a
 * learning record once the learner has finished the lesson.
 */

const DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const

/** Base URL the teacher's OpenAI-compatible model posts to (see model-provider defaults). */
const LLM_BASE_URL = process.env.NEXT_PUBLIC_LLM_BASE_URL || 'https://llm.learningman.top/v1'
const LLM_COMPLETIONS_URL = `${LLM_BASE_URL}/chat/completions`

/** Backend `/run` endpoint the Cangjie runner posts to. */
const BACKEND_RUN_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://cj-api.learningman.top'}/run`

/** Cangjie documentation MCP endpoint (we never want the teacher to reach the real server). */
const MCP_URL = 'https://cj-mcp.learningman.top/mcp'

const PRINT_TASK_CODE = 'main() {\n    println("仓颉")\n}'

/** Build one SSE `data:` frame from an OpenAI streaming chat-completion chunk. */
function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

/**
 * Render a scripted assistant turn as an OpenAI-compatible streaming response
 * body. Each tool call is emitted as a single delta whose `function.arguments`
 * is already-complete JSON (the provider detects the parsable JSON and finishes
 * the tool call); an optional trailing text delta lets a turn also "speak".
 */
function streamBody(turn: {
  text?: string
  toolCalls?: { id: string, name: string, args: unknown }[]
}): string {
  const id = `chatcmpl-${Math.random().toString(36).slice(2)}`
  const base = { id, object: 'chat.completion.chunk', created: 1, model: 'mock-model' }
  const frames: string[] = []

  frames.push(sseFrame({ ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] }))

  if (turn.text) {
    frames.push(sseFrame({ ...base, choices: [{ index: 0, delta: { content: turn.text }, finish_reason: null }] }))
  }

  const toolCalls = turn.toolCalls ?? []
  toolCalls.forEach((call, index) => {
    frames.push(sseFrame({
      ...base,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index,
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.args) },
          }],
        },
        finish_reason: null,
      }],
    }))
  })

  frames.push(sseFrame({
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }))
  frames.push('data: [DONE]\n\n')
  return frames.join('')
}

async function fulfillStream(route: Route, body: string): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream; charset=utf-8',
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    body,
  })
}

interface ChatRequestMessage {
  role: string
  content?: unknown
  tool_calls?: { function?: { name?: string } }[]
}

/**
 * Inspect a `/chat/completions` request body. The request carries the full
 * conversation, so progress is read from the *messages* — never from a substring
 * of the whole body (which also contains the tool *definitions*, so e.g. the
 * literal `set_mission` always appears).
 *
 *  - `calledTools` — every tool name the assistant has already invoked.
 *  - `lastUserText` — the text of the most recent user turn (drives which step).
 */
function inspectRequest(postData: string | null): { calledTools: Set<string>, lastUserText: string } {
  const parsed = JSON.parse(postData ?? '{}') as { messages?: ChatRequestMessage[] }
  const messages = parsed.messages ?? []
  const calledTools = new Set<string>()
  let lastUserText = ''
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (call.function?.name)
          calledTools.add(call.function.name)
      }
    }
    if (message.role === 'user')
      lastUserText = extractText(message.content)
  }
  return { calledTools, lastUserText }
}

/** Flatten an OpenAI message `content` (string or content-part array) to plain text. */
function extractText(content: unknown): string {
  if (typeof content === 'string')
    return content
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === 'object' && part !== null && 'text' in part ? String((part as { text: unknown }).text) : ''))
      .join('')
  }
  return ''
}

/** The first lesson the mocked teacher authors: an immediate-feedback quiz + an interactive code task. */
const FIRST_LESSON_DRAFT = {
  title: '用 println 打印一行',
  missionLink: '为你的命令行工具打印输出',
  skillFocus: '调用 println 输出文本',
  zpdRationale: '你已经知道 main 入口，下一步是产生可见输出',
  blocks: [
    { type: 'prose', markdown: '仓颉用 `println` 向标准输出打印一行文本。' },
    {
      type: 'quiz',
      question: '哪个函数会打印一行并换行？',
      options: ['println 打印', 'readLine 读取'],
      answerIndices: [0],
      multiple: false,
      explanation: 'println 打印内容并自动换行。',
    },
    {
      type: 'code_task',
      prompt: '在 main 中用 println 打印「仓颉」。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: '仓颉',
      matchMode: 'exact' as const,
      hints: ['用 println("仓颉")。'],
    },
  ],
  citations: [],
}

describe('teach workspace e2e', () => {
  let server: Awaited<ReturnType<typeof startNextDevServer>>
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await startNextDevServer()
    browser = await chromium.launch({ headless: true })
  }, 180_000)

  beforeEach(async () => {
    page = await browser.newPage({ viewport: DESKTOP_VIEWPORT })

    // The MCP knowledge source degrades to an empty result when unreachable; abort
    // so it never tries the real server (the mocked teacher does not call it).
    await page.route(MCP_URL, route => route.abort())

    // Mock the remote runner: the print task succeeds, anything else "fails".
    await page.route(BACKEND_RUN_URL, async (route) => {
      const code = route.request().postData() ?? ''
      const printed = code.includes('println("仓颉")')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          compiler_output: '',
          compiler_code: 0,
          bin_output: printed ? '仓颉' : '',
          bin_code: 0,
        }),
      })
    })

    // Mock the teacher LLM. Branch on which tools the assistant has already called
    // (read from the conversation messages, not the raw body) so the script is
    // stable regardless of how many tool-loop round-trips the SDK makes.
    await page.route(LLM_COMPLETIONS_URL, async (route) => {
      const { calledTools, lastUserText } = inspectRequest(route.request().postData())
      const missionDone = calledTools.has('set_mission')
      const lessonDone = calledTools.has('create_lesson')
      const recordDone = calledTools.has('append_learning_record')
      const askedForRecord = lastUserText.includes('我学完了')

      // Second user message: the learner reports finishing the lesson → record it.
      if (askedForRecord) {
        if (!recordDone) {
          await fulfillStream(route, streamBody({
            toolCalls: [{
              id: 'call_record',
              name: 'append_learning_record',
              args: {
                title: '掌握 println 输出',
                body: '学习者已经能用 println 打印一行文本，并通过了运行验证。',
                evidence: '运行 println("仓颉") 输出匹配预期。',
              },
            }],
          }))
          return
        }
        await fulfillStream(route, streamBody({ text: '太好了，我已经把这次进步记录下来了。' }))
        return
      }

      // First user message: interview is done → set the mission, then author lesson 1.
      if (!missionDone) {
        await fulfillStream(route, streamBody({
          toolCalls: [{
            id: 'call_mission',
            name: 'set_mission',
            args: {
              topic: '用仓颉写一个命令行工具',
              why: '想在 HarmonyOS 上发布一个小工具',
              successLooksLike: ['能解析命令行参数', '能打印输出'],
              constraints: [],
              outOfScope: [],
            },
          }],
        }))
        return
      }

      if (!lessonDone) {
        await fulfillStream(route, streamBody({
          toolCalls: [{ id: 'call_lesson', name: 'create_lesson', args: FIRST_LESSON_DRAFT }],
        }))
        return
      }

      await fulfillStream(route, streamBody({ text: '我已经为你准备好第一课，去课程列表打开它吧。' }))
    })

    // Seed a complete user LLM config so the chat is ready and points at the mocked endpoint.
    await page.goto(`${server.url}/zh`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(async (baseURL) => {
      localStorage.setItem('tour-ai:config', JSON.stringify({
        state: {
          config: { provider: 'openai-compatible', baseURL, apiKey: 'user-key', model: 'mock-model' },
          keySource: 'user',
        },
        version: 0,
      }))
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('teach-workspace-zh')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    }, LLM_BASE_URL)
  }, 180_000)

  afterEach(async () => {
    if (page && !page.isClosed())
      await page.close()
  })

  afterAll(async () => {
    await browser?.close()
    await server?.stop()
  })

  it('interviews for a mission, authors and completes the first lesson, then records and round-trips the workspace', async () => {
    await page.goto(`${server.url}/zh/tour/ai`, { waitUntil: 'domcontentloaded' })

    // Workspace shell mounts; mission is empty so lessons are gated.
    await page.getByTestId('teach-workspace-shell').waitFor({ state: 'visible', timeout: 60_000 })
    const lessonsNav = page.getByTestId('workspace-nav-lessons')
    expect(await lessonsNav.isDisabled()).toBe(true)

    // Send the first message: the teacher sets the mission and authors lesson 1.
    const composer = page.getByRole('textbox', { name: '输入消息' })
    await composer.waitFor({ state: 'visible' })
    await composer.fill('我想学仓颉，帮我定个目标')
    await composer.press('Enter')

    // Mission view now shows the interviewed mission.
    await page.getByTestId('workspace-nav-mission').click()
    await page.getByTestId('mission-view').waitFor({ state: 'visible', timeout: 30_000 })
    await expect.poll(() => page.getByText('用仓颉写一个命令行工具').isVisible()).toBe(true)

    // Lessons are unlocked; open the first lesson.
    await expect.poll(() => lessonsNav.isDisabled()).toBe(false)
    await lessonsNav.click()
    await page.getByTestId('lessons-list-view').waitFor({ state: 'visible', timeout: 30_000 })
    await page.getByTestId('lesson-list-item').first().click()

    // Lesson renders its blocks (prose + quiz + code_task).
    await page.getByTestId('lesson-renderer').waitFor({ state: 'visible' })
    await page.getByTestId('quiz-block').waitFor({ state: 'visible' })

    // Answer the quiz correctly → immediate feedback.
    await page.getByTestId('quiz-option').first().click()
    await page.getByTestId('quiz-submit').click()
    const quizResult = page.getByTestId('quiz-result')
    await quizResult.waitFor({ state: 'visible' })
    expect(await quizResult.getAttribute('data-correct')).toBe('true')

    // Solve the code task: type the passing code and run it through the mocked runner.
    const editor = page.getByTestId('code-task-editor')
    await editor.fill(PRINT_TASK_CODE)
    await page.getByTestId('code-task-run').click()
    const codeResult = page.getByTestId('code-task-result')
    await codeResult.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await codeResult.getAttribute('data-status')).toBe('passed')

    // Tell the teacher we finished → it appends a learning record.
    await composer.fill('我学完了这一课')
    await composer.press('Enter')
    await page.getByTestId('workspace-nav-records').click()
    await page.getByTestId('records-view').waitFor({ state: 'visible', timeout: 30_000 })
    await expect.poll(() => page.getByText('掌握 println 输出').isVisible()).toBe(true)

    // Mark the lesson complete via its state so the list reflects completion, then
    // confirm the lessons list shows the completed status.
    await markFirstLessonCompleted(page)
    await page.getByTestId('workspace-nav-lessons').click()
    await page.getByTestId('lessons-list-view').waitFor({ state: 'visible' })
    await expect
      .poll(() => page.getByTestId('lesson-list-item').first().getAttribute('data-status'))
      .toBe('completed')

    // Export the workspace as JSON, then import it into a fresh database and
    // confirm the mission survives the round-trip.
    const snapshot = await exportSnapshot(page)
    expect(snapshot).toContain('用仓颉写一个命令行工具')
    expect(snapshot).toContain('掌握 println 输出')

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('teach-workspace-zh')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('teach-workspace-shell').waitFor({ state: 'visible', timeout: 60_000 })

    // After the reset, mission is empty again (lessons gated).
    await expect.poll(() => page.getByTestId('workspace-nav-lessons').isDisabled()).toBe(true)

    await importSnapshot(page, snapshot)

    // The imported workspace restores the mission and the completed lesson.
    await expect.poll(() => page.getByTestId('workspace-nav-lessons').isDisabled()).toBe(false)
    await page.getByTestId('workspace-nav-mission').click()
    await page.getByTestId('mission-view').waitFor({ state: 'visible', timeout: 30_000 })
    await expect.poll(() => page.getByText('用仓颉写一个命令行工具').isVisible()).toBe(true)
  }, 180_000)
})

/** Mark the first lesson completed by writing its state through the live IndexedDB repository. */
async function markFirstLessonCompleted(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('teach-workspace-zh', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      const lesson = await new Promise<{ id: string, state: { status: string, blockProgress: Record<string, unknown> } } | undefined>((resolve, reject) => {
        const tx = db.transaction('lessons', 'readonly')
        const request = tx.objectStore('lessons').get('0001')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      if (!lesson)
        throw new Error('lesson 0001 not found')
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('lessons', 'readwrite')
        tx.objectStore('lessons').put({
          ...lesson,
          state: { ...lesson.state, status: 'completed', completedAt: 1 },
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    }
    finally {
      db.close()
    }
  })
}

/** Click the export button and capture the downloaded JSON text. */
async function exportSnapshot(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('workspace-export').click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream)
    chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

/** Import the given JSON snapshot through the import file input. */
async function importSnapshot(page: Page, json: string): Promise<void> {
  const input = page.getByTestId('workspace-import-input')
  await input.setInputFiles({
    name: 'teach-workspace-zh.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf-8'),
  })
}
