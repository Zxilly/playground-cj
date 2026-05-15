import { describe, expect, it } from 'vitest'

async function fetchAsset(path: string) {
  const response = await fetch(path)
  expect(response.ok, `${path} should be served to browser tests`).toBe(true)
  return response
}

describe('lsp browser assets', () => {
  it('serves a compileable wasm binary through the browser runtime', async () => {
    const response = await fetchAsset('/lsp/LSPServer-wasm.wasm')
    const bytes = await response.arrayBuffer()

    await expect(WebAssembly.compile(bytes)).resolves.toBeInstanceOf(WebAssembly.Module)
  })

  it('serves the wasm glue script and stdlib CJO payloads', async () => {
    const glue = await (await fetchAsset('/lsp/LSPServer-wasm.js')).text()
    expect(glue).toContain('WebAssembly')

    const stdlibModule = await (await fetchAsset('/lsp/modules/linux_x86_64_cjnative/std/std.core.cjo')).arrayBuffer()
    expect(stdlibModule.byteLength).toBeGreaterThan(0)
  })
})
