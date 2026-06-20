import type { McpCallFn } from './cangjie-mcp-source'
import { describe, expect, it, vi } from 'vitest'
import { CANGJIE_MCP_SOURCE_ID, CANGJIE_SEARCH_DOCS_TOOL, createCangjieMcpKnowledgeSource } from './cangjie-mcp-source'

describe('createCangjieMcpKnowledgeSource', () => {
  it('exposes the cangjie-mcp source id', () => {
    const source = createCangjieMcpKnowledgeSource({ call: vi.fn() })
    expect(source.id).toBe(CANGJIE_MCP_SOURCE_ID)
    expect(CANGJIE_MCP_SOURCE_ID).toBe('cangjie-mcp')
  })

  it('calls cangjie_search_docs with the query and limit', async () => {
    const call = vi.fn<McpCallFn>().mockResolvedValue({ structuredContent: { results: [] } })
    const source = createCangjieMcpKnowledgeSource({ call })

    await source.search('what is Option', { limit: 3 })

    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith(CANGJIE_SEARCH_DOCS_TOOL, { query: 'what is Option', top_k: 3 })
  })

  it('maps structured results to KnowledgeHit with sourceId cangjie-mcp', async () => {
    const call = vi.fn<McpCallFn>().mockResolvedValue({
      structuredContent: {
        results: [
          { title: '使用 Option', ref: 'error_handle/use_option', snippet: 'Option 用作错误处理', url: 'https://docs/use_option' },
          { title: '泛型枚举', path: 'generic/generic_enum', text: 'Option 是泛型类型' },
        ],
      },
    })
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('Option')

    expect(hits).toEqual([
      { sourceId: 'cangjie-mcp', ref: 'error_handle/use_option', title: '使用 Option', snippet: 'Option 用作错误处理', url: 'https://docs/use_option' },
      { sourceId: 'cangjie-mcp', ref: 'generic/generic_enum', title: '泛型枚举', snippet: 'Option 是泛型类型' },
    ])
  })

  it('parses the formatted text payload when no structured content is present', async () => {
    const text = [
      'Found 2 results (showing 1-2):',
      '',
      '---',
      '### [1] 使用 Option (error_handle/use_option) [score: 0.99]',
      '',
      '# 使用 Option',
      '',
      'Option 类型也可以用作错误处理。',
      '',
      '---',
      '### [2] 泛型枚举 (generic/generic_enum) [score: 0.99]',
      '',
      'Option 是一个泛型类型。',
      '',
      '---',
    ].join('\n')
    const call = vi.fn<McpCallFn>().mockResolvedValue({ content: [{ type: 'text', text }] })
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('Option')

    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ sourceId: 'cangjie-mcp', ref: 'error_handle/use_option', title: '使用 Option' })
    expect(hits[0]?.snippet).toContain('用作错误处理')
    expect(hits[1]).toMatchObject({ sourceId: 'cangjie-mcp', ref: 'generic/generic_enum', title: '泛型枚举' })
  })

  it('parses a result header whose title contains parentheses', async () => {
    const text = [
      '### [1] 使用 Option(T) 处理空值 (error_handle/use_option) [score: 0.99]',
      '',
      '# 使用 Option(T) 处理空值',
      '',
      'Option(T) 可以表示空值。',
      '',
      '---',
    ].join('\n')
    const call = vi.fn<McpCallFn>().mockResolvedValue({ content: [{ type: 'text', text }] })
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('Option')

    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({
      sourceId: 'cangjie-mcp',
      ref: 'error_handle/use_option',
      title: '使用 Option(T) 处理空值',
    })
    expect(hits[0]?.snippet).toContain('可以表示空值')
  })

  it('strips the leading "# title" echo from the parsed snippet', async () => {
    const text = [
      '### [1] 使用 Option (error_handle/use_option) [score: 0.99]',
      '',
      '# 使用 Option',
      '',
      'Option 类型也可以用作错误处理。',
      '',
      '---',
    ].join('\n')
    const call = vi.fn<McpCallFn>().mockResolvedValue({ content: [{ type: 'text', text }] })
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('Option')

    expect(hits).toHaveLength(1)
    expect(hits[0]?.snippet).not.toContain('# 使用 Option')
    expect(hits[0]?.snippet).toContain('用作错误处理')
  })

  it('honours the limit when slicing parsed results', async () => {
    const text = [
      '### [1] A (a/one) [score: 0.9]',
      'first body',
      '### [2] B (b/two) [score: 0.8]',
      'second body',
    ].join('\n')
    const call = vi.fn<McpCallFn>().mockResolvedValue({ content: [{ type: 'text', text }] })
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('q', { limit: 1 })

    expect(hits).toHaveLength(1)
    expect(hits[0]?.ref).toBe('a/one')
  })

  it('returns an empty array (does not throw) when the MCP call fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const call = vi.fn<McpCallFn>().mockRejectedValue(new Error('mcp offline'))
    const source = createCangjieMcpKnowledgeSource({ call })

    const hits = await source.search('Option')

    expect(hits).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns an empty array when the result is malformed', async () => {
    const call = vi.fn<McpCallFn>().mockResolvedValue({ something: 'unexpected' })
    const source = createCangjieMcpKnowledgeSource({ call })

    expect(await source.search('Option')).toEqual([])
  })

  it('forwards the abort signal to the MCP call', async () => {
    const call = vi.fn<McpCallFn>().mockResolvedValue({ structuredContent: { results: [] } })
    const source = createCangjieMcpKnowledgeSource({ call })
    const controller = new AbortController()

    await source.search('Option', { limit: 2, signal: controller.signal })

    expect(call).toHaveBeenCalledWith(CANGJIE_SEARCH_DOCS_TOOL, { query: 'Option', top_k: 2 }, controller.signal)
  })

  it('propagates an abort instead of degrading to empty hits', async () => {
    const controller = new AbortController()
    controller.abort()
    const call = vi.fn<McpCallFn>().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const source = createCangjieMcpKnowledgeSource({ call })

    await expect(source.search('Option', { signal: controller.signal })).rejects.toThrow()
  })
})
