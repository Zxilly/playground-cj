import * as monaco from '@codingame/monaco-vscode-editor-api'
import { HMR_SLOT_KEYS, hmrFlag } from '@/lib/hmr-store'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'

const monarchProviderFlag = hmrFlag(HMR_SLOT_KEYS.MONACO_CANGJIE_MONARCH_PROVIDER)

const KEYWORDS = [
  'as',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'do',
  'else',
  'enum',
  'extend',
  'false',
  'finally',
  'for',
  'func',
  'if',
  'import',
  'in',
  'init',
  'interface',
  'is',
  'let',
  'macro',
  'main',
  'match',
  'package',
  'prop',
  'return',
  'spawn',
  'static',
  'struct',
  'super',
  'synchronized',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'var',
  'where',
  'while',
]

const TYPES = [
  'Bool',
  'Float16',
  'Float32',
  'Float64',
  'Int16',
  'Int32',
  'Int64',
  'Int8',
  'IntNative',
  'Nothing',
  'Option',
  'Rune',
  'String',
  'This',
  'UInt16',
  'UInt32',
  'UInt64',
  'UInt8',
  'UIntNative',
  'Unit',
  'VArray',
]

const SEMANTIC_LEGEND = {
  tokenTypes: ['keyword', 'type', 'comment', 'string', 'number'],
  tokenModifiers: [],
}

const SEMANTIC_TOKEN_TYPE = {
  keyword: 0,
  type: 1,
  comment: 2,
  string: 3,
  number: 4,
} as const

interface TokenRange {
  start: number
  end: number
  tokenType: number
}

function overlaps(ranges: TokenRange[], start: number, end: number): boolean {
  return ranges.some(range => start < range.end && end > range.start)
}

function semanticTokensForLine(line: string): TokenRange[] {
  const ranges: TokenRange[] = []
  const commentStart = line.indexOf('//')
  const codeEnd = commentStart >= 0 ? commentStart : line.length
  if (commentStart >= 0) {
    ranges.push({
      start: commentStart,
      end: line.length,
      tokenType: SEMANTIC_TOKEN_TYPE.comment,
    })
  }

  const code = line.slice(0, codeEnd)
  for (const match of code.matchAll(/"([^"\\]|\\.)*"/gu)) {
    const start = match.index
    ranges.push({
      start,
      end: start + match[0].length,
      tokenType: SEMANTIC_TOKEN_TYPE.string,
    })
  }

  for (const match of code.matchAll(/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/giu)) {
    const start = match.index
    const end = start + match[0].length
    if (!overlaps(ranges, start, end))
      ranges.push({ start, end, tokenType: SEMANTIC_TOKEN_TYPE.number })
  }

  for (const match of code.matchAll(/\b[A-Za-z_][\w$]*\b/gu)) {
    const start = match.index
    const text = match[0]
    const end = start + text.length
    if (overlaps(ranges, start, end))
      continue
    if (KEYWORDS.includes(text)) {
      ranges.push({ start, end, tokenType: SEMANTIC_TOKEN_TYPE.keyword })
    }
    else if (TYPES.includes(text)) {
      ranges.push({ start, end, tokenType: SEMANTIC_TOKEN_TYPE.type })
    }
  }

  return ranges.sort((left, right) => left.start - right.start)
}

function registerSemanticTokensProvider(languageId: string): void {
  monaco.languages.registerDocumentSemanticTokensProvider(languageId, {
    getLegend: () => SEMANTIC_LEGEND,
    provideDocumentSemanticTokens: (model) => {
      const data: number[] = []
      let previousLine = 0
      let previousStart = 0

      for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
        const line = model.getLineContent(lineNumber)
        for (const token of semanticTokensForLine(line)) {
          const lineIndex = lineNumber - 1
          const deltaLine = lineIndex - previousLine
          const deltaStart = deltaLine === 0 ? token.start - previousStart : token.start
          data.push(deltaLine, deltaStart, token.end - token.start, token.tokenType, 0)
          previousLine = lineIndex
          previousStart = token.start
        }
      }

      return { data: new Uint32Array(data), resultId: undefined }
    },
    releaseDocumentSemanticTokens: () => {},
  })
}

export function ensureCangjieMonarchTokensProvider(): void {
  if (monarchProviderFlag.get())
    return
  monarchProviderFlag.set(true)

  const knownLanguages = monaco.languages.getLanguages()
  if (!knownLanguages.some(language => language.id === CANGJIE_LANGUAGE_ID)) {
    monaco.languages.register({
      id: CANGJIE_LANGUAGE_ID,
      extensions: ['.cj'],
      aliases: ['Cangjie', CANGJIE_LANGUAGE_ID],
    })
  }
  if (!knownLanguages.some(language => language.id === CANGJIE_LANGUAGE_NAME)) {
    monaco.languages.register({
      id: CANGJIE_LANGUAGE_NAME,
      extensions: ['.cj'],
      aliases: ['Cangjie', CANGJIE_LANGUAGE_ID],
    })
  }

  const cangjieMonarchLanguage: monaco.languages.IMonarchLanguage = {
    keywords: KEYWORDS,
    typeKeywords: TYPES,
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i, 'number'],
        [/[{}()[\]]/, '@brackets'],
        [/[;,.]/, 'delimiter'],
        [/[+\-*/%=!<>|&^~?:]+/, 'operator'],
        [/[A-Z][\w$]*/, {
          cases: {
            '@typeKeywords': 'type.identifier',
            '@default': 'identifier',
          },
        }],
        [/[a-z_][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],
      ],
      comment: [
        [/[^*/]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[*/]/, 'comment'],
      ],
      string: [
        [/[^"\\]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  }

  monaco.languages.setMonarchTokensProvider(CANGJIE_LANGUAGE_ID, cangjieMonarchLanguage)
  monaco.languages.setMonarchTokensProvider(CANGJIE_LANGUAGE_NAME, cangjieMonarchLanguage)
  registerSemanticTokensProvider(CANGJIE_LANGUAGE_ID)
  registerSemanticTokensProvider(CANGJIE_LANGUAGE_NAME)
}
