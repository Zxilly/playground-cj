import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3100'
const output = process.argv[3] ?? '.scratch/editor-startup.json'
const samples = Number(process.env.STARTUP_SAMPLES ?? 3)
if (!Number.isInteger(samples) || samples < 1)
  throw new Error('STARTUP_SAMPLES must be a positive integer')
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const locale of ['en', 'zh']) {
    for (let run = 0; run < samples; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      try {
        const page = await context.newPage()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false, latency: 40, downloadThroughput: 1_250_000, uploadThroughput: 1_250_000,
        })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.addInitScript(() => {
          window.editorProbe = { visible: 0, longTasks: [] }
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              window.editorProbe.longTasks.push({ start: entry.startTime, duration: entry.duration })
          }).observe({ type: 'longtask', buffered: true })
          new MutationObserver(() => {
            if (!window.editorProbe.visible && document.querySelector('.monaco-editor .view-line'))
              window.editorProbe.visible = performance.now()
          }).observe(document, { subtree: true, childList: true })
        })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(`${baseUrl}/${locale}`, { waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.editorProbe.visible, undefined, { timeout: 90_000 })
        await page.locator('.monaco-editor .view-lines').click({ position: { x: 100, y: 10 }, force: true })
        await page.keyboard.press('Control+End')
        await page.keyboard.insertText(' // editable-probe')
        await page.waitForFunction(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('editable-probe'))
        const firstEditVerified = await page.evaluate(() => performance.now())
        await page.getByRole('button', {
          name: locale === 'zh' ? '代码提示已就绪' : 'Code assistance ready', exact: true,
        }).waitFor({ timeout: 90_000 })
        const assistanceReadyObserved = await page.evaluate(() => performance.now())
        await page.locator('.monaco-editor .view-lines').click({ position: { x: 100, y: 10 }, force: true })
        await page.keyboard.press('Control+A')
        await page.keyboard.insertText('main() { let value: Int64 = "wrong" }')
        await page.locator('.monaco-editor .squiggly-error').first().waitFor({ timeout: 60_000 })
        const diagnosticObserved = await page.evaluate(() => performance.now())
        const data = await page.evaluate(() => ({
          ...window.editorProbe,
          marks: performance.getEntriesByType('mark').filter(e => e.name.startsWith('cj:editor:')).map(e => ({ name: e.name, start: e.startTime })),
          resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, encoded: r.encodedBodySize, decoded: r.decodedBodySize, start: r.startTime, end: r.responseEnd })),
        }))
        const js = data.resources.filter(r => new URL(r.name).pathname.endsWith('.js') && r.end <= data.visible)
        const result = {
          locale, run, visible: data.visible,
          editorReady: data.marks.find(m => m.name === 'cj:editor:ready')?.start,
          firstEditVerified, assistanceReadyObserved, diagnosticObserved,
          jsEncodedAtVisible: js.reduce((sum, r) => sum + r.encoded, 0),
          jsDecodedAtVisible: js.reduce((sum, r) => sum + r.decoded, 0),
          longTaskMsBeforeVisible: data.longTasks.filter(t => t.start < data.visible).reduce((sum, t) => sum + t.duration, 0),
          errors,
        }
        console.log(JSON.stringify(result))
        results.push({ ...result, marks: data.marks, resources: data.resources, longTasks: data.longTasks })
      }
      finally {
        await context.close()
      }
    }
  }
}
finally {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({
    browser: browser.version(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    variant: process.env.STARTUP_VARIANT ?? null,
    dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()),
    conditions: 'Cold cache, 40 ms latency, 10 Mbps, 4x CPU throttle, 1440x900. firstEditVerified and assistanceReadyObserved include browser automation overhead. Resource totals exclude workers and incomplete requests.',
    results,
  }, null, 2))
  await browser.close()
}
