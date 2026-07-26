/**
 * Browser-safe canonical JSON for persisted identities and structural
 * comparisons. Object keys are sorted and `undefined` properties are omitted
 * in the same way everywhere that consumes Course Content Packs.
 */
export function canonicalJson(value: unknown): string {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || typeof value === 'number'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, entry]) =>
      `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`)
}
