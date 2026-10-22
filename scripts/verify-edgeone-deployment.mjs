import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const base = new URL(process.argv[2] || 'https://play.cj.zxilly.com')
async function verify() {
  for (const locale of ['en', 'zh']) {
    const response = await fetch(new URL(`/${locale}`, base), {
      signal: AbortSignal.timeout(30_000),
    })
    assert.equal(response.status, 200, `${locale}: HTTP status`)
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin')
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp')
    const html = await response.text()
    assert.ok(html.includes('/_next/static/'), `${locale}: missing application assets`)
    assert.ok(html.includes(`lang="${locale}"`), `${locale}: missing localized document`)
    console.log(`${locale}: HTTP 200, localized HTML, assets and isolation headers`)
  }
  const redirect = await fetch(base, {
    headers: { 'accept-language': 'en-US' }, redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  assert.equal(redirect.status, 307, 'language redirect status')
  assert.equal(new URL(redirect.headers.get('location'), base).pathname.replace(/\/$/, ''), '/en')
  const guard = await fetch(new URL('/api/run', base), {
    method: 'POST', signal: AbortSignal.timeout(30_000),
  })
  assert.equal(guard.status, 403, 'cross-origin API guard')
  console.log('Language redirect and API origin guard passed')
}

for (let attempt = 1; ; attempt++) {
  try {
    await verify()
    break
  }
  catch (error) {
    if (attempt === 6)
      throw error
    console.warn(`Deployment check ${attempt}/6: ${error.message}`)
    await delay(10_000)
  }
}
