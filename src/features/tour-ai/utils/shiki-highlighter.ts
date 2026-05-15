import type { Highlighter, LanguageRegistration, ThemedToken } from 'shiki'
import { createHighlighter } from 'shiki'
import cangjieGrammar from '@/grammars/Cangjie.tmLanguage.json'

export const CLASSROOM_SHIKI_THEME = 'vitesse-light'

const COMMON_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'css',
  'diff',
  'html',
  'java',
  'javascript',
  'json',
  'markdown',
  'python',
  'rust',
  'tsx',
  'typescript',
  'vue',
  'yaml',
] as const

const LANGUAGE_ALIASES: Record<string, string> = {
  cangjie: 'cangjie',
  cj: 'cangjie',
  js: 'javascript',
  jsx: 'jsx',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  ts: 'typescript',
  txt: 'text',
}

const cangjieLanguage: LanguageRegistration = {
  ...(cangjieGrammar as LanguageRegistration),
  name: 'cangjie',
  aliases: ['cj', 'Cangjie'],
}

let highlighterPromise: Promise<Highlighter> | null = null

export interface HighlightedCodeTokens {
  language: string
  tokens: ThemedToken[][]
  fg?: string
  bg?: string
}

export function normalizeShikiLanguage(language?: string): string {
  const normalized = (language ?? 'cangjie').trim().toLowerCase()
  if (!normalized)
    return 'cangjie'
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [CLASSROOM_SHIKI_THEME],
    langs: [cangjieLanguage, ...COMMON_LANGUAGES],
  })
  return highlighterPromise
}

async function resolveLanguage(highlighter: Highlighter, language: string): Promise<string> {
  if (['text', 'txt', 'plaintext'].includes(language))
    return 'text'

  if (highlighter.getLoadedLanguages().includes(language))
    return language

  try {
    await highlighter.loadLanguage(language as never)
  }
  catch {
    return 'text'
  }

  return highlighter.getLoadedLanguages().includes(language) ? language : 'text'
}

export async function highlightCode(code: string, language?: string): Promise<HighlightedCodeTokens> {
  const highlighter = await getHighlighter()
  const resolvedLanguage = await resolveLanguage(highlighter, normalizeShikiLanguage(language))
  const result = highlighter.codeToTokens(code, {
    lang: resolvedLanguage as never,
    theme: CLASSROOM_SHIKI_THEME,
  })

  return {
    language: resolvedLanguage,
    tokens: result.tokens,
    fg: result.fg,
    bg: result.bg,
  }
}
