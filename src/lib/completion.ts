import * as monaco from 'monaco-editor'

export const cangjieCompletionProvider: monaco.languages.CompletionItemProvider = {
  triggerCharacters: ['.', '@', ':', '$'],

  provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position): monaco.languages.ProviderResult<monaco.languages.CompletionList> {
    const wordUntilPosition = model.getWordUntilPosition(position)
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: wordUntilPosition.startColumn,
      endColumn: wordUntilPosition.endColumn,
    }

    const lineContent = model.getLineContent(position.lineNumber)
    const textUntilPosition = lineContent.slice(0, position.column - 1)

    let suggestions: monaco.languages.CompletionItem[] = []

    if (textUntilPosition.endsWith('.')) {
      suggestions = suggestions.concat(memberAccessSuggestions(range))
    }
    else if (textUntilPosition.endsWith('@')) {
      suggestions = suggestions.concat(annotationSuggestions(range))
    }
    else if (textUntilPosition.endsWith(':')) {
      suggestions = suggestions.concat(typeSuggestions(range))
    }
    else {
      suggestions = suggestions.concat([
        ...keywordSuggestions(range),
        ...typeSuggestions(range),
        ...operatorSuggestions(range),
        ...primitiveTypeSuggestions(range),
        ...functionSuggestions(range),
        ...variableSuggestions(model, position, range),
      ])
    }

    return { suggestions }
  },
}

function keywordSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const keywords = [
    'package',
    'import',
    'class',
    'interface',
    'func',
    'let',
    'var',
    'const',
    'type',
    'init',
    'this',
    'super',
    'if',
    'else',
    'case',
    'try',
    'catch',
    'finally',
    'for',
    'do',
    'while',
    'throw',
    'return',
    'continue',
    'break',
    'is',
    'as',
    'in',
    'match',
    'from',
    'where',
    'extend',
    'spawn',
    'synchronized',
    'macro',
    'quote',
    'true',
    'false',
    'static',
    'public',
    'private',
    'protected',
    'override',
    'abstract',
    'open',
    'operator',
    'foreign',
    'struct',
    'enum',
    'prop',
    'get',
    'set',
    'inout',
    'mut',
    'unsafe',
  ]

  return keywords.map(keyword => ({
    label: keyword,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: keyword,
    range,
  }))
}

function typeSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const types = [
    'Int8',
    'Int16',
    'Int32',
    'Int64',
    'IntNative',
    'UInt8',
    'UInt16',
    'UInt32',
    'UInt64',
    'UIntNative',
    'Float16',
    'Float32',
    'Float64',
    'Rune',
    'Bool',
    'Unit',
    'Nothing',
    'This',
  ]

  return types.map(type => ({
    label: type,
    kind: monaco.languages.CompletionItemKind.Class,
    insertText: type,
    range,
  }))
}

function operatorSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const operators = [
    '+',
    '-',
    '*',
    '/',
    '%',
    '**',
    '++',
    '--',
    '&&',
    '||',
    '!',
    '&',
    '|',
    '~',
    '^',
    '<<',
    '>>',
    '<',
    '>',
    '<=',
    '>=',
    '==',
    '!=',
    '=',
    '+=',
    '-=',
    '*=',
    '/=',
    '%=',
    '**=',
    '&=',
    '|=',
    '^=',
    '<<=',
    '>>=',
    '->',
    '<-',
    '=>',
    '...',
    '..=',
    '..',
    '|>',
    '~>',
    '<:',
    '?',
  ]

  return operators.map(op => ({
    label: op,
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: op,
    range,
  }))
}

function primitiveTypeSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const primitiveTypes = ['Int', 'Float', 'Bool', 'String', 'Char', 'Array', 'Tuple']

  return primitiveTypes.map(type => ({
    label: type,
    kind: monaco.languages.CompletionItemKind.Struct,
    insertText: type,
    range,
  }))
}

function memberAccessSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const members = ['length', 'toString', 'hashCode']

  return members.map(member => ({
    label: member,
    kind: monaco.languages.CompletionItemKind.Method,
    insertText: member,
    range,
  }))
}

function annotationSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const annotations = ['Deprecated', 'Override', 'Test', 'Throws']

  return annotations.map(annotation => ({
    label: annotation,
    kind: monaco.languages.CompletionItemKind.Enum,
    insertText: annotation,
    range,
  }))
}

function functionSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const commonFunctions = ['print', 'println', 'assert', 'map', 'filter', 'reduce']

  return commonFunctions.map(func => ({
    label: func,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: `${func}($0)`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
  }))
}

function variableSuggestions(model: monaco.editor.ITextModel, position: monaco.Position, range: monaco.IRange): monaco.languages.CompletionItem[] {
  const lineContent = model.getLineContent(position.lineNumber)
  const variableRegex = /\b(let|var|const)\s+(\w+)/g
  const variables: string[] = []
  let match = variableRegex.exec(lineContent)

  while (match !== null) {
    variables.push(match[2])
    match = variableRegex.exec(lineContent)
  }

  return variables.map(variable => ({
    label: variable,
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: variable,
    range,
  }))
}
