import { describe, expect, it } from 'vitest'
import { MCP_URL, resolveMcpUrl } from './client'

describe('resolveMcpUrl', () => {
  it('defaults to the same-origin proxy path', () => {
    // Without a NEXT_PUBLIC_CANGJIE_MCP_URL override the client routes through the
    // same-origin proxy so the browser can read the mcp-session-id header.
    expect(MCP_URL).toBe('/api/cangjie-mcp')
  })

  it('resolves the relative proxy path against the current origin', () => {
    expect(resolveMcpUrl('https://playground.example.com').href).toBe(
      'https://playground.example.com/api/cangjie-mcp',
    )
  })

  it('ignores the base when MCP_URL is already absolute', () => {
    // `new URL(absolute, base)` ignores the base, so an override is used verbatim.
    expect(new URL('https://mcp.example.com/mcp', 'https://playground.example.com').href).toBe(
      'https://mcp.example.com/mcp',
    )
  })
})
