import assert from 'node:assert/strict'

const origin = new URL(process.argv[2]).origin

async function request(path, options = {}, statuses = [200]) {
  const response = await fetch(new URL(path, origin), {
    ...options,
    signal: AbortSignal.timeout(60_000),
  })
  if (!statuses.includes(response.status)) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`${path}: HTTP ${response.status}: ${detail}`)
  }
  return response
}

const page = await request('/zh')
assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin')
assert.equal(page.headers.get('cross-origin-embedder-policy'), 'credentialless')
assert.match(await page.text(), /仓颉|Cangjie/)
console.log('Homepage and browser isolation: OK')

for (const path of ['/lsp/LSPServer-wasm.wasm', '/lsp/cjfmt-wasm.wasm']) {
  const response = await request(path, {
    headers: { Range: 'bytes=0-7' },
  }, [200, 206])
  assert.match(response.headers.get('content-type') ?? '', /application\/wasm/)
  const reader = response.body.getReader()
  const { value } = await reader.read()
  assert.deepEqual([...value.slice(0, 4)], [0, 97, 115, 109])
  await reader.cancel()
}
console.log('Language server and formatter WASM: OK')

for (const path of ['/lsp/cjfmt-wasm.js', '/lsp/LSPServer-wasm.js']) {
  const response = await request(path, { method: 'HEAD' })
  assert.match(response.headers.get('content-type') ?? '', /(?:application|text)\/javascript/)
}
console.log('WASM JavaScript module MIME types: OK')

const share = await request('/api/dpaste', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
}, [400])
assert.equal((await share.json()).error, 'Content is required')
console.log('Sharing route and request validation: OK')

const metadata = await request('/api/ai-gateway/metadata')
assert.match(metadata.headers.get('cache-control') ?? '', /no-store/)
const shared = await metadata.json()
assert.equal(shared.transport, 'shared-gateway')
assert.ok(shared.model)
assert.equal(typeof shared.quota.available, 'number')
console.log('AI metadata and Redis quota: OK')

const run = await request('/api/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ code: 'main() { println("EdgeOne smoke OK") }' }),
})
const result = await run.json()
assert.equal(result.compiler_code, 0, result.compiler_output)
assert.equal(result.bin_code, 0, result.bin_stderr)
assert.equal(result.bin_stdout.trim(), 'EdgeOne smoke OK')
console.log('Modal compile and execution: OK')
