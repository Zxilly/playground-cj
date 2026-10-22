/** Extract rendered literals from Lingui's compiled message tokens. */
export function catalogCharacters(messages) {
  const characters = new Set()
  function visit(message) {
    if (typeof message === 'string') {
      for (const character of message) characters.add(character.codePointAt(0))
      return
    }
    for (const token of message) {
      if (typeof token === 'string') {
        visit(token)
      }
      else if (Array.isArray(token) && ['plural', 'selectordinal', 'select'].includes(token[1])) {
        for (const branch of Object.values(token[2])) {
          if (Array.isArray(branch) || typeof branch === 'string') visit(branch)
        }
      }
    }
  }
  for (const message of Object.values(messages)) visit(message)
  return [...characters].sort((a, b) => a - b)
}

export function unicodeRange(points) {
  const ranges = []
  for (const point of points) {
    const previous = ranges.at(-1)
    if (previous && point === previous[1] + 1) previous[1] = point
    else ranges.push([point, point])
  }
  return ranges.map(([start, end]) => `U+${start.toString(16)}${start === end ? '' : `-${end.toString(16)}`}`).join(',')
}

/** Disjoint subsets preserve the complete source cmap without a full-font fallback. */
export function planSubsets(characterSet, catalogs) {
  const remaining = new Set(characterSet)
  const subsets = []
  function take(name, candidates) {
    const points = candidates.filter(point => remaining.delete(point)).sort((a, b) => a - b)
    if (points.length) subsets.push({ name, points })
  }
  take('latin', characterSet.filter(point => point <= 0xFF))
  for (const [locale, points] of Object.entries(catalogs).sort(([a], [b]) => a.localeCompare(b))) {
    take(`ui-${locale}`, points)
  }
  const pages = new Map()
  for (const point of [...remaining].sort((a, b) => a - b)) {
    const page = Math.floor(point / 512)
    if (!pages.has(page)) pages.set(page, [])
    pages.get(page).push(point)
  }
  for (const [page, points] of pages) take(`range-${page.toString(16)}`, points)
  return subsets
}
