import type { KnowledgeHit, KnowledgeSource } from './source'
import { callMcpTool } from '@/lib/mcp/client'

/** Identifier embedded into every hit produced by this source. */
export const CANGJIE_MCP_SOURCE_ID = 'cangjie-mcp'

/** Name of the MCP tool this source wraps. */
export const CANGJIE_SEARCH_DOCS_TOOL = 'cangjie_search_docs'

/** Default number of hits requested when the caller does not specify a limit. */
const DEFAULT_LIMIT = 5

/**
 * Minimal shape of the MCP `tools/call` invoker this source depends on. The
 * real implementation is {@link callMcpTool}; tests inject a fake.
 */
export type McpCallFn = (name: string, args: Record<string, unknown>) => Promise<unknown>

export interface CangjieMcpKnowledgeSourceDeps {
  /** Injected MCP caller; defaults to the shared {@link callMcpTool}. */
  call?: McpCallFn
}

interface StructuredHit {
  title?: unknown
  ref?: unknown
  path?: unknown
  id?: unknown
  snippet?: unknown
  text?: unknown
  body?: unknown
  content?: unknown
  url?: unknown
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function mapStructuredHit(raw: StructuredHit): KnowledgeHit | null {
  const ref = asString(raw.ref) ?? asString(raw.path) ?? asString(raw.id)
  const title = asString(raw.title) ?? ref
  if (!ref || !title)
    return null
  const snippet = asString(raw.snippet) ?? asString(raw.text) ?? asString(raw.body) ?? asString(raw.content) ?? ''
  const url = asString(raw.url)
  const hit: KnowledgeHit = { sourceId: CANGJIE_MCP_SOURCE_ID, ref, title, snippet }
  if (url)
    hit.url = url
  return hit
}

function extractStructuredResults(result: unknown): unknown[] | null {
  if (typeof result !== 'object' || result === null)
    return null
  const structured = (result as { structuredContent?: unknown }).structuredContent
  if (typeof structured !== 'object' || structured === null)
    return null
  const results = (structured as { results?: unknown }).results
  return Array.isArray(results) ? results : null
}

function extractText(result: unknown): string | null {
  if (typeof result !== 'object' || result === null)
    return null
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content))
    return null
  const parts: string[] = []
  for (const part of content) {
    if (typeof part === 'object' && part !== null && (part as { type?: unknown }).type === 'text') {
      const text = asString((part as { text?: unknown }).text)
      if (text)
        parts.push(text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : null
}

// Matches a result header line like: "### [1] 使用 Option (error_handle/use_option) [score: 0.99]"
// Title/ref are captured as paren-free runs and trimmed in code to keep the
// pattern free of overlapping quantifiers (no super-linear backtracking).
const HEADER_RE = /^#{2,4} \[\d+\] ([^()]+)\(([^()]+)\)(?: \[score:[^\]]*\])?$/

/**
 * Parse the human-readable text payload returned by `cangjie_search_docs` into
 * structured hits. Each result block starts with a header line carrying the
 * title and source-local ref; everything up to the next header (minus the
 * leading markdown `#` title echo and `---` separators) becomes the snippet.
 */
function parseTextResults(text: string): KnowledgeHit[] {
  const lines = text.split('\n')
  const hits: KnowledgeHit[] = []
  let current: { title: string, ref: string, body: string[] } | null = null

  const flush = () => {
    if (!current)
      return
    const snippet = current.body
      .filter(line => line.trim() !== '' && line.trim() !== '---')
      .join('\n')
      .trim()
    hits.push({ sourceId: CANGJIE_MCP_SOURCE_ID, ref: current.ref, title: current.title, snippet })
    current = null
  }

  for (const line of lines) {
    const match = HEADER_RE.exec(line)
    if (match) {
      flush()
      current = { title: match[1].trim(), ref: match[2].trim(), body: [] }
      continue
    }
    if (current)
      current.body.push(line)
  }
  flush()
  return hits
}

function mapResult(result: unknown, limit: number): KnowledgeHit[] {
  const structured = extractStructuredResults(result)
  if (structured) {
    const hits = structured
      .map(item => (typeof item === 'object' && item !== null ? mapStructuredHit(item as StructuredHit) : null))
      .filter((hit): hit is KnowledgeHit => hit !== null)
    return hits.slice(0, limit)
  }
  const text = extractText(result)
  if (text)
    return parseTextResults(text).slice(0, limit)
  return []
}

/**
 * {@link KnowledgeSource} backed by the Cangjie documentation MCP server.
 *
 * Wraps the `cangjie_search_docs` tool and maps each documentation result into
 * a {@link KnowledgeHit} tagged with `sourceId: 'cangjie-mcp'`. When the MCP
 * server is unavailable or returns an unexpected shape, {@link KnowledgeSource.search}
 * resolves to an empty array (logging a warning) rather than throwing, so
 * grounding failures degrade gracefully.
 */
export function createCangjieMcpKnowledgeSource(deps: CangjieMcpKnowledgeSourceDeps = {}): KnowledgeSource {
  const call = deps.call ?? callMcpTool
  return {
    id: CANGJIE_MCP_SOURCE_ID,
    search: async (query, opts) => {
      const limit = opts?.limit ?? DEFAULT_LIMIT
      try {
        const result = await call(CANGJIE_SEARCH_DOCS_TOOL, { query, top_k: limit })
        return mapResult(result, limit)
      }
      catch (err) {
        console.warn('[teach] cangjie MCP knowledge source unavailable', err)
        return []
      }
    },
  }
}
