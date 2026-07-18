import * as monaco from '@codingame/monaco-vscode-editor-api'
import { HMR_SLOT_KEYS, hmrFlag } from '@/lib/hmr-store'
import { CANGJIE_LANGUAGE_ID } from './language'

const completionProviderFlag = hmrFlag(HMR_SLOT_KEYS.MONACO_CANGJIE_COMPLETION_PROVIDER)

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
] as const

const CORE_TYPES = [
  'Bool',
  'Float16',
  'Float32',
  'Float64',
  'Int8',
  'Int16',
  'Int32',
  'Int64',
  'IntNative',
  'Nothing',
  'Option',
  'Rune',
  'String',
  'UInt8',
  'UInt16',
  'UInt32',
  'UInt64',
  'UIntNative',
  'Unit',
] as const

const BUILT_INS = ['print', 'println', 'readln'] as const

/**
 * Extract learner-defined names from the current buffer. The browser Cangjie
 * server still owns diagnostics, hover and navigation; these local names keep
 * completion useful when the embedded server returns no completion list.
 */
export function extractCangjieIdentifiers(source: string): string[] {
  const names = new Set<string>()
  for (const match of source.matchAll(/\b(?:let|var|func|class|struct|enum|interface)\s+([A-Za-z_]\w*)/gu))
    names.add(match[1])
  return [...names]
}

function completion(
  label: string,
  kind: monaco.languages.CompletionItemKind,
  range: monaco.IRange,
  sortGroup: string,
  detail: string,
): monaco.languages.CompletionItem {
  return {
    label,
    insertText: label,
    kind,
    range,
    sortText: `${sortGroup}-${label}`,
    detail,
  }
}

export function createCangjieCompletionProvider(): monaco.languages.CompletionItemProvider {
  return {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const suggestions = [
        ...extractCangjieIdentifiers(model.getValue()).map(label =>
          completion(label, monaco.languages.CompletionItemKind.Variable, range, '0', '当前文件中的符号')),
        ...KEYWORDS.map(label =>
          completion(label, monaco.languages.CompletionItemKind.Keyword, range, '1', '仓颉关键字')),
        ...CORE_TYPES.map(label =>
          completion(label, monaco.languages.CompletionItemKind.Class, range, '2', '仓颉核心类型')),
        ...BUILT_INS.map(label =>
          completion(label, monaco.languages.CompletionItemKind.Function, range, '3', '仓颉常用函数')),
      ]

      return { suggestions }
    },
  }
}

export function ensureCangjieCompletionProvider(): void {
  if (completionProviderFlag.get())
    return
  completionProviderFlag.set(true)
  monaco.languages.registerCompletionItemProvider(
    CANGJIE_LANGUAGE_ID,
    createCangjieCompletionProvider(),
  )
}
