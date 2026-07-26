import type { SourceRequirement } from './content-packs'

function blank(character: string): string {
  return character === '\n' || character === '\r' ? character : ' '
}

/**
 * Remove comments and literals before checking structural requirements. This
 * prevents a learner from satisfying a requirement by placing fake code in a
 * comment or string while preserving offsets and line boundaries.
 */
export function structuralCangjieSource(source: string): string {
  const output = [...source]
  let index = 0
  let blockDepth = 0
  let lineComment = false
  let quote: '"' | '\'' | null = null
  let rawStringHashes = 0
  let escaped = false

  while (index < output.length) {
    const current = output[index]!
    const next = output[index + 1]

    if (lineComment) {
      output[index] = blank(current)
      if (current === '\n')
        lineComment = false
      index += 1
      continue
    }

    if (blockDepth > 0) {
      output[index] = blank(current)
      if (current === '/' && next === '*') {
        output[index + 1] = ' '
        blockDepth += 1
        index += 2
        continue
      }
      if (current === '*' && next === '/') {
        output[index + 1] = ' '
        blockDepth -= 1
        index += 2
        continue
      }
      index += 1
      continue
    }

    if (rawStringHashes > 0) {
      output[index] = blank(current)
      if (current === '"') {
        let closes = true
        for (let offset = 1; offset <= rawStringHashes; offset += 1) {
          if (output[index + offset] !== '#') {
            closes = false
            break
          }
        }
        if (closes) {
          for (let offset = 1; offset <= rawStringHashes; offset += 1)
            output[index + offset] = ' '
          index += rawStringHashes + 1
          rawStringHashes = 0
          continue
        }
      }
      index += 1
      continue
    }

    if (quote) {
      output[index] = blank(current)
      if (escaped) {
        escaped = false
      }
      else if (current === '\\') {
        escaped = true
      }
      else if (current === quote) {
        quote = null
      }
      index += 1
      continue
    }

    if (current === '/' && next === '/') {
      output[index] = ' '
      output[index + 1] = ' '
      lineComment = true
      index += 2
      continue
    }
    if (current === '/' && next === '*') {
      output[index] = ' '
      output[index + 1] = ' '
      blockDepth = 1
      index += 2
      continue
    }
    if (current === '#') {
      let hashes = 1
      while (output[index + hashes] === '#')
        hashes += 1
      if (output[index + hashes] === '"') {
        for (let offset = 0; offset <= hashes; offset += 1)
          output[index + offset] = ' '
        rawStringHashes = hashes
        index += hashes + 1
        continue
      }
    }
    if (current === '"' || current === '\'') {
      output[index] = ' '
      quote = current
    }
    index += 1
  }

  return output.join('')
}

function escapedIdentifier(identifier: string): string {
  return identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function integerLiteral(value: number): string {
  return value < 0 ? `-\\s*${Math.abs(value)}` : String(value)
}

function shadowsBuiltInCall(source: string, functionName: string): boolean {
  const name = escapedIdentifier(functionName)
  const declaration = new RegExp(
    `\\b(?:class|enum|func|interface|let|macro|struct|type|var)\\s+${name}\\b`,
    'u',
  )
  const destructuredOrParameterBinding = new RegExp(
    `\\b${name}\\s*(?::|=(?!=))`,
    'u',
  )
  const imported = new RegExp(
    `\\bimport\\b[^;\\n{}]*\\b${name}\\b`,
    'u',
  )
  return declaration.test(source)
    || destructuredOrParameterBinding.test(source)
    || imported.test(source)
}

function hasUnqualifiedIdentifierCall(
  mainBody: string,
  functionName: string,
  argumentName: string,
): boolean {
  const call = new RegExp(
    `\\b${escapedIdentifier(functionName)}\\s*`
    + `\\(\\s*${escapedIdentifier(argumentName)}\\s*\\)`,
    'gu',
  )
  for (const match of mainBody.matchAll(call)) {
    let previousIndex = match.index - 1
    while (previousIndex >= 0 && /\s/u.test(mainBody[previousIndex]!))
      previousIndex -= 1
    const previous = mainBody[previousIndex]
    // Member, optional-chain, namespace, and macro-qualified calls are not a
    // call to the unqualified built-in named by this requirement.
    if (previous === '.' || previous === '?' || previous === ':' || previous === '@')
      continue
    return true
  }
  return false
}

function topLevelMainBody(source: string): string | null {
  let braceDepth = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '}') {
      braceDepth -= 1
      if (braceDepth < 0)
        return null
      continue
    }
    if (character === '{') {
      braceDepth += 1
      continue
    }
    if (braceDepth !== 0 || !source.startsWith('main', index))
      continue

    const before = source[index - 1]
    const after = source[index + 4]
    if ((before && /[\p{L}\p{N}_]/u.test(before)) || (after && /[\p{L}\p{N}_]/u.test(after)))
      continue

    const signature
      = /^main\s*\(\s*\)\s*(?::\s*(?:Int64|Unit)\s*)?\{/u.exec(
        source.slice(index),
      )
    if (!signature)
      continue

    const bodyStart = index + signature[0].length
    let bodyDepth = 1
    for (let bodyIndex = bodyStart; bodyIndex < source.length; bodyIndex += 1) {
      if (source[bodyIndex] === '{')
        bodyDepth += 1
      else if (source[bodyIndex] === '}')
        bodyDepth -= 1
      if (bodyDepth === 0)
        return source.slice(bodyStart, bodyIndex)
    }
    return null
  }
  return null
}

/**
 * Evidence requirements describe statements that must execute on every normal
 * path through these introductory exercises. Matching text inside a branch,
 * loop, lambda, or after an early control-flow statement would let dead code
 * satisfy the rubric while a hard-coded output passed the runtime check.
 *
 * The current requirement vocabulary intentionally covers only straight-line
 * introductory tasks. A future control-flow exercise needs a semantic
 * requirement of its own instead of weakening this mandatory-prefix rule.
 */
function mandatoryMainPrefix(mainBody: string): string {
  const output = [...mainBody]
  let nestedBraceDepth = 0
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index]!
    if (character === '{') {
      nestedBraceDepth += 1
      output[index] = ' '
      continue
    }
    if (character === '}') {
      if (nestedBraceDepth > 0)
        nestedBraceDepth -= 1
      output[index] = ' '
      continue
    }
    if (nestedBraceDepth > 0)
      output[index] = blank(character)
  }

  const topLevel = output.join('')
  const controlFlow = /\b(?:break|continue|do|for|if|match|return|throw|try|while)\b/u
    .exec(topLevel)
  return controlFlow ? topLevel.slice(0, controlFlow.index) : topLevel
}

function satisfiesRequirement(
  mainBody: string,
  structuralSource: string,
  requirement: SourceRequirement,
): boolean {
  switch (requirement.type) {
    case 'top_level_main':
      return true
    case 'binding': {
      const binding = escapedIdentifier(requirement.binding)
      const name = escapedIdentifier(requirement.name)
      return new RegExp(`\\b${binding}\\s+${name}\\b`, 'u').test(mainBody)
    }
    case 'call_identifier': {
      return !shadowsBuiltInCall(
        structuralSource,
        requirement.functionName,
      ) && hasUnqualifiedIdentifierCall(
        mainBody,
        requirement.functionName,
        requirement.argumentName,
      )
    }
    case 'reassignment': {
      const name = escapedIdentifier(requirement.name)
      const declaration = new RegExp(`\\b(?:let|var)\\s+${name}\\b`, 'u')
        .exec(mainBody)
      if (!declaration)
        return false
      const afterDeclaration = mainBody.slice(declaration.index + declaration[0].length)
      return new RegExp(
        `\\b${name}\\s*(?:\\+=|-=|\\*=|\\/=|%=|=(?!=))`,
        'u',
      ).test(afterDeclaration)
    }
    case 'integer_binding': {
      const binding = escapedIdentifier(requirement.binding)
      const name = escapedIdentifier(requirement.name)
      const value = integerLiteral(requirement.value)
      return new RegExp(
        `\\b${binding}\\s+${name}(?:\\s*:\\s*[A-Za-z_]\\w*)?\\s*=\\s*${value}\\b`,
        'u',
      ).test(mainBody)
    }
    case 'binary_integer_binding': {
      const binding = escapedIdentifier(requirement.binding)
      const name = escapedIdentifier(requirement.name)
      const leftName = escapedIdentifier(requirement.leftName)
      const operator = escapedIdentifier(requirement.operator)
      const rightValue = integerLiteral(requirement.rightValue)
      return new RegExp(
        `\\b${binding}\\s+${name}(?:\\s*:\\s*[A-Za-z_]\\w*)?\\s*=\\s*`
        + `${leftName}\\s*${operator}\\s*${rightValue}\\b`,
        'u',
      ).test(mainBody)
    }
    case 'add_integer_reassignment': {
      const name = escapedIdentifier(requirement.name)
      const amount = integerLiteral(requirement.amount)
      return new RegExp(
        `\\b${name}\\s*(?:\\+=\\s*${amount}\\b`
        + `|=\\s*${name}\\s*\\+\\s*${amount}\\b)`,
        'u',
      ).test(mainBody)
    }
  }
}

export function satisfiesSourceRequirements(
  source: string,
  requirements: readonly SourceRequirement[],
): boolean {
  const structuralSource = structuralCangjieSource(source)
  const mainBody = topLevelMainBody(structuralSource)
  if (mainBody === null)
    return false
  const mandatoryPrefix = mandatoryMainPrefix(mainBody)
  return requirements.every(requirement =>
    satisfiesRequirement(mandatoryPrefix, structuralSource, requirement))
}
