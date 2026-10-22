import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, request } from 'playwright'
import type { Browser } from 'playwright'
import { compressToBase64 } from 'lz-string'
import { startNextDevServer } from '../helpers/next-dev-server'

describe('playground initial load', () => {
  let server: Awaited<ReturnType<typeof startNextDevServer>> | undefined
  let browser: Browser
  let baseUrl: string

  beforeAll(async () => {
    // Point at `next start` to also verify the production chunk boundaries.
    baseUrl = process.env.PLAYGROUND_TEST_URL ?? (server = await startNextDevServer()).url
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
      await page.goto(`${baseUrl}/${locale}`, { waitUntil: 'domcontentloaded' })
      expect(await page.locator('#header h1').isVisible()).toBe(true)
      expect(await page.locator('#panel-content').isVisible()).toBe(true)
      expect(await page.getByTestId('code-preview').isVisible()).toBe(true)
      expect(await page.getByTestId('code-preview').textContent()).toContain('main(): Int64')
      const editorBox = (await page.locator('#editor').boundingBox())!
      const outputBox = (await page.locator('#panel').boundingBox())!
      expect(editorBox.width).toBeGreaterThan(200)
      if (width >= 1024) {
        expect(outputBox.x).toBeGreaterThan(editorBox.x + editorBox.width)
        expect(outputBox.y).toBe(editorBox.y)
      }
      else {
        expect(outputBox.y).toBeGreaterThan(editorBox.y + editorBox.height)
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
      await page.getByRole('combobox', { name: locale === 'zh' ? '中文' : 'English', exact: true }).click()
      const languageOption = page.getByRole('option', { name: locale === 'zh' ? '中文' : 'English', exact: true })
      await languageOption.waitFor()
      await languageOption.click()
      await page.getByRole('button', { name: locale === 'zh' ? '分享' : 'Share', exact: true }).click()
      await page.getByRole('button', { name: locale === 'zh' ? '完整链接' : 'Full link', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      expect(await dialog.getByRole('textbox').inputValue()).toContain('#data=')
      expect(errors).toEqual([])
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
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('main(){println("hello")}')
      await page.getByRole('button', { name: '格式化', exact: true }).click()
      await expect.poll(() => page.locator('.monaco-editor .view-line').count(), { timeout: 30_000 }).toBeGreaterThan(1)
      await page.locator('.monaco-editor .view-lines').click({ button: 'right' })
      expect(await page.getByText('格式化文档', { exact: true }).isVisible()).toBe(true)
      expect(errors).toEqual([])
    }
    finally {
      await context.close()
    }
  }, 120_000)
})
