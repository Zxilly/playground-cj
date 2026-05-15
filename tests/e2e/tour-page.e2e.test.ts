import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { startNextDevServer } from '../helpers/next-dev-server'

describe('tour page e2e', () => {
  let server: Awaited<ReturnType<typeof startNextDevServer>>
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await startNextDevServer()
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  }, 120_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.stop()
  })

  it('opens the Chinese tour and navigates to the next lesson', async () => {
    await page.goto(`${server.url}/zh/tour/welcome/1`, {
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

    await next.click()
    await page.waitForURL(url => url.pathname !== '/zh/tour/welcome/1')

    expect(await page.getByRole('button', { name: /上一页/ }).isEnabled()).toBe(true)
    expect(await page.getByText(/2\s*\/\s*\d+/).isVisible()).toBe(true)
  }, 120_000)
})
