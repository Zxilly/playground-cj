// Page-scoped milestones, available to DevTools and the startup benchmark.
// Remounts must not overwrite the first editor's cold-start measurements.
export function markEditorStartup(phase: string): void {
  if (typeof performance === 'undefined')
    return
  const name = `cj:editor:${phase}`
  if (performance.getEntriesByName(name).length === 0)
    performance.mark(name)
}
