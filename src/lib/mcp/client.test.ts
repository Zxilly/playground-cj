import { describe, expect, it } from 'vitest'
import { MCP_URL, resolveMcpUrl } from './client'

describe('resolveMcpUrl', () => {
  it('defaults to the upstream MCP url directly', () => {
    // Without a NEXT_PUBLIC_CANGJIE_MCP_URL override the client connects straight
    // to the upstream (which exposes mcp-session-id via CORS).
    expect(MCP_URL).toBe('https://cj-mcp.learningman.top/mcp')
  })

  it('uses the absolute default verbatim, ignoring the origin base', () => {
    expect(resolveMcpUrl('https://playground.example.com').href).toBe(
      'https://cj-mcp.learningman.top/mcp',
    )
  })

  it('ignores the base when MCP_URL is already absolute', () => {
    // `new URL(absolute, base)` ignores the base, so an override is used verbatim.
    expect(new URL('https://mcp.example.com/mcp', 'https://playground.example.com').href).toBe(
      'https://mcp.example.com/mcp',
    )
  })
})
