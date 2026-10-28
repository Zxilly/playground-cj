import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, request } from 'playwright'
import type { Browser } from 'playwright'
import { compressToBase64 } from 'lz-string'
import { startNextTestServer } from '../helpers/next-test-server'

describe('playground initial load', () => {
  let server: Awaited<ReturnType<typeof startNextTestServer>> | undefined
  let browser: Browser
  let baseUrl: string

  beforeAll(async () => {
    // Point at `next start` to also verify the production chunk boundaries.
    baseUrl = process.env.PLAYGROUND_TEST_URL ?? (server = await startNextTestServer()).url
    browser = await chromium.launch({ headless: true })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await server?.stop()
  })

  it.each([
    { locale: 'zh', width: 1440 },
    { locale: 'en', width: 390 },
  ])('renders the $locale shell at $width px before any JavaScript runs', async ({ locale, width }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } })
    try {
      const page = await context.newPage()
      // Remote CSS can finish after DOMContentLoaded when JavaScript is disabled.
      // Layout assertions need stylesheets, while the page still cannot hydrate.
      await page.goto(`${baseUrl}/${locale}`, { waitUntil: 'load' })
      expect(await page.locator('#header h1').isVisible()).toBe(true)
      expect(await page.locator('#panel-content').isVisible()).toBe(width >= 1024)
      expect(await page.getByTestId('editor-loading').isVisible()).toBe(true)
      expect(await page.getByTestId('editor-loading').getAttribute('aria-busy')).toBe('true')
      expect(await page.locator('#editor [data-slot="skeleton"]').first().isVisible()).toBe(true)
      expect(await page.locator('#editor pre, #editor code').count()).toBe(0)
      const editorBox = (await page.locator('#editor').boundingBox())!
      expect(editorBox.width).toBeGreaterThan(200)
      if (width >= 1024) {
        const outputBox = (await page.locator('#panel').boundingBox())!
        expect(outputBox.x).toBeGreaterThan(editorBox.x + editorBox.width)
        expect(outputBox.y).toBe(editorBox.y)
      }
      else {
        expect(await page.getByRole('tab', { name: 'Code', exact: true }).getAttribute('aria-selected')).toBe('true')
        expect(editorBox.height).toBeGreaterThan(450)
        expect(editorBox.width).toBeGreaterThan(width - 40)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(await page.locator('#editor [role="status"]').textContent())
        .toBe(locale === 'zh' ? '正在加载编辑器…' : 'Loading editor…')
      expect(await page.getByRole('button', { name: locale === 'zh' ? '运行' : 'Run', exact: true }).isDisabled()).toBe(true)
      expect(await page.locator('link[rel="preload"][as="font"][href*="HarmonyOS_Sans-s"]').count()).toBe(0)
    }
    finally {
      await context.close()
    }
  }, 120_000)

  it('includes the correct sibling tour link in the server HTML', async () => {
    const api = await request.newContext()
    try {
      const response = await api.get(`${baseUrl}/en`, {
        headers: { 'host': 'playground.cj.zxilly.dev', 'x-forwarded-proto': 'https' },
      })
      const html = await response.text()
      expect(html.includes('href="https://tour.cj.zxilly.dev/en"')).toBe(true)
    }
    finally {
      await api.dispose()
    }
  })

  it.each([
    { locale: 'zh', width: 1440 },
    { locale: 'en', width: 390 },
  ])('hydrates $locale at $width px and runs the shared code', async ({ locale, width }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    try {
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        const metrics = window as unknown as { loadShift: number }
        metrics.loadShift = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean, value: number }
            if (!shift.hadRecentInput)
              metrics.loadShift += shift.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      const fullFontRequests: string[] = []
      page.on('request', (request) => {
        if (/HarmonyOS_Sans(?:-s|\.woff2)/.test(request.url()))
          fullFontRequests.push(request.url())
      })
      const source = 'main() { println("shared-initial-source") }'
      const data = compressToBase64(source).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
      let submittedCode: string | undefined
      await page.route('**/api/run', async (route) => {
        submittedCode = route.request().postData() ?? undefined
        await route.fulfill({ json: {
          phase: 'run',
          compiler_code: 0,
          compiler_output: '',
          compiler_output_truncated: false,
          bin_code: 0,
          bin_stdout: 'shared-initial-source',
          bin_stdout_truncated: false,
          bin_stderr: '',
          bin_stderr_truncated: false,
        } })
      })
      await page.goto(`${baseUrl}/${locale}#data=${data}`, { waitUntil: 'domcontentloaded' })
      const run = page.getByRole('button', { name: locale === 'zh' ? '运行' : 'Run', exact: true })
      await expect.poll(() => run.isEnabled(), { timeout: 90_000 }).toBe(true)
      expect(await page.getByTestId('editor-loading').count()).toBe(0)
      expect(await page.locator('.monaco-editor .view-lines').textContent()).toContain('shared-initial-source')
      await page.evaluate(() => document.fonts.ready.then(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })))
      expect(await page.evaluate(() => (window as unknown as { loadShift: number }).loadShift)).toBeLessThan(0.01)
      await run.click()
      await expect.poll(() => submittedCode).toBe(source)
      await expect.poll(() => page.locator('#panel-content').textContent()).toContain('shared-initial-source')
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      expect(fullFontRequests).toEqual([])
      // A character outside the catalogs must load a bounded fallback shard.
      expect(await page.evaluate(async () => (await document.fonts.load('16px "HarmonyOS Sans Web"', '龘')).length)).toBeGreaterThan(0)
      expect(await page.evaluate(() => performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('.woff2'))
        .every(entry => (entry as PerformanceResourceTiming).decodedBodySize < 150_000))).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      // Exercise the deferred UI chunks and the current server-provided catalog.
      const languageTrigger = page.getByRole('combobox', { name: locale === 'zh' ? '中文' : 'English', exact: true })
      await languageTrigger.focus()
      await page.keyboard.press('Enter')
      const languageOption = page.getByRole('option', { name: locale === 'zh' ? '中文' : 'English', exact: true })
      await languageOption.waitFor()
      await page.keyboard.press('Escape')
      await expect.poll(() => languageTrigger.getAttribute('aria-expanded')).toBe('false')
      await expect.poll(() => languageTrigger.evaluate(element => element === document.activeElement)).toBe(true)
      await page.keyboard.press('Enter')
      await languageOption.click()
      await page.getByRole('button', { name: locale === 'zh' ? '分享' : 'Share', exact: true }).click()
      await page.getByRole('button', { name: locale === 'zh' ? '完整链接' : 'Full link', exact: true }).click()
      const dialog = page.getByRole('dialog').filter({ has: page.getByRole('textbox') })
      await dialog.waitFor()
      expect(await dialog.getByRole('textbox').inputValue()).toContain('#data=')
      expect(errors).toEqual([])
    }
    finally {
      await context.close()
    }
  }, 120_000)

  it('replaces the source with a selected example and restores the typed draft on undo', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const page = await context.newPage()
      const draft = 'main() { println("draft-before-example") }'
      let submittedCode: string | undefined
      await page.route('**/api/run', async (route) => {
        submittedCode = route.request().postData() ?? undefined
        await route.fulfill({ json: {
          phase: 'run',
          compiler_code: 0,
          compiler_output: '',
          compiler_output_truncated: false,
          bin_code: 0,
          bin_stdout: 'draft-before-example',
          bin_stdout_truncated: false,
          bin_stderr: '',
          bin_stderr_truncated: false,
        } })
      })
      await page.goto(`${baseUrl}/en`, { waitUntil: 'domcontentloaded' })
      const run = page.getByRole('button', { name: 'Run', exact: true })
      await expect.poll(() => run.isEnabled(), { timeout: 90_000 }).toBe(true)
      const editorLines = page.locator('.monaco-editor .view-lines')
      await editorLines.click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(draft)
      await expect.poll(() => editorLines.textContent()).toContain('draft-before-example')

      const examples = page.getByRole('combobox', { name: 'Select example', exact: true })
      await examples.click()
      await page.getByRole('option', { name: 'Array', exact: true }).click()
      await expect.poll(() => examples.getAttribute('aria-expanded')).toBe('false')
      await expect.poll(() => editorLines.textContent()).toContain('parse(text:')
      expect(await editorLines.textContent()).not.toContain('draft-before-example')

      await editorLines.click()
      await page.keyboard.press('ControlOrMeta+Z')
      await expect.poll(() => editorLines.textContent()).toContain('draft-before-example')
      await run.click()
      // Check the complete model through the existing Run action, not just the
      // currently rendered Monaco lines, which are virtualized for long samples.
      await expect.poll(() => submittedCode).toBe(draft)
    }
    finally {
      await context.close()
    }
  }, 120_000)

  it('keeps the mobile editor and undo history mounted while switching output views', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    try {
      const page = await context.newPage()
      const starterCode = (await readFile(new URL('../../src/examples/hello-world.cj', import.meta.url), 'utf8')).replaceAll('\r\n', '\n')
      let submittedCode: string | null = null
      await page.route('**/api/run', (route) => {
        submittedCode = route.request().postData()
        return route.fulfill({ json: {
          phase: 'compile',
          compiler_code: 1,
          compiler_output: 'main.cj:1:1: error: mobile diagnostic',
          compiler_output_truncated: false,
          bin_code: null,
          bin_stdout: '',
          bin_stdout_truncated: false,
          bin_stderr: '',
          bin_stderr_truncated: false,
        } })
      })
      await page.goto(`${baseUrl}/zh`, { waitUntil: 'domcontentloaded' })
      const run = page.getByRole('button', { name: '运行', exact: true })
      await expect.poll(() => run.isEnabled(), { timeout: 90_000 }).toBe(true)
      const editor = page.locator('#editor .monaco-editor')
      const mountedEditor = await editor.elementHandle()
      expect((await page.locator('#editor').boundingBox())!.width).toBeGreaterThan(350)
      const lines = editor.locator('.view-lines')
      const originalCode = await lines.textContent()
      await lines.locator('.view-line').first().click()
      await page.keyboard.press('ControlOrMeta+Home')
      // A word is one native undo transaction. Punctuation and a trailing
      // newline may create separate transactions in Chromium EditContext.
      await page.keyboard.insertText('mobileDraft')
      await expect.poll(() => lines.textContent()).toContain('mobileDraft')
      await page.getByRole('tab', { name: '输出', exact: true }).click()
      expect(await editor.isVisible()).toBe(false)
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      await page.getByRole('tab', { name: '代码', exact: true }).click()
      await expect.poll(() => lines.textContent()).toContain('mobileDraft')
      await lines.locator('.view-line').first().click()
      expect(await editor.evaluate(element => element.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('ControlOrMeta+Z')
      await page.keyboard.press('ControlOrMeta+Home')
      await expect.poll(() => lines.textContent()).toBe(originalCode)
      await run.click()
      await expect.poll(() => submittedCode).toBe(starterCode)
      await page.getByText('main.cj:1:1: error: mobile diagnostic').waitFor({ state: 'visible' })
      expect(await page.getByRole('tab', { name: '输出', exact: true }).getAttribute('aria-selected')).toBe('true')
      expect(await page.getByRole('tab', { name: '编译信息', exact: true }).getAttribute('aria-selected')).toBe('true')
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      await page.getByRole('combobox', { name: '选择示例', exact: true }).click()
      await page.getByRole('option', { name: '数组', exact: true }).click()
      await expect.poll(() => page.getByRole('tab', { name: '代码', exact: true }).getAttribute('aria-selected')).toBe('true')
      await expect.poll(() => lines.textContent()).toContain('parse(text:')
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      await lines.click()
      await page.keyboard.press('ControlOrMeta+Z')
      await expect.poll(() => lines.textContent()).not.toContain('parse(text:')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    finally {
      await context.close()
    }
  }, 120_000)

  it('connects the deferred language client and preserves formatting and Chinese menus', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${baseUrl}/zh`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: '代码提示已就绪', exact: true }).waitFor({ timeout: 90_000 })
      await page.locator('.monaco-editor .view-lines').click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('main() { let value: Int64 = "wrong" }')
      await page.locator('.monaco-editor .squiggly-error').first().waitFor({ timeout: 20_000 })
      const startup = await page.evaluate(() => ({
        editor: performance.getEntriesByName('cj:editor:ready')[0]?.startTime,
        host: performance.getEntriesByName('cj:editor:extension-host-start')[0]?.startTime,
      }))
      expect(startup.host).toBeGreaterThan(startup.editor!)
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('main() {\n    let localValue: Int64 = 1\n    localV\n}')
      await page.keyboard.press('ArrowUp')
      await page.keyboard.press('End')
      await page.keyboard.press('Control+Space')
      await page.locator('.suggest-widget .monaco-list-row').filter({ hasText: 'localValue' }).first().waitFor({ timeout: 20_000 })
      await page.keyboard.press('Escape')
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('main(){println("hello")}')
      await page.getByRole('button', { name: '格式化', exact: true }).click()
      await expect.poll(() => page.locator('.monaco-editor .view-line').count(), { timeout: 30_000 }).toBeGreaterThan(1)
      await page.locator('.monaco-editor .view-lines').click({ button: 'right' })
      expect(await page.getByText('格式化文档', { exact: true }).isVisible()).toBe(true)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: '代码提示已就绪', exact: true }).click()
      await page.getByRole('button', { name: '停止', exact: true }).click()
      await page.getByRole('button', { name: '代码提示已手动停止', exact: true }).click()
      await page.getByRole('button', { name: '启动', exact: true }).click()
      await page.getByRole('button', { name: '代码提示已就绪', exact: true }).waitFor({ timeout: 90_000 })
      await page.locator('.monaco-editor .view-lines').click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('main() { let restarted: Int64 = "wrong" }')
      await page.locator('.monaco-editor .squiggly-error').first().waitFor({ timeout: 20_000 })
      expect(errors).toEqual([])
    }
    finally {
      await context.close()
    }
  }, 120_000)
})
