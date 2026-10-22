import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
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
    const editor = page.locator('.monaco-editor')
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
})
