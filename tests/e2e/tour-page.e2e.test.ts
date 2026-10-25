import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page, Route } from 'playwright'
import { startNextDevServer } from '../helpers/next-dev-server'

describe('tour page e2e', () => {
  let server: Awaited<ReturnType<typeof startNextDevServer>> | undefined
  let baseUrl: string
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    baseUrl = process.env.PLAYGROUND_TEST_URL ?? (server = await startNextDevServer()).url
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  }, 120_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.stop()
  })

  it('keeps lesson content in sync with next, browser Back and Forward, and editor keyboard input', async () => {
    await page.goto(`${baseUrl}/zh/tour/welcome/1`, {
      waitUntil: 'domcontentloaded',
    })

    await page.getByRole('heading', { name: 'Hello, 世界' }).waitFor({ state: 'visible' })
    expect(await page.getByText('欢迎来到').isVisible()).toBe(true)
    expect(await page.getByRole('link', { name: 'Playground' }).isVisible()).toBe(true)

    const previous = page.getByRole('button', { name: /上一页/ })
    const next = page.getByRole('button', { name: /下一页/ })
    expect(await previous.isDisabled()).toBe(true)
    expect(await next.isEnabled()).toBe(true)
    expect(await page.getByText(/1\s*\/\s*\d+/).isVisible()).toBe(true)

    await expect.poll(() => page.getByRole('button', { name: '运行', exact: true }).isEnabled(), { timeout: 90_000 }).toBe(true)
    const editor = page.locator('#tour-code-panel .monaco-editor')
    const editorCode = editor.locator('.view-lines')
    expect(await editorCode.textContent()).toMatch(/let\s+greeting/)
    await editorCode.click()
    await expect.poll(() => editor.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('PageDown')
    expect(new URL(page.url()).pathname).toBe('/zh/tour/welcome/1')
    expect(await page.getByRole('heading', { name: 'Hello, 世界', exact: true }).isVisible()).toBe(true)

    await next.click()
    await page.waitForURL(url => url.pathname === '/zh/tour/welcome/2')
    await page.getByRole('heading', { name: '已知语言', exact: true }).waitFor({ state: 'visible' })
    await expect.poll(() => editorCode.textContent()).toMatch(/let\s+language/)

    await expect.poll(() => page.getByRole('button', { name: /上一页/ }).isEnabled()).toBe(true)
    await expect.poll(() => page.getByText(/2\s*\/\s*\d+/).isVisible()).toBe(true)

    await page.goBack()
    await page.waitForURL(url => url.pathname === '/zh/tour/welcome/1')
    await page.getByRole('heading', { name: 'Hello, 世界', exact: true }).waitFor({ state: 'visible' })
    await expect.poll(() => editorCode.textContent()).toMatch(/let\s+greeting/)
    expect(await previous.isDisabled()).toBe(true)

    await page.goForward()
    await page.waitForURL(url => url.pathname === '/zh/tour/welcome/2')
    await page.getByRole('heading', { name: '已知语言', exact: true }).waitFor({ state: 'visible' })
    await expect.poll(() => editorCode.textContent()).toMatch(/let\s+language/)
    expect(await previous.isEnabled()).toBe(true)
  }, 120_000)

  it('closes the mobile table of contents after choosing a lesson', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/zh/tour/welcome/1`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Hello, 世界', exact: true }).waitFor({ state: 'visible' })

    await page.getByRole('button', { name: '切换侧边栏', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: '侧边栏', exact: true })
    await drawer.waitFor({ state: 'visible' })
    await drawer.getByRole('button', { name: '已知语言', exact: true }).click()

    await drawer.waitFor({ state: 'hidden' })
    await page.waitForURL(url => url.pathname === '/zh/tour/welcome/2')
    await page.getByRole('heading', { name: '已知语言', exact: true }).waitFor({ state: 'visible' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }, 120_000)

  it('keeps the mobile code draft mounted and remembers its collapsed state across lessons and viewport changes', async () => {
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    try {
      await mobilePage.route('**/api/run', route => route.fulfill({ json: {
        phase: 'run',
        compiler_code: 0,
        compiler_output: '',
        compiler_output_truncated: false,
        bin_code: 0,
        bin_stdout: 'mobile-output-kept',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
      } }))
      await mobilePage.goto(`${baseUrl}/zh/tour/welcome/1`, { waitUntil: 'domcontentloaded' })
      await mobilePage.getByRole('heading', { name: 'Hello, 世界', exact: true }).waitFor({ state: 'visible' })
      const toggle = mobilePage.locator('button[aria-controls="tour-editor-content"]')
      const editorContent = mobilePage.locator('#tour-editor-content')
      const lessonPanel = mobilePage.locator('#tour-content-panel')
      const next = mobilePage.getByRole('button', { name: /下一页/ })
      expect(await mobilePage.getByRole('button', { name: '收起代码', exact: true }).isVisible()).toBe(true)
      expect(await toggle.getAttribute('aria-expanded')).toBe('true')
      await expect.poll(() => mobilePage.getByRole('button', { name: '运行', exact: true }).isEnabled(), { timeout: 90_000 }).toBe(true)
      await mobilePage.getByRole('button', { name: '运行', exact: true }).click()
      await mobilePage.getByText(/mobile-output-kept/).waitFor({ state: 'visible' })

      const editor = editorContent.locator('#tour-code-panel .monaco-editor')
      const editorLines = editor.locator('.view-lines')
      const mountedEditor = await editor.elementHandle()
      const mountedPanel = await mobilePage.locator('#tour-editor-panel').elementHandle()
      await editorLines.locator('.view-line').first().click()
      await mobilePage.keyboard.press('ControlOrMeta+Home')
      await mobilePage.keyboard.insertText('// mobile-draft-kept\n')
      await expect.poll(() => editorLines.textContent()).toContain('mobile-draft-kept')
      const expandedLessonHeight = (await lessonPanel.boundingBox())!.height

      await toggle.click()
      await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('false')
      expect(await mobilePage.getByRole('button', { name: '展开代码', exact: true }).isEnabled()).toBe(true)
      expect(await editorContent.getAttribute('aria-hidden')).toBe('true')
      expect(await editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(true)
      await expect.poll(async () => (await lessonPanel.boundingBox())!.height).toBeGreaterThan(expandedLessonHeight + 80)
      expect(await mountedPanel!.evaluate(element => element.isConnected)).toBe(true)
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      expect(await next.isEnabled()).toBe(true)
      expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      await toggle.click()
      await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('true')
      expect(await editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(false)
      expect(await editorContent.getAttribute('aria-hidden')).not.toBe('true')
      await expect.poll(() => editorLines.textContent()).toContain('mobile-draft-kept')
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      expect(await mobilePage.getByText(/mobile-output-kept/).isVisible()).toBe(true)

      await toggle.click()
      await next.click()
      await mobilePage.waitForURL(url => url.pathname === '/zh/tour/welcome/2')
      await mobilePage.getByRole('heading', { name: '已知语言', exact: true }).waitFor({ state: 'visible' })
      expect(await toggle.getAttribute('aria-expanded')).toBe('false')
      expect(await editorContent.getAttribute('aria-hidden')).toBe('true')
      expect(await editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(true)
      expect(await mobilePage.getByRole('button', { name: /上一页/ }).isEnabled()).toBe(true)

      await mobilePage.setViewportSize({ width: 1280, height: 900 })
      await expect.poll(() => editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(false)
      expect(await editorContent.getAttribute('aria-hidden')).not.toBe('true')
      await expect.poll(async () => (await editorContent.boundingBox())?.height ?? 0).toBeGreaterThan(100)
      await expect.poll(() => editorLines.textContent()).toMatch(/let\s+language/)
      expect(await mountedPanel!.evaluate(element => element.isConnected)).toBe(true)
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)

      await mobilePage.setViewportSize({ width: 390, height: 844 })
      await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('false')
      expect(await mobilePage.getByRole('button', { name: '展开代码', exact: true }).isEnabled()).toBe(true)
      expect(await editorContent.getAttribute('aria-hidden')).toBe('true')
      expect(await editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(true)
      expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      for (const path of ['/zh/tour/welcome/3', '/zh/tour/welcome/4', '/zh/tour/welcome/5', '/zh/tour/basics/1']) {
        await next.click()
        await mobilePage.waitForURL(url => url.pathname === path)
        expect(await toggle.getAttribute('aria-expanded')).toBe('false')
        expect(await editorContent.evaluate(element => (element as HTMLElement).inert)).toBe(true)
      }
      expect(await mountedPanel!.evaluate(element => element.isConnected)).toBe(true)
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
    }
    finally {
      await mobilePage.close()
    }
  }, 120_000)

  it('keeps mobile code actions above the editor and preserves independent native output channels', async () => {
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const runRequests: Route[] = []
    const diagnostic = 'main.cj:3:5: error: undeclared identifier: missingValue'
    const compilerOutput = 'compiler-output-kept'
    try {
      // Hold responses until the running state and automatic output expansion have been observed.
      await mobilePage.route('**/api/run', (route) => {
        runRequests.push(route)
      })
      await mobilePage.goto(`${baseUrl}/zh/tour/welcome/1`, { waitUntil: 'domcontentloaded' })
      await mobilePage.getByRole('heading', { name: 'Hello, 世界', exact: true }).waitFor({ state: 'visible' })

      const editorContent = mobilePage.locator('#tour-editor-content')
      const title = editorContent.getByText('示例代码', { exact: true })
      const run = editorContent.getByRole('button', { name: '运行', exact: true })
      const editor = editorContent.locator('#tour-code-panel .monaco-editor')
      const editorLines = editor.locator('.view-lines')
      const outputToggle = editorContent.locator('[aria-controls="tour-output-content"]')
      const outputContent = editorContent.locator('#tour-output-content')
      const channelSelector = outputContent.getByRole('combobox', { name: '切换输出', exact: true })
      const outputEditor = outputContent.locator('.output-view .monaco-editor')
      const outputLines = outputEditor.locator('.view-lines')
      const outputText = async () => (await outputLines.textContent())?.replace(/\u00A0/g, ' ').trim()
      const selectedChannel = () => channelSelector.locator('option:checked').textContent()
      const hidePanel = outputContent.getByRole('button', { name: /^隐藏面板/ })
      await expect.poll(() => run.isEnabled(), { timeout: 90_000 }).toBe(true)
      expect(await title.isVisible()).toBe(true)
      expect(await editorContent.getByRole('button', { name: '展开输出', exact: true }).isVisible()).toBe(true)
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('false')
      expect(await outputContent.isVisible()).toBe(false)
      expect((await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeLessThan(1)

      await outputToggle.click()
      await expect.poll(async () => (await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeGreaterThan(90)
      await outputToggle.click()
      await expect.poll(async () => (await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeLessThan(1)

      const titleBox = (await title.boundingBox())!
      const runBox = (await run.boundingBox())!
      const editorBox = (await editor.boundingBox())!
      expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(editorBox.y + 1)
      expect(runBox.y + runBox.height).toBeLessThanOrEqual(editorBox.y + 1)
      const outputToggleBox = (await outputToggle.boundingBox())!
      expect(outputToggleBox.y + outputToggleBox.height).toBeLessThanOrEqual(editorBox.y + 1)
      expect(runBox.width).toBeLessThanOrEqual(24)
      expect(runBox.height).toBeLessThanOrEqual(24)
      expect(outputToggleBox.width).toBeLessThanOrEqual(24)
      expect(await run.evaluate(element => element.closest('.monaco-toolbar .monaco-action-bar') !== null)).toBe(true)

      await editorLines.locator('.view-line').first().click()
      await mobilePage.keyboard.press('ControlOrMeta+Home')
      await mobilePage.keyboard.insertText('// mobile-reset-draft\n')
      await expect.poll(() => editorLines.textContent()).toContain('mobile-reset-draft')
      await editorContent.getByRole('button', { name: '更多代码操作', exact: true }).click()
      await mobilePage.getByRole('menuitem', { name: '格式化', exact: true }).waitFor({ state: 'visible' })
      // Monaco installs its mouse-up handler after a 100ms opening guard.
      await mobilePage.getByRole('menuitem', { name: '重置', exact: true }).click({ delay: 150 })
      await expect.poll(() => editorLines.textContent()).not.toContain('mobile-reset-draft')
      expect(await editorLines.textContent()).toMatch(/let\s+greeting/)

      await run.click()
      await expect.poll(() => runRequests.length).toBe(1)
      await editorContent.getByRole('button', { name: '运行中', exact: true }).waitFor({ state: 'visible' })
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('true')
      expect(await outputContent.isVisible()).toBe(true)
      await expect.poll(async () => (await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeGreaterThan(90)
      await runRequests[0].fulfill({ json: {
        phase: 'compile',
        compiler_code: 1,
        compiler_output: diagnostic,
        compiler_output_truncated: false,
        bin_code: null,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
      } })
      await expect.poll(outputText).toContain(diagnostic)
      expect(await outputContent.isVisible()).toBe(true)
      await expect.poll(selectedChannel).toBe('编译输出')

      await expect.poll(() => run.isEnabled()).toBe(true)
      await hidePanel.click()
      await expect.poll(() => outputToggle.getAttribute('aria-expanded')).toBe('false')
      await editorLines.locator('.view-line').first().click()
      await mobilePage.keyboard.press('ControlOrMeta+b')
      await expect.poll(() => runRequests.length).toBe(2)
      await expect.poll(() => outputToggle.getAttribute('aria-expanded')).toBe('true')
      await expect.poll(selectedChannel).toBe('程序输出')
      await runRequests[1].fulfill({ json: {
        phase: 'run',
        compiler_code: 0,
        compiler_output: compilerOutput,
        compiler_output_truncated: false,
        bin_code: 0,
        bin_stdout: 'mobile-retry-succeeded',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
      } })
      await expect.poll(outputText).toContain('mobile-retry-succeeded')
      expect(await outputContent.isVisible()).toBe(true)
      await expect.poll(selectedChannel).toBe('程序输出')

      const mountedOutputHost = await outputContent.locator('[data-tour-native-output]').elementHandle()
      expect(mountedOutputHost).not.toBeNull()
      expect(await outputContent.locator('pre').count()).toBe(0)
      await outputLines.locator('.view-line').first().click()
      await mobilePage.keyboard.press('ControlOrMeta+A')
      await mobilePage.keyboard.type('must-not-edit-output')
      expect(await outputText()).toContain('mobile-retry-succeeded')
      expect(await outputText()).not.toContain('must-not-edit-output')

      await hidePanel.click()
      await expect.poll(async () => (await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeLessThan(1)
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('false')
      expect(await outputContent.isVisible()).toBe(false)
      await expect.poll(() => outputToggle.evaluate(element => element === document.activeElement)).toBe(true)

      await outputToggle.click()
      await expect.poll(async () => (await mobilePage.locator('#tour-output-panel').boundingBox())?.height ?? 0).toBeGreaterThan(90)
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('true')
      expect(await outputContent.isVisible()).toBe(true)
      await expect.poll(outputText).toContain('mobile-retry-succeeded')
      expect(await mountedOutputHost!.evaluate(element => element.isConnected)).toBe(true)
      expect(await outputEditor.isVisible()).toBe(true)
      expect(runRequests).toHaveLength(2)

      await channelSelector.selectOption({ label: '编译输出' })
      await expect.poll(outputText).toContain(compilerOutput)
      expect(await outputText()).not.toContain('mobile-retry-succeeded')
      await channelSelector.selectOption({ label: '程序输出' })
      await expect.poll(outputText).toContain('mobile-retry-succeeded')
      expect(await outputText()).not.toContain(compilerOutput)

      // Exercise VS Code's real Clear Output command, then ensure React does not replay old props.
      await outputContent.getByRole('button', { name: '清除输出', exact: true }).click()
      await expect.poll(outputText).toBe('')
      await channelSelector.selectOption({ label: '编译输出' })
      await expect.poll(outputText).toContain(compilerOutput)
      await channelSelector.selectOption({ label: '程序输出' })
      await expect.poll(outputText).toBe('')
      await hidePanel.click()
      await expect.poll(() => outputToggle.getAttribute('aria-expanded')).toBe('false')
      await outputToggle.click()
      await expect.poll(() => outputToggle.getAttribute('aria-expanded')).toBe('true')
      await expect.poll(selectedChannel).toBe('程序输出')
      await expect.poll(outputText).toBe('')
      await channelSelector.selectOption({ label: '编译输出' })
      await expect.poll(outputText).toContain(compilerOutput)
      await channelSelector.selectOption({ label: '程序输出' })
      await expect.poll(outputText).toBe('')
      expect(runRequests).toHaveLength(2)

      // React still considers Program active after a native-only log selection.
      // Every accepted run must explicitly reveal Program before the response.
      await channelSelector.selectOption({ label: 'Cangjie' })
      await expect.poll(selectedChannel).toBe('Cangjie')
      await run.click()
      await expect.poll(() => runRequests.length).toBe(3)
      await expect.poll(selectedChannel).toBe('程序输出')
      await runRequests[2].fulfill({ json: {
        phase: 'run',
        compiler_code: 0,
        compiler_output: '',
        compiler_output_truncated: false,
        bin_code: 0,
        bin_stdout: 'native-channel-revealed',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
      } })
      await expect.poll(outputText).toContain('native-channel-revealed')
      expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await editorLines.locator('.view-line').first().click()
      const statusBar = editorContent.locator('.statusbar-container')
      await statusBar.getByText('Cangjie', { exact: true }).waitFor({ state: 'visible' })
      expect((await statusBar.boundingBox())?.height).toBe(22)

      await mobilePage.getByRole('button', { name: '下一页', exact: true }).click()
      await mobilePage.waitForURL(url => url.pathname === '/zh/tour/welcome/2')
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('false')
      await mobilePage.getByRole('button', { name: '上一页', exact: true }).click()
      await mobilePage.waitForURL(url => url.pathname === '/zh/tour/welcome/1')
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('false')
    }
    finally {
      await mobilePage.close()
    }
  }, 120_000)

  it('keeps code usable and the language status below output when an open desktop workspace becomes mobile', async () => {
    const responsivePage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    try {
      await responsivePage.goto(`${baseUrl}/zh/tour/welcome/1`, { waitUntil: 'domcontentloaded' })
      const editorContent = responsivePage.locator('#tour-editor-content')
      const codePanel = editorContent.locator('#tour-code-panel')
      const editor = codePanel.locator('.monaco-editor')
      const outputPanel = editorContent.locator('#tour-output-panel')
      const outputEditor = outputPanel.locator('.output-view .monaco-editor')
      const outputToggle = editorContent.locator('[aria-controls="tour-output-content"]')
      const run = editorContent.getByRole('button', { name: '运行', exact: true })
      const more = editorContent.getByRole('button', { name: '更多代码操作', exact: true })
      const statusBar = editorContent.locator('#tour-editor-statusbar')
      await expect.poll(() => run.isEnabled(), { timeout: 90_000 }).toBe(true)
      await statusBar.getByText('Cangjie', { exact: true }).waitFor({ state: 'visible' })
      const mountedEditor = await editor.elementHandle()
      expect(mountedEditor).not.toBeNull()

      // Measure the visible code area, so a stale Monaco size cannot conceal a collapsed parent panel.
      const codeHeight = () => editor.evaluate((element) => {
        const editorRect = element.getBoundingClientRect()
        const panelRect = element.closest('#tour-code-panel')!.getBoundingClientRect()
        return Math.max(0, Math.min(editorRect.bottom, panelRect.bottom) - Math.max(editorRect.top, panelRect.top))
      })
      const outputBodyHeight = () => outputEditor.evaluate((element) => {
        const editorRect = element.getBoundingClientRect()
        const bodyRect = element.closest('.output-view')!.getBoundingClientRect()
        const panelRect = element.closest('#tour-output-panel')!.getBoundingClientRect()
        return Math.max(0, Math.min(editorRect.bottom, bodyRect.bottom, panelRect.bottom) - Math.max(editorRect.top, bodyRect.top, panelRect.top))
      })
      const expectUsableWorkspace = async (minimumCodeHeight: number) => {
        await expect.poll(codeHeight).toBeGreaterThanOrEqual(minimumCodeHeight)
        expect(await outputToggle.getAttribute('aria-expanded')).toBe('true')
        expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
        expect(await codePanel.locator('.statusbar-container').count()).toBe(0)
        expect(await statusBar.evaluate(element => element.closest('#tour-code-panel') === null)).toBe(true)
        const statusBox = (await statusBar.boundingBox())!
        const outputBox = (await outputPanel.boundingBox())!
        const workspaceBox = (await editorContent.boundingBox())!
        expect(statusBox.height).toBeCloseTo(22, 0)
        expect(statusBox.y).toBeGreaterThanOrEqual(outputBox.y + outputBox.height - 1)
        expect(Math.abs(statusBox.y + statusBox.height - (workspaceBox.y + workspaceBox.height))).toBeLessThanOrEqual(1)
        for (const control of [run, outputToggle, more]) {
          const box = (await control.boundingBox())!
          expect(box.width).toBeCloseTo(22, 0)
          expect(box.height).toBeCloseTo(22, 0)
        }
        expect(await responsivePage.evaluate(() => ({
          horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
          vertical: document.documentElement.scrollHeight > window.innerHeight + 1,
        }))).toEqual({ horizontal: false, vertical: false })
      }

      await outputToggle.click()
      await expect.poll(async () => (await outputPanel.boundingBox())?.height ?? 0).toBeGreaterThan(90)
      await expectUsableWorkspace(140)

      await responsivePage.setViewportSize({ width: 390, height: 844 })
      await expect.poll(async () => (await editorContent.boundingBox())?.width ?? 0).toBeCloseTo(390, 0)
      await expect.poll(async () => (await outputPanel.boundingBox())?.height ?? 0).toBeLessThanOrEqual(100)
      expect((await outputPanel.boundingBox())!.height).toBeGreaterThan(90)
      await expectUsableWorkspace(140)

      for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }]) {
        await responsivePage.setViewportSize(viewport)
        await expect.poll(async () => (await editorContent.boundingBox())?.width ?? 0).toBeCloseTo(viewport.width, 0)
        await expectUsableWorkspace(viewport.height <= 500 ? 60 : 32)
      }
      await expect.poll(outputBodyHeight).toBeGreaterThanOrEqual(30)

      const expandedCodeHeight = await codeHeight()
      await outputToggle.click()
      await expect.poll(async () => (await outputPanel.boundingBox())?.height ?? 0).toBeLessThan(1)
      expect(await outputToggle.getAttribute('aria-expanded')).toBe('false')
      await expect.poll(codeHeight).toBeGreaterThan(expandedCodeHeight + 20)
      expect(await mountedEditor!.evaluate(element => element.isConnected)).toBe(true)
      await outputToggle.click()
      await expect.poll(() => outputToggle.getAttribute('aria-expanded')).toBe('true')
      await expect.poll(outputBodyHeight).toBeGreaterThanOrEqual(30)
      await expectUsableWorkspace(60)

      await responsivePage.setViewportSize({ width: 390, height: 844 })
      await expect.poll(async () => (await editorContent.boundingBox())?.width ?? 0).toBeCloseTo(390, 0)
      await expect.poll(async () => (await editorContent.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(350)
      expect((await editorContent.boundingBox())!.height).toBeLessThanOrEqual(380)
      await expect.poll(async () => (await outputPanel.boundingBox())?.height ?? 0).toBeLessThanOrEqual(100)
      expect((await outputPanel.boundingBox())!.height).toBeGreaterThan(90)
      await expectUsableWorkspace(140)
    }
    finally {
      await responsivePage.close()
    }
  }, 120_000)

  it('keeps English lesson navigation and the code toggle on one usable toolbar at 320 px', async () => {
    const mobilePage = await browser.newPage({ viewport: { width: 320, height: 740 } })
    try {
      await mobilePage.goto(`${baseUrl}/en/tour/welcome/1`, { waitUntil: 'domcontentloaded' })
      const toggle = mobilePage.getByRole('button', { name: 'Hide code', exact: true })
      await toggle.waitFor({ state: 'visible' })
      const previous = mobilePage.getByRole('button', { name: 'Previous', exact: true })
      const next = mobilePage.getByRole('button', { name: 'Next', exact: true })
      expect(await previous.isDisabled()).toBe(true)
      expect(await next.isEnabled()).toBe(true)
      expect(await mobilePage.getByText(/1\s*\/\s*\d+/).isVisible()).toBe(true)
      expect(await toggle.getAttribute('aria-controls')).toBe('tour-editor-content')
      expect(await toggle.getAttribute('aria-expanded')).toBe('true')

      await mobilePage.evaluate(() => document.fonts.ready.then(() => undefined))
      const nextBox = (await next.boundingBox())!
      const toggleBox = (await toggle.boundingBox())!
      expect(toggleBox.x).toBeGreaterThanOrEqual(nextBox.x + nextBox.width)
      expect(Math.abs(toggleBox.y + toggleBox.height / 2 - (nextBox.y + nextBox.height / 2))).toBeLessThan(10)
      expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      await toggle.click()
      const showCode = mobilePage.getByRole('button', { name: 'Show code', exact: true })
      expect(await showCode.isEnabled()).toBe(true)
      expect(await showCode.getAttribute('aria-expanded')).toBe('false')
      expect(await mobilePage.locator('#tour-editor-content').getAttribute('aria-hidden')).toBe('true')
      await next.click()
      await mobilePage.waitForURL(url => url.pathname === '/en/tour/welcome/2')
      expect(await showCode.isEnabled()).toBe(true)
      expect(await previous.isEnabled()).toBe(true)
      expect(await mobilePage.getByText(/2\s*\/\s*\d+/).isVisible()).toBe(true)
      expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await showCode.click()
      await expect.poll(() => mobilePage.getByRole('button', { name: 'Hide code', exact: true }).getAttribute('aria-expanded')).toBe('true')
    }
    finally {
      await mobilePage.close()
    }
  }, 120_000)
})
