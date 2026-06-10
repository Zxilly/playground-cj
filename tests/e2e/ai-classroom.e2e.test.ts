import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Locator, Page } from 'playwright'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { encodePersistedClassroomRecord } from '@/lib/ai/classroom/persisted-record'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { startNextDevServer } from '../helpers/next-dev-server'

const DEFAULT_VIEWPORT = { width: 1280, height: 900 } as const
const BACKEND_RUN_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://cj-api.learningman.top'}/run`

async function resetAIClassroomBrowserState(page: Page, serverUrl: string) {
  await page.setViewportSize(DEFAULT_VIEWPORT)
  await page.goto(`${serverUrl}/zh`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    localStorage.clear()
    const deleteResult = await new Promise<'deleted' | 'blocked' | 'error'>((resolve) => {
      const request = indexedDB.deleteDatabase('tour-ai-classroom')
      request.onsuccess = () => resolve('deleted')
      request.onerror = () => resolve('error')
      request.onblocked = () => resolve('blocked')
    })
    if (deleteResult === 'deleted')
      return
    await new Promise<void>((resolve) => {
      const request = indexedDB.open('tour-ai-classroom', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('sessions'))
          db.createObjectStore('sessions', { keyPath: 'key' })
      }
      request.onerror = () => resolve()
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('sessions')) {
          db.close()
          resolve()
          return
        }
        const transaction = db.transaction('sessions', 'readwrite')
        transaction.objectStore('sessions').clear()
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          db.close()
          resolve()
        }
        transaction.onabort = () => {
          db.close()
          resolve()
        }
      }
    })
  })
}

async function saveIncompleteUserLLMConfig(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('tour-ai:config', JSON.stringify({
      state: {
        config: {
          provider: 'openai-compatible',
          baseURL: 'https://api.example.test/v1',
          apiKey: '',
          model: 'test-model',
        },
        keySource: 'user',
      },
      version: 0,
    }))
  })
}

async function saveCompleteUserLLMConfig(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('tour-ai:config', JSON.stringify({
      state: {
        config: {
          provider: 'openai-compatible',
          baseURL: 'https://api.example.test/v1',
          apiKey: 'user-key',
          model: 'test-model',
        },
        keySource: 'user',
      },
      version: 0,
    }))
  })
}

function createActivePrintExerciseSession(starterCode = 'main() {\n    // TODO\n}'): ClassroomSession {
  return classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '1',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '在 main 中用 println 输出 Cangjie。',
      starterCode,
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
    },
    now: 1001,
  })
}

function createCompletedPrintExerciseSession(): ClassroomSession {
  let session = createActivePrintExerciseSession()
  session = classroomReducer(session, { type: 'EXERCISE_SUCCESS', now: 1002 })
  return session
}

function createRetainedReviewNoteSession(): ClassroomSession {
  let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.program.main',
    blockIds: ['cj.program.main.heading'],
    now: 1001,
  })
  session = classroomReducer(session, {
    type: 'SAVE_REVIEW_ARTIFACT',
    artifact: {
      artifactId: 'main-note',
      kind: 'clarification',
      conceptId: 'cj.program.main',
      title: 'main 入口提醒',
      body: '个人笔记：main 入口必须保留到复习页。',
      summary: '记住 main 入口复习笔记',
      evidenceIds: [],
    },
    emitMarker: false,
    now: 1002,
  })
  return session
}

async function savePersistedClassroomSession(page: Page, session: ClassroomSession): Promise<string> {
  const record = encodePersistedClassroomRecord(session, 1003)
  await page.evaluate(async (nextRecord) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('tour-ai-classroom', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('sessions'))
          db.createObjectStore('sessions', { keyPath: 'key' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('sessions', 'readwrite')
        transaction.objectStore('sessions').put(nextRecord)
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          const error = transaction.error
          db.close()
          reject(error)
        }
        transaction.onabort = () => {
          const error = transaction.error
          db.close()
          reject(error)
        }
      }
    })
  }, record)
  return record.key
}

async function readPersistedReviewArtifactRemovalState(page: Page, recordKey: string, artifactId: string): Promise<boolean | null> {
  return page.evaluate(async (target) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tour-ai-classroom', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      const record = await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction('sessions', 'readonly')
        const request = transaction.objectStore('sessions').get(target.recordKey)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      if (typeof record !== 'object' || record === null)
        return null
      const session = (record as { session?: unknown }).session
      if (typeof session !== 'object' || session === null)
        return null
      const learner = (session as { learner?: unknown }).learner
      if (typeof learner !== 'object' || learner === null)
        return null
      const artifacts = (learner as { reviewArtifacts?: unknown }).reviewArtifacts
      if (!Array.isArray(artifacts))
        return null
      const artifact = artifacts.find((item) => {
        if (typeof item !== 'object' || item === null)
          return false
        return (item as { artifactId?: unknown }).artifactId === target.artifactId
      })
      if (typeof artifact !== 'object' || artifact === null)
        return null
      return 'removedAt' in artifact
    }
    finally {
      db.close()
    }
  }, { recordKey, artifactId })
}

async function waitForPersistedReviewArtifactRemoval(page: Page, recordKey: string, artifactId: string, removed: boolean) {
  const deadline = Date.now() + 5000
  let latest: boolean | null = null
  while (Date.now() < deadline) {
    latest = await readPersistedReviewArtifactRemovalState(page, recordKey, artifactId)
    if (latest === removed)
      return
    await page.waitForTimeout(50)
  }
  throw new Error(`Timed out waiting for review artifact removal=${removed}; latest=${latest}`)
}

async function describedByText(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
    return ids
      .map(id => document.getElementById(id)?.textContent ?? '')
      .join(' ')
  })
}

async function readPersistedClassroomSummary(page: Page, recordKey: string) {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tour-ai-classroom', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      const record = await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction('sessions', 'readonly')
        const request = transaction.objectStore('sessions').get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const session = typeof record === 'object' && record !== null
        ? (record as { session?: unknown }).session
        : null
      if (typeof session !== 'object' || session === null) {
        return {
          currentExerciseId: null,
          currentExerciseStatus: null,
          eventQueueLength: -1,
          eventTypes: [],
          lastRunAttemptMode: null,
          lastRunOk: null,
          terminalEventExerciseIds: [],
          evidenceCount: -1,
          evidenceExerciseIds: [],
          evidenceOutcomes: [],
          evidenceStrengths: [],
          failureEventActualOutputs: [],
          failureEventSummaries: [],
          reviewArtifactCount: -1,
          streamExerciseIds: [],
          streamExerciseStatuses: [],
        }
      }

      const learner = (session as { learner?: unknown }).learner
      const eventQueue = (session as { eventQueue?: unknown }).eventQueue
      const currentExercise = (session as { currentExercise?: unknown }).currentExercise
      const lastRun = (session as { lastRun?: unknown }).lastRun
      const stream = (session as { stream?: unknown }).stream
      const evidence = typeof learner === 'object' && learner !== null
        ? (learner as { evidence?: unknown }).evidence
        : null
      const reviewArtifacts = typeof learner === 'object' && learner !== null
        ? (learner as { reviewArtifacts?: unknown }).reviewArtifacts
        : null

      return {
        currentExerciseId: typeof currentExercise === 'object' && currentExercise !== null
          ? (currentExercise as { id?: unknown }).id
          : null,
        currentExerciseStatus: typeof currentExercise === 'object' && currentExercise !== null
          ? (currentExercise as { status?: unknown }).status
          : null,
        eventQueueLength: Array.isArray(eventQueue) ? eventQueue.length : -1,
        eventTypes: Array.isArray(eventQueue)
          ? eventQueue.map((item) => {
              if (typeof item !== 'object' || item === null)
                return ''
              const type = (item as { type?: unknown }).type
              return typeof type === 'string' ? type : ''
            })
          : [],
        lastRunAttemptMode: typeof lastRun === 'object' && lastRun !== null
          ? (lastRun as { attemptMode?: unknown }).attemptMode
          : null,
        lastRunOk: typeof lastRun === 'object' && lastRun !== null
          ? (lastRun as { ok?: unknown }).ok
          : null,
        terminalEventExerciseIds: Array.isArray(eventQueue)
          ? eventQueue
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                const type = (item as { type?: unknown }).type
                if (type !== 'exercise_success' && type !== 'exercise_skip')
                  return null
                const exerciseInstanceId = (item as { exerciseInstanceId?: unknown }).exerciseInstanceId
                return typeof exerciseInstanceId === 'string' ? exerciseInstanceId : null
              })
              .filter((exerciseInstanceId): exerciseInstanceId is string => exerciseInstanceId != null)
          : [],
        evidenceCount: Array.isArray(evidence) ? evidence.length : -1,
        evidenceExerciseIds: Array.isArray(evidence)
          ? evidence
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                const exerciseInstanceId = (item as { exerciseInstanceId?: unknown }).exerciseInstanceId
                return typeof exerciseInstanceId === 'string' ? exerciseInstanceId : null
              })
              .filter((exerciseInstanceId): exerciseInstanceId is string => exerciseInstanceId != null)
          : [],
        evidenceOutcomes: Array.isArray(evidence)
          ? evidence
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                const outcome = (item as { outcome?: unknown }).outcome
                return typeof outcome === 'string' ? outcome : null
              })
              .filter((outcome): outcome is string => outcome != null)
          : [],
        evidenceStrengths: Array.isArray(evidence)
          ? evidence
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                const strength = (item as { strength?: unknown }).strength
                return typeof strength === 'string' ? strength : null
              })
              .filter((strength): strength is string => strength != null)
          : [],
        failureEventActualOutputs: Array.isArray(eventQueue)
          ? eventQueue
              .map((item) => {
                if (typeof item !== 'object' || item === null || (item as { type?: unknown }).type !== 'exercise_failure')
                  return null
                const actualOutput = (item as { actualOutput?: unknown }).actualOutput
                return typeof actualOutput === 'string' ? actualOutput : null
              })
              .filter((actualOutput): actualOutput is string => actualOutput != null)
          : [],
        failureEventSummaries: Array.isArray(eventQueue)
          ? eventQueue
              .map((item) => {
                if (typeof item !== 'object' || item === null || (item as { type?: unknown }).type !== 'exercise_failure')
                  return null
                const summary = (item as { summary?: unknown }).summary
                return typeof summary === 'string' ? summary : null
              })
              .filter((summary): summary is string => summary != null)
          : [],
        reviewArtifactCount: Array.isArray(reviewArtifacts) ? reviewArtifacts.length : -1,
        streamExerciseIds: Array.isArray(stream)
          ? stream
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                if ((item as { type?: unknown }).type !== 'exercise_instance')
                  return null
                const exercise = (item as { exercise?: unknown }).exercise
                if (typeof exercise !== 'object' || exercise === null)
                  return null
                const id = (exercise as { id?: unknown }).id
                return typeof id === 'string' ? id : null
              })
              .filter((id): id is string => id != null)
          : [],
        streamExerciseStatuses: Array.isArray(stream)
          ? stream
              .map((item) => {
                if (typeof item !== 'object' || item === null)
                  return null
                if ((item as { type?: unknown }).type !== 'exercise_instance')
                  return null
                const exercise = (item as { exercise?: unknown }).exercise
                if (typeof exercise !== 'object' || exercise === null)
                  return null
                const status = (exercise as { status?: unknown }).status
                return typeof status === 'string' ? status : null
              })
              .filter((status): status is string => status != null)
          : [],
      }
    }
    finally {
      db.close()
    }
  }, recordKey)
}

type PersistedClassroomSummary = Awaited<ReturnType<typeof readPersistedClassroomSummary>>

async function waitForPersistedClassroomSummary(
  page: Page,
  recordKey: string,
  predicate: (summary: PersistedClassroomSummary) => boolean,
  description: string,
): Promise<PersistedClassroomSummary> {
  const deadline = Date.now() + 5000
  let latest = await readPersistedClassroomSummary(page, recordKey)
  while (Date.now() < deadline) {
    if (predicate(latest))
      return latest
    await page.waitForTimeout(50)
    latest = await readPersistedClassroomSummary(page, recordKey)
  }
  throw new Error(`Timed out waiting for ${description}. Latest persisted summary: ${JSON.stringify(latest)}`)
}

describe('ai classroom e2e', () => {
  let server: Awaited<ReturnType<typeof startNextDevServer>>
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await startNextDevServer()
    browser = await chromium.launch({ headless: true })
  }, 120_000)

  beforeEach(async () => {
    page = await browser.newPage({ viewport: DEFAULT_VIEWPORT })
    await page.unroute(BACKEND_RUN_URL)
    await resetAIClassroomBrowserState(page, server.url)
  }, 120_000)

  afterEach(async () => {
    if (page && !page.isClosed())
      await page.close()
  })

  afterAll(async () => {
    await browser?.close()
    await server?.stop()
  })

  it('opens from a validated tour topic with a matching source tutorial link', async () => {
    await page.goto(`${server.url}/zh/tour/ai?topic=cj.program.main`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: '从当前主题开始学习' }).waitFor({ state: 'visible' })

    const sourceLink = page.getByRole('link', { name: '查看对应教程' })
    expect(await sourceLink.getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(await sourceLink.getAttribute('title')).toBe('打开对应静态教程；不会改变 AI 课堂进度。')
  }, 120_000)

  it('previews validated course content on mobile without starting the classroom', async () => {
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai?topic=cj.program.main`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '先预览课程内容' }).click()

    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    await page.getByText('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。').waitFor({ state: 'visible' })
    expect(await page.getByRole('button', { name: '开始 AI 课堂' }).count()).toBeGreaterThan(0)
    expect(await page.getByTestId('ai-classroom-header').getByText('开始课堂', { exact: true }).isVisible()).toBe(true)
    expect(await page.getByText('个人笔记', { exact: true }).isVisible()).toBe(true)
    expect(await page.getByTestId('classroom-review-concept-rail').isVisible()).toBe(true)

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('returns from AI service settings to a startable landing state', async () => {
    await saveIncompleteUserLLMConfig(page)
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByTestId('classroom-landing-primary').click()

    await page.getByRole('heading', { name: 'AI 服务设置' }).waitFor({ state: 'visible' })
    await page.getByLabel('API Key').fill('user-key')
    await page.getByRole('button', { name: '保存' }).click()

    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '开始 AI 课堂' }).waitFor({ state: 'visible' })
    expect(await page.getByRole('button', { name: '配置 AI 服务开始' }).count()).toBe(0)

    const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('tour-ai:config') ?? 'null'))
    expect(savedConfig.state.keySource).toBe('user')
    expect(savedConfig.state.config.apiKey).toBe('user-key')
    expect(savedConfig.state.config.model).toBe('test-model')
  }, 120_000)

  it('moves from preview to AI service setup on mobile without starting generation', async () => {
    await saveIncompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai?topic=cj.var.immutable`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '先预览课程内容' }).click()

    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: '不可变绑定 let' }).first().waitFor({ state: 'visible' })
    await page.getByTestId('ai-classroom-header').getByRole('button', { name: '开始 AI 课堂' }).click()

    const welcome = page.getByTestId('classroom-welcome-card')
    await welcome.waitFor({ state: 'visible' })
    await welcome.getByText('完成服务地址、API Key 和模型配置后即可开始。').waitFor({ state: 'visible' })
    expect(await page.getByText('正在准备课堂内容；完成后会显示第一步讲解或练习。').count()).toBe(0)

    const chat = page.getByRole('button', { name: '打开聊天' })
    expect(await chat.isDisabled()).toBe(true)
    expect(await chat.getAttribute('title')).toBe('请先完成 AI 服务配置；课堂准备完成后再打开聊天。')

    await welcome.getByRole('button', { name: '配置 AI 服务开始' }).click()
    await page.getByRole('heading', { name: 'AI 服务设置' }).waitFor({ state: 'visible' })

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('continues a saved classroom on mobile while AI service setup is incomplete', async () => {
    await savePersistedClassroomSession(page, createCompletedPrintExerciseSession())
    await saveIncompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).waitFor({ state: 'visible' })
    await page.getByText('AI 服务配置未完成，已保存的课堂仍可查看。').waitFor({ state: 'visible' })
    await page.getByText('继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要先配置可用服务。').waitFor({ state: 'visible' })

    await page.getByTestId('classroom-landing-primary').click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })
    await page.getByText('在 main 中用 println 输出 Cangjie。').waitFor({ state: 'visible' })

    await page.getByRole('tab', { name: '复习' }).click()
    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    await page.getByText('标准输出 println').first().waitFor({ state: 'visible' })

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('continues a saved active exercise on mobile with the editor ready', async () => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error')
        consoleErrors.push(message.text())
    })

    await savePersistedClassroomSession(page, createActivePrintExerciseSession())
    await saveIncompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })
    await page.getByText('在 main 中用 println 输出 Cangjie。').waitFor({ state: 'visible' })

    await page.locator('[data-tour-editor-root] .monaco-editor').waitFor({ state: 'visible', timeout: 60_000 })
    const run = page.getByRole('button', { name: '运行' })
    await run.waitFor({ state: 'visible' })
    expect(await run.isEnabled()).toBe(true)
    expect(await page.getByText('练习编辑器仍在加载，加载完成后才能运行代码。').count()).toBe(0)

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
    expect(consoleErrors.filter(error => /monaco-vscode-api|Services are already initialized|Editor initialization failed/i.test(error))).toEqual([])
  }, 120_000)

  it('runs without recording evidence, then submits and persists learning evidence', async () => {
    const runRequests: string[] = []
    await page.route(BACKEND_RUN_URL, async (route) => {
      runRequests.push(route.request().postData() ?? '')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          compiler_output: '',
          compiler_code: 0,
          bin_output: 'Cangjie',
          bin_code: 0,
        }),
      })
    })

    const persistedKey = await savePersistedClassroomSession(
      page,
      createActivePrintExerciseSession('main() {\n    println("Cangjie")\n}'),
    )
    await saveIncompleteUserLLMConfig(page)
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('exercise-practice-card').waitFor({ state: 'visible' })
    await page.locator('[data-tour-editor-root] .monaco-editor').waitFor({ state: 'visible', timeout: 60_000 })

    const beforeRun = await readPersistedClassroomSummary(page, persistedKey)
    expect(beforeRun.currentExerciseStatus).toBe('active')
    expect(beforeRun.evidenceCount).toBe(0)
    expect(beforeRun.eventTypes).not.toContain('exercise_success')

    await page.getByRole('button', { name: '运行' }).click()
    await page.getByText('运行结果：正确').waitFor({ state: 'visible' })
    await page.getByText('运行结果正确。点击提交后，课堂才会记录这次练习进度。').waitFor({ state: 'visible' })
    const afterRun = await waitForPersistedClassroomSummary(
      page,
      persistedKey,
      summary => summary.lastRunAttemptMode === 'run' && summary.lastRunOk === true,
      'run result to persist',
    )
    expect(afterRun.evidenceCount).toBe(0)
    expect(afterRun.eventTypes).not.toContain('exercise_success')
    expect(afterRun.currentExerciseStatus).toBe('active')

    await page.getByRole('button', { name: '提交并记录' }).click()
    await page.getByText('提交结果：正确').waitFor({ state: 'visible' })
    const afterSubmit = await waitForPersistedClassroomSummary(
      page,
      persistedKey,
      summary => summary.lastRunAttemptMode === 'submit'
        && summary.evidenceCount === 1
        && summary.currentExerciseStatus === 'success'
        && summary.eventTypes.includes('exercise_success'),
      'submit evidence to persist',
    )
    expect(afterSubmit).toEqual(expect.objectContaining({
      currentExerciseStatus: 'success',
      evidenceCount: 1,
      eventTypes: expect.arrayContaining(['exercise_success']),
      streamExerciseStatuses: expect.arrayContaining(['success']),
    }))
    expect(runRequests).toHaveLength(2)
    expect(runRequests[0]).toContain('println("Cangjie")')
    expect(runRequests[1]).toContain('println("Cangjie")')
  }, 120_000)

  it('runs failed attempts without recording evidence, then submits and queues remediation evidence', async () => {
    const runRequests: string[] = []
    await page.route(BACKEND_RUN_URL, async (route) => {
      runRequests.push(route.request().postData() ?? '')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          compiler_output: '',
          compiler_code: 0,
          bin_output: 'Wrong output',
          bin_code: 0,
        }),
      })
    })

    const persistedKey = await savePersistedClassroomSession(
      page,
      createActivePrintExerciseSession('main() {\n    println("Wrong output")\n}'),
    )
    await saveIncompleteUserLLMConfig(page)
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('exercise-practice-card').waitFor({ state: 'visible' })
    await page.locator('[data-tour-editor-root] .monaco-editor').waitFor({ state: 'visible', timeout: 60_000 })

    const beforeRun = await readPersistedClassroomSummary(page, persistedKey)
    expect(beforeRun.currentExerciseStatus).toBe('active')
    expect(beforeRun.evidenceCount).toBe(0)
    expect(beforeRun.eventTypes).not.toContain('exercise_failure')

    await page.getByRole('button', { name: '运行' }).click()
    await page.getByText('运行结果：错误').waitFor({ state: 'visible' })
    await page.getByText('运行结果未通过，这次不会记录为练习进度。可以先查看结果和编译信息，修改后再运行或提交。').waitFor({ state: 'visible' })
    const afterRun = await waitForPersistedClassroomSummary(
      page,
      persistedKey,
      summary => summary.lastRunAttemptMode === 'run' && summary.lastRunOk === true,
      'failed run result to persist',
    )
    expect(afterRun.evidenceCount).toBe(0)
    expect(afterRun.eventTypes).not.toContain('exercise_failure')
    expect(afterRun.currentExerciseStatus).toBe('active')

    await page.getByTestId('exercise-action-bar').getByRole('button', { name: '提交' }).click()
    await page.getByText('提交结果：错误').waitFor({ state: 'visible' })
    await page.getByText('这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。').waitFor({ state: 'visible' })
    const afterSubmit = await waitForPersistedClassroomSummary(
      page,
      persistedKey,
      summary => summary.lastRunAttemptMode === 'submit'
        && summary.evidenceCount === 1
        && summary.currentExerciseStatus === 'active'
        && summary.eventTypes.includes('exercise_failure'),
      'failed submit evidence to persist',
    )
    expect(afterSubmit).toEqual(expect.objectContaining({
      currentExerciseStatus: 'active',
      evidenceCount: 1,
      eventTypes: expect.arrayContaining(['exercise_failure']),
      evidenceOutcomes: ['failure'],
      evidenceStrengths: ['independent'],
      failureEventActualOutputs: ['Wrong output'],
    }))
    expect(afterSubmit.failureEventSummaries[0]).toContain('输出与预期不一致')
    expect(afterSubmit.streamExerciseStatuses).toEqual(['active'])
    expect(runRequests).toHaveLength(2)
    expect(runRequests[0]).toContain('println("Wrong output")')
    expect(runRequests[1]).toContain('println("Wrong output")')
  }, 120_000)

  it('opens AI service settings from mobile review actions without queueing work', async () => {
    const persistedKey = await savePersistedClassroomSession(page, createRetainedReviewNoteSession())
    await saveIncompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })
    await page.getByRole('tab', { name: '复习' }).click()
    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: 'main 入口提醒' }).waitFor({ state: 'visible' })

    const beforeAction = await readPersistedClassroomSummary(page, persistedKey)
    expect(beforeAction.eventTypes).not.toContain('chat_intent')
    expect(beforeAction.evidenceCount).toBe(0)
    expect(beforeAction.reviewArtifactCount).toBe(1)

    const configure = page.getByRole('button', { name: '配置 AI 服务' })
    await configure.waitFor({ state: 'visible' })
    expect(await describedByText(configure)).toContain('完成 AI 服务配置后再')
    expect(await configure.getAttribute('title')).toContain('完成 AI 服务配置后再')

    await configure.click()

    await page.getByRole('heading', { name: 'AI 服务设置' }).waitFor({ state: 'visible' })
    expect(await page.getByTestId('lesson-generation-progress-panel').count()).toBe(0)
    const afterAction = await readPersistedClassroomSummary(page, persistedKey)
    expect(afterAction).toEqual(beforeAction)

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('explains derived learning progress on mobile', async () => {
    await savePersistedClassroomSession(page, createCompletedPrintExerciseSession())
    await saveCompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })

    const progress = page.getByTestId('classroom-concept-panel-trigger')
    await progress.waitFor({ state: 'visible' })
    expect(await progress.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 1 / 1 个接触过的概念')
    expect(await progress.getAttribute('title')).toBe('打开学习进度面板；已证明或掌握 1 / 1 个接触过的概念。')
    await progress.click()

    const panel = page.getByTestId('classroom-concept-panel-content')
    await panel.waitFor({ state: 'visible' })
    await panel.getByText('学习进度', { exact: true }).waitFor({ state: 'visible' })
    await panel.getByText('进度来自已看内容、练习提交和复习检查；AI 只能记录观察，不能直接判定掌握。').waitFor({ state: 'visible' })
    await panel.getByText('已证明或掌握 1 个概念 / 接触过 1 个').waitFor({ state: 'visible' })
    await panel.getByText('标准输出 println').waitFor({ state: 'visible' })
    await panel.getByText('最近一次练习已通过，进度来自练习提交。').waitFor({ state: 'visible' })

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('opens review-scoped chat on mobile without changing progress or adding queued classroom work', async () => {
    const persistedKey = await savePersistedClassroomSession(page, createCompletedPrintExerciseSession())
    await saveCompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })

    const progress = page.getByTestId('classroom-concept-panel-trigger')
    await progress.waitFor({ state: 'visible' })
    expect(await progress.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 1 / 1 个接触过的概念')

    await page.getByRole('tab', { name: '复习' }).click()
    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    const reviewChat = page.getByRole('button', { name: '围绕此概念聊天' })
    await reviewChat.waitFor({ state: 'visible' })
    expect(await reviewChat.getAttribute('title')).toBe('打开只围绕当前复习概念的聊天；不会改变复习进度或排队新的课堂内容。')
    const beforeChat = await readPersistedClassroomSummary(page, persistedKey)
    expect(beforeChat.evidenceCount).toBe(1)
    expect(beforeChat.reviewArtifactCount).toBe(0)
    expect(beforeChat.eventTypes).not.toContain('chat_intent')

    await reviewChat.click()

    const sidebar = page.getByTestId('classroom-chat-sidebar')
    await sidebar.waitFor({ state: 'visible' })
    expect(await describedByText(sidebar)).toBe('聊天会优先围绕当前概念作为上下文；关闭浮层不会改变课堂进度。')
    await sidebar.getByText('围绕 标准输出 println 提问').waitFor({ state: 'visible' })
    expect(await describedByText(sidebar.getByRole('region', { name: '聊天' }))).toContain('聊天回答不会直接改变学习进度')

    const close = page.getByRole('button', { name: '关闭聊天' })
    expect(await close.getAttribute('title')).toBe('关闭聊天浮层；不会改变课堂进度、当前代码或已保存的课堂记录。')
    await close.click()
    await sidebar.waitFor({ state: 'detached' })

    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    expect(await progress.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 1 / 1 个接触过的概念')
    expect(await page.getByTestId('classroom-stream-chat-intent-marker').count()).toBe(0)

    const persisted = await readPersistedClassroomSummary(page, persistedKey)
    expect(persisted).toEqual(beforeChat)
    expect(persisted.eventTypes).not.toContain('chat_intent')

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('confirms before clearing a saved classroom and removes the persisted record', async () => {
    const persistedKey = await savePersistedClassroomSession(page, createCompletedPrintExerciseSession())
    await saveCompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).waitFor({ state: 'visible' })

    await page.getByTestId('classroom-landing-reset').click()
    await page.getByTestId('classroom-reset-confirmation').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '保留记录' }).click()
    await page.getByTestId('classroom-reset-confirmation').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '继续上次课堂' }).waitFor({ state: 'visible' })

    await page.getByTestId('classroom-landing-reset').click()
    await page.getByTestId('classroom-reset-confirmation').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '确认重新开始' }).click()

    await page.getByRole('button', { name: '开始 AI 课堂' }).waitFor({ state: 'visible' })
    expect(await page.getByRole('button', { name: '继续上次课堂' }).count()).toBe(0)
    expect(await page.getByTestId('classroom-landing-reset').count()).toBe(0)
    await page.waitForFunction(async (recordKey) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('tour-ai-classroom', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      try {
        return await new Promise<boolean>((resolve, reject) => {
          const transaction = db.transaction('sessions', 'readonly')
          const request = transaction.objectStore('sessions').get(recordKey)
          request.onsuccess = () => resolve(request.result == null)
          request.onerror = () => reject(request.error)
        })
      }
      finally {
        db.close()
      }
    }, persistedKey)
  }, 120_000)

  it('removes and restores retained review notes on mobile', async () => {
    const persistedKey = await savePersistedClassroomSession(page, createRetainedReviewNoteSession())
    await saveCompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('ai-classroom-content').waitFor({ state: 'visible' })
    await page.getByRole('tab', { name: '复习' }).click()

    await page.getByTestId('classroom-review-view').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: 'main 入口提醒' }).waitFor({ state: 'visible' })
    await page.getByText('个人笔记：main 入口必须保留到复习页。').waitFor({ state: 'visible' })

    const remove = page.getByRole('button', { name: '移除复习内容：main 入口提醒' })
    expect(await remove.getAttribute('title')).toBe('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')
    await remove.click()

    await page.getByRole('region', { name: '已移除复习内容。' }).waitFor({ state: 'visible' })
    await page.getByText('当前概念暂无个人笔记').waitFor({ state: 'visible' })
    await page.getByText('已移除的内容可以先撤销；上方教程内容和学习进度仍会保留。').waitFor({ state: 'visible' })
    expect(await page.getByText('个人笔记：main 入口必须保留到复习页。').count()).toBe(0)
    await waitForPersistedReviewArtifactRemoval(page, persistedKey, 'main-note', true)

    const undo = page.getByRole('button', { name: '撤销' })
    expect(await undo.getAttribute('title')).toBe('撤销移除，恢复这条复习内容；教程内容和学习进度一直保留。')
    await undo.click()

    await page.getByText('个人笔记：main 入口必须保留到复习页。').waitFor({ state: 'visible' })
    expect(await page.getByText('已移除复习内容。').count()).toBe(0)
    await waitForPersistedReviewArtifactRemoval(page, persistedKey, 'main-note', false)

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('confirms before skipping an active exercise on mobile and persists skip evidence', async () => {
    const persistedKey = await savePersistedClassroomSession(page, createActivePrintExerciseSession())
    await saveIncompleteUserLLMConfig(page)
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续上次课堂' }).click()
    await page.getByTestId('exercise-practice-card').waitFor({ state: 'visible' })
    await page.getByText('在 main 中用 println 输出 Cangjie。').waitFor({ state: 'visible' })

    const beforeSkip = await readPersistedClassroomSummary(page, persistedKey)
    expect(beforeSkip.currentExerciseStatus).toBe('active')
    expect(beforeSkip.evidenceCount).toBe(0)
    expect(beforeSkip.eventTypes).not.toContain('exercise_skip')

    const skip = page.getByTestId('exercise-action-bar').getByRole('button', { name: '跳过并记录' })
    await page.locator('[data-tour-editor-root] .monaco-editor').waitFor({ state: 'visible', timeout: 60_000 })
    await page.waitForFunction(() => {
      const actionBar = document.querySelector('[data-testid="exercise-action-bar"]')
      const button = [...(actionBar?.querySelectorAll('button') ?? [])]
        .find(element => element.textContent?.includes('跳过并记录')) as HTMLButtonElement | undefined
      return button != null
        && !button.disabled
        && button.getAttribute('title') === '会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。'
    })
    expect(await skip.getAttribute('title')).toBe('会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    await skip.click()

    await page.getByTestId('exercise-skip-confirmation').waitFor({ state: 'visible' })
    await page.getByText('确认跳过这道练习？').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '继续练习' }).click()
    await page.getByTestId('exercise-skip-confirmation').waitFor({ state: 'detached' })
    expect(await readPersistedClassroomSummary(page, persistedKey)).toEqual(beforeSkip)

    await skip.click()
    await page.getByTestId('exercise-skip-confirmation').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '确认跳过' }).click()
    await page.getByTestId('exercise-skip-confirmation').waitFor({ state: 'detached' })
    await page.getByTestId('exercise-practice-card').getByText('已跳过', { exact: true }).waitFor({ state: 'visible' })
    expect(await skip.isDisabled()).toBe(true)
    const afterSkip = await waitForPersistedClassroomSummary(
      page,
      persistedKey,
      summary => summary.evidenceCount === 1
        && summary.eventTypes.includes('exercise_skip')
        && summary.streamExerciseStatuses.includes('skip'),
      'skip evidence to persist',
    )
    expect(afterSkip).toEqual(expect.objectContaining({
      evidenceCount: 1,
      eventTypes: expect.arrayContaining(['exercise_skip']),
      streamExerciseStatuses: expect.arrayContaining(['skip']),
    }))

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)

  it('falls back safely when a topic deep link is not validated', async () => {
    await page.goto(`${server.url}/zh/tour/ai?topic=cj.unvalidated.topic`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: '从已验证课程开始学习' }).waitFor({ state: 'visible' })
    await page.getByText('链接里的主题不在已验证 AI 课堂内容中，已忽略该主题。').waitFor({ state: 'visible' })
    expect(await page.getByRole('link', { name: '查看对应教程' }).count()).toBe(0)
  }, 120_000)

  it('opens direct entry on mobile without inventing a current topic', async () => {
    await page.setViewportSize({ width: 390, height: 840 })
    await page.goto(`${server.url}/zh/tour/ai`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByTestId('classroom-landing-page').waitFor({ state: 'visible' })
    await page.getByRole('heading', { name: '从已验证课程开始学习' }).waitFor({ state: 'visible' })
    expect(await page.getByText('链接里的主题不在已验证 AI 课堂内容中，已忽略该主题。').isVisible()).toBe(false)
    expect(await page.getByRole('link', { name: '查看对应教程' }).count()).toBe(0)

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }, 120_000)
})
