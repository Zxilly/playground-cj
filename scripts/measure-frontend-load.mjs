// Measure production routes: node scripts/measure-frontend-load.mjs URL output.json
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3300'
const output = process.argv[3] ?? '.scratch/frontend-performance.json'
const samples = Number(process.env.PERF_SAMPLES ?? 3)
const surfaces = [
  { name: 'playground', path: '', selector: '.monaco-editor .view-lines .view-line' },
  { name: 'tour', path: '/tour/welcome/1', selector: '.tour-prose' },
  { name: 'ai-landing', path: '/tour/ai', selector: '[data-testid="teach-landing"]' },
  { name: 'ai-workspace', path: '/tour/ai', selector: '[data-testid="teach-workspace-shell"]', onboarded: true },
]
const browser = await chromium.launch({ headless: true })
const results = []
await mkdir(dirname(output), { recursive: true })
try {
  for (const surface of surfaces) {
    for (const locale of ['zh', 'en']) {
      for (const width of [1440, 390]) {
        for (let run = 0; run < samples; run++) {
          const context = await browser.newContext({ viewport: { width, height: 900 } })
          try {
            const page = await context.newPage()
            const cdp = await context.newCDPSession(page)
            await cdp.send('Network.enable')
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 1250000,
            })
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
            await page.addInitScript(({ selector, onboarded }) => {
              if (onboarded)
                localStorage.setItem('teach:onboarded', '1')
              window.frontendMetrics = { cls: 0, lcp: 0, longTasks: [] }
              let sessionStart = 0
              let lastShift = 0
              let sessionValue = 0
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries())
                  window.frontendMetrics.longTasks.push({ start: entry.startTime, duration: entry.duration })
              }).observe({ type: 'longtask', buffered: true })
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (entry.hadRecentInput)
                    continue
                  if (entry.startTime - lastShift > 1000 || entry.startTime - sessionStart > 5000) {
                    sessionStart = entry.startTime
                    sessionValue = 0
                  }
                  lastShift = entry.startTime
                  sessionValue += entry.value
                  window.frontendMetrics.cls = Math.max(window.frontendMetrics.cls, sessionValue)
                }
              }).observe({ type: 'layout-shift', buffered: true })
              new PerformanceObserver((list) => {
                window.frontendMetrics.lcp = list.getEntries().at(-1).startTime
              }).observe({ type: 'largest-contentful-paint', buffered: true })
              new MutationObserver(() => {
                const metrics = window.frontendMetrics
                if (!metrics.content && document.querySelector(selector))
                  metrics.content = performance.now()
                if (!metrics.editor && document.querySelector('.monaco-editor .view-lines .view-line'))
                  metrics.editor = performance.now()
              }).observe(document, { childList: true, subtree: true })
            }, { selector: surface.selector, onboarded: surface.onboarded })
            const errors = []
            page.on('pageerror', error => errors.push(error.message))
            await page.goto(`${baseUrl}/${locale}${surface.path}`, { waitUntil: 'domcontentloaded' })
            await page.locator(surface.selector).first().waitFor({ state: 'visible', timeout: 90000 })
            await page.evaluate(() => document.fonts.ready.then(() => undefined))
            await page.waitForTimeout(2000)
            const data = await page.evaluate(() => ({
              ...window.frontendMetrics,
              fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
              documentBytes: performance.getEntriesByType('navigation')[0].encodedBodySize,
              documentDecoded: performance.getEntriesByType('navigation')[0].decodedBodySize,
              overflow: document.documentElement.scrollWidth > innerWidth,
              resources: performance.getEntriesByType('resource').map(r => ({
                name: new URL(r.name).pathname, encoded: r.encodedBodySize,
                decoded: r.decodedBodySize, start: r.startTime, end: r.responseEnd,
              })),
            }))
            const beforeContent = data.resources.filter(r => r.end <= data.content)
            const js = beforeContent.filter(r => r.name.endsWith('.js'))
            const summary = {
              surface: surface.name, locale, width, run,
              fcp: data.fcp, lcp: data.lcp, cls: data.cls, content: data.content, editor: data.editor,
              documentBytes: data.documentBytes, documentDecoded: data.documentDecoded,
              jsBeforeContent: js.reduce((sum, r) => sum + r.encoded, 0),
              jsDecodedBeforeContent: js.reduce((sum, r) => sum + r.decoded, 0),
              longTaskMsBeforeContent: data.longTasks.filter(t => t.start < data.content).reduce((sum, t) => sum + t.duration, 0),
              largestLongTaskMs: Math.max(0, ...data.longTasks.map(t => t.duration)),
              overflow: data.overflow, errors,
            }
            results.push({ ...summary, resources: data.resources })
            console.log(JSON.stringify(summary))
            if (run === 0) {
              await page.screenshot({
                path: join(dirname(output), `${surface.name}-${locale}-${width}.png`),
                fullPage: true,
              })
            }
          }
          finally {
            await context.close()
          }
        }
      }
    }
  }
}
finally {
  await browser.close()
  await writeFile(output, JSON.stringify({
    conditions: 'Chromium, cold cache, 40 ms latency, 10 Mbps, 4x CPU throttle, viewport height 900. Content is the first rendered editor line, tour lesson, AI landing, or AI workspace shell. LCP/CLS observed until two seconds after content/font readiness. Resource totals exclude workers and unfinished requests. AI workspace uses a fresh local store with onboarding completed; no AI requests are submitted.',
    results,
  }, null, 2))
}
