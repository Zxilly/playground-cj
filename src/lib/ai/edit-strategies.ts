// Multi-strategy textual replacement, ported from opencode
// (T:\opencode\packages\opencode\src\tool\edit.ts), which itself sourced from:
//   https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-23-25.ts
//   https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/editCorrector.ts
//   https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-26-25.ts
//
// Differences from opencode: pure string operations, no Effect/file IO/BOM/CRLF
// handling. Monaco normalizes to "\n" internally so callers don't need to
// convert line endings.

export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.3
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3

function levenshtein(a: string, b: string): number {
  if (a === '' || b === '')
    return Math.max(a.length, b.length)

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split('\n')
  const searchLines = find.split('\n')

  if (searchLines[searchLines.length - 1] === '')
    searchLines.pop()

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false
        break
      }
    }

    if (matches) {
      let matchStartIndex = 0
      for (let k = 0; k < i; k++)
        matchStartIndex += originalLines[k].length + 1

      let matchEndIndex = matchStartIndex
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length
        if (k < searchLines.length - 1)
          matchEndIndex += 1
      }

      yield content.substring(matchStartIndex, matchEndIndex)
    }
  }
}

export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split('\n')
  const searchLines = find.split('\n')

  if (searchLines.length < 3)
    return

  if (searchLines[searchLines.length - 1] === '')
    searchLines.pop()

  const firstLineSearch = searchLines[0].trim()
  const lastLineSearch = searchLines[searchLines.length - 1].trim()
  const searchBlockSize = searchLines.length

  const candidates: { startLine: number, endLine: number }[] = []
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch)
      continue

    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j })
        break
      }
    }
  }

  if (candidates.length === 0)
    return

  const yieldRange = (startLine: number, endLine: number) => {
    let matchStartIndex = 0
    for (let k = 0; k < startLine; k++)
      matchStartIndex += originalLines[k].length + 1
    let matchEndIndex = matchStartIndex
    for (let k = startLine; k <= endLine; k++) {
      matchEndIndex += originalLines[k].length
      if (k < endLine)
        matchEndIndex += 1
    }
    return content.substring(matchStartIndex, matchEndIndex)
  }

  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0]
    const actualBlockSize = endLine - startLine + 1
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

    let similarity = 0
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0)
          continue
        const distance = levenshtein(originalLine, searchLine)
        similarity += (1 - distance / maxLen) / linesToCheck
        if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD)
          break
      }
    }
    else {
      similarity = 1.0
    }

    if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD)
      yield yieldRange(startLine, endLine)
    return
  }

  let bestMatch: { startLine: number, endLine: number } | null = null
  let maxSimilarity = -1

  for (const candidate of candidates) {
    const { startLine, endLine } = candidate
    const actualBlockSize = endLine - startLine + 1
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

    let similarity = 0
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0)
          continue
        const distance = levenshtein(originalLine, searchLine)
        similarity += 1 - distance / maxLen
      }
      similarity /= linesToCheck
    }
    else {
      similarity = 1.0
    }

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      bestMatch = candidate
    }
  }

  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch)
    yield yieldRange(bestMatch.startLine, bestMatch.endLine)
}

export const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim()
  const normalizedFind = normalizeWhitespace(find)

  const lines = content.split('\n')
  for (const line of lines) {
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line
    }
    else {
      const normalizedLine = normalizeWhitespace(line)
      if (normalizedLine.includes(normalizedFind)) {
        const words = find.trim().split(/\s+/)
        if (words.length > 0) {
          const pattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
          try {
            const regex = new RegExp(pattern)
            const match = line.match(regex)
            if (match)
              yield match[0]
          }
          catch {
            // invalid regex, skip
          }
        }
      }
    }
  }

  const findLines = find.split('\n')
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length)
      if (normalizeWhitespace(block.join('\n')) === normalizedFind)
        yield block.join('\n')
    }
  }
}

export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const ls = text.split('\n')
    const nonEmpty = ls.filter(l => l.trim().length > 0)
    if (nonEmpty.length === 0)
      return text

    const minIndent = Math.min(
      ...nonEmpty.map((l) => {
        const m = l.match(/^(\s*)/)
        return m ? m[1].length : 0
      }),
    )

    return ls.map(l => (l.trim().length === 0 ? l : l.slice(minIndent))).join('\n')
  }

  const normalizedFind = removeIndentation(find)
  const contentLines = content.split('\n')
  const findLines = find.split('\n')

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join('\n')
    if (removeIndentation(block) === normalizedFind)
      yield block
  }
}

export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescapeString = (str: string): string =>
    str.replace(/\\([ntr'"`\\\n$])/g, (match, captured) => {
      switch (captured) {
        case 'n': return '\n'
        case 't': return '\t'
        case 'r': return '\r'
        case '\'': return '\''
        case '"': return '"'
        case '`': return '`'
        case '\\': return '\\'
        case '\n': return '\n'
        case '$': return '$'
        default: return match
      }
    })

  const unescapedFind = unescapeString(find)

  if (content.includes(unescapedFind))
    yield unescapedFind

  const lines = content.split('\n')
  const findLines = unescapedFind.split('\n')

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join('\n')
    const unescapedBlock = unescapeString(block)
    if (unescapedBlock === unescapedFind)
      yield block
  }
}

export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim()
  if (trimmedFind === find)
    return

  if (content.includes(trimmedFind))
    yield trimmedFind

  const lines = content.split('\n')
  const findLines = find.split('\n')

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join('\n')
    if (block.trim() === trimmedFind)
      yield block
  }
}

export const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split('\n')
  if (findLines.length < 3)
    return

  if (findLines[findLines.length - 1] === '')
    findLines.pop()

  const contentLines = content.split('\n')
  const firstLine = findLines[0].trim()
  const lastLine = findLines[findLines.length - 1].trim()

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() !== firstLine)
      continue

    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j].trim() === lastLine) {
        const blockLines = contentLines.slice(i, j + 1)
        if (blockLines.length === findLines.length) {
          let matchingLines = 0
          let totalNonEmpty = 0

          for (let k = 1; k < blockLines.length - 1; k++) {
            const bl = blockLines[k].trim()
            const fl = findLines[k].trim()
            if (bl.length > 0 || fl.length > 0) {
              totalNonEmpty++
              if (bl === fl)
                matchingLines++
            }
          }

          if (totalNonEmpty === 0 || matchingLines / totalNonEmpty >= 0.5) {
            yield blockLines.join('\n')
            break
          }
        }
        break
      }
    }
  }
}

export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0
  while (true) {
    const index = content.indexOf(find, startIndex)
    if (index === -1)
      break
    yield find
    startIndex = index + find.length
  }
}

export function replace(content: string, oldString: string, newString: string, replaceAll = false): string {
  if (oldString === newString)
    throw new Error('No changes to apply: oldString and newString are identical.')

  let notFound = true

  for (const replacer of [
    SimpleReplacer,
    LineTrimmedReplacer,
    BlockAnchorReplacer,
    WhitespaceNormalizedReplacer,
    IndentationFlexibleReplacer,
    EscapeNormalizedReplacer,
    TrimmedBoundaryReplacer,
    ContextAwareReplacer,
    MultiOccurrenceReplacer,
  ]) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search)
      if (index === -1)
        continue
      notFound = false
      if (replaceAll)
        return content.replaceAll(search, newString)
      const lastIndex = content.lastIndexOf(search)
      if (index !== lastIndex)
        continue
      return content.substring(0, index) + newString + content.substring(index + search.length)
    }
  }

  if (notFound)
    throw new Error('Could not find oldString in the content. It must match exactly, including whitespace, indentation, and line endings.')

  throw new Error('Found multiple matches for oldString. Provide more surrounding context to make the match unique.')
}
