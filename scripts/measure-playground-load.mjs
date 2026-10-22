// Run against a production server: node scripts/measure-playground-load.mjs URL output.json
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3100'
const output = process.argv[3] ?? '.scratch/playground-performance.json'
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const locale of ['zh', 'en']) {
    for (const width of [1440, 390]) {
      for (let run = 0; run < 3; run++) {
        const context = await browser.newContext({ viewport: { width, height: 900 } })
        try {
          const page = await context.newPage()
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 1250000 })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
          await page.addInitScript(() => {
            window.loadMetrics = { cls: 0, lcp: 0, shifts: [], longTasks: [] }
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                window.loadMetrics.longTasks.push({ start: entry.startTime, duration: entry.duration })
            }).observe({ type: 'longtask', buffered: true })
            let sessionStart = 0
            let lastShift = 0
            let sessionValue = 0
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
                window.loadMetrics.cls = Math.max(window.loadMetrics.cls, sessionValue)
                window.loadMetrics.shifts.push({ value: entry.value, time: entry.startTime, sources: entry.sources.map(s => s.node?.id || s.node?.className || s.node?.nodeName) })
              }
            }).observe({ type: 'layout-shift', buffered: true })
            new PerformanceObserver((list) => {
              window.loadMetrics.lcp = list.getEntries().at(-1).startTime
            }).observe({ type: 'largest-contentful-paint', buffered: true })
            new MutationObserver(() => {
              if (!window.loadMetrics.editor && document.querySelector('.monaco-editor .view-lines .view-line'))
                window.loadMetrics.editor = performance.now()
            }).observe(document, { childList: true, subtree: true })
          })
          const errors = []
          page.on('pageerror', error => errors.push(error.message))
          await page.goto(`${baseUrl}/${locale}`, { waitUntil: 'domcontentloaded' })
          const shellScripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.src))
          const shellStyles = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(n => n.href))
          await page.waitForFunction(() => window.loadMetrics.editor, undefined, { timeout: 90000 })
          await page.evaluate(() => document.fonts.ready.then(() => undefined))
          await page.waitForTimeout(2000)
          const data = await page.evaluate(() => ({
            ...window.loadMetrics,
            fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
            milestones: performance.getEntriesByType('mark').filter(e => e.name.startsWith('cj:editor:')).map(e => ({ name: e.name, start: e.startTime })),
            resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, encoded: r.encodedBodySize, decoded: r.decodedBodySize, start: r.startTime, end: r.responseEnd })),
          }))
          // Check actual editing separately, after collecting Web Vitals. This
          // round-trip includes automation overhead; it is not startup time.
          await page.locator('.monaco-editor .view-lines').click({ position: { x: 80, y: 10 }, force: true })
          await page.keyboard.press('Control+End')
          const inputStart = await page.evaluate(() => performance.now())
          await page.keyboard.insertText(' // editable-probe')
          await page.waitForFunction(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('editable-probe'))
          const inputRoundTripMs = await page.evaluate(start => performance.now() - start, inputStart)
          const shellJs = data.resources.filter(r => shellScripts.includes(r.name))
          const shellCss = data.resources.filter(r => shellStyles.includes(r.name))
          const fonts = data.resources.filter(r => new URL(r.name).pathname.endsWith('.woff2'))
          const summary = {
            locale, width, run, fcp: data.fcp, lcp: data.lcp, cls: data.cls, editor: data.editor,
            shellJsEncoded: shellJs.reduce((sum, r) => sum + r.encoded, 0),
            shellJsDecoded: shellJs.reduce((sum, r) => sum + r.decoded, 0),
            shellCssEncoded: shellCss.reduce((sum, r) => sum + r.encoded, 0),
            shellCssDecoded: shellCss.reduce((sum, r) => sum + r.decoded, 0),
            fontBytes: fonts.reduce((sum, r) => sum + r.encoded, 0),
            largestFontBytes: Math.max(0, ...fonts.map(r => r.encoded)),
            completedPageBytesAtEditor: data.resources.filter(r => r.end <= data.editor).reduce((sum, r) => sum + r.encoded, 0),
            editorReady: data.milestones.find(m => m.name === 'cj:editor:ready')?.start,
            longTaskMsBeforeEditor: data.longTasks.filter(t => t.start < data.editor).reduce((sum, t) => sum + t.duration, 0),
            largestLongTaskMs: Math.max(0, ...data.longTasks.map(t => t.duration)),
            inputRoundTripMs,
            errors,
          }
          results.push({ ...summary, milestones: data.milestones, longTasks: data.longTasks, shifts: data.shifts, resources: data.resources })
          console.log(JSON.stringify(summary))
        }
        finally {
          await context.close()
        }
      }
    }
  }
}
finally {
  await browser.close()
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({
    conditions: 'Chromium, cold cache, 40 ms latency, 10 Mbps, 4x CPU throttle, viewport height 900. CLS/LCP observed until two seconds after editor/font readiness. Page resource bytes exclude worker subresources and incomplete requests. Shell JS means script[src] in the initial DOM.',
    results,
  }, null, 2))
}
