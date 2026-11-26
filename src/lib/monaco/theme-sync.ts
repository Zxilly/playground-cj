export const DARK_COLOR_THEME = 'Default Dark Modern'
export const LIGHT_COLOR_THEME = 'Default Light Modern'

const THEME_SYNC_KEY = Symbol.for('playground-cj.monaco-theme-sync')

interface ThemeSyncState {
  observer: MutationObserver | null
  lastRequestedTheme: string | null
  pendingUpdate: Promise<void>
}

function getThemeSyncState(): ThemeSyncState {
  const g = globalThis as unknown as { [k: symbol]: ThemeSyncState | undefined }
  let state = g[THEME_SYNC_KEY]
  if (!state) {
    state = {
      observer: null,
      lastRequestedTheme: null,
      pendingUpdate: Promise.resolve(),
    }
    g[THEME_SYNC_KEY] = state
  }
  return state
}

export function resolveDocumentColorTheme(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
    return DARK_COLOR_THEME
  return LIGHT_COLOR_THEME
}

async function applyThemeToUserConfiguration(theme: string): Promise<void> {
  const { getUserConfiguration, updateUserConfiguration } = await import('@codingame/monaco-vscode-configuration-service-override')
  let parsed: Record<string, unknown> = {}
  try {
    const raw = await getUserConfiguration()
    if (raw)
      parsed = JSON.parse(raw) as Record<string, unknown>
  }
  catch {
    parsed = {}
  }
  if (parsed['workbench.colorTheme'] === theme && parsed['window.autoDetectColorScheme'] === false)
    return
  parsed['window.autoDetectColorScheme'] = false
  parsed['workbench.colorTheme'] = theme
  await updateUserConfiguration(JSON.stringify(parsed))
}

export function syncMonacoColorTheme(theme = resolveDocumentColorTheme()): Promise<void> {
  const state = getThemeSyncState()
  if (state.lastRequestedTheme === theme)
    return state.pendingUpdate
  state.lastRequestedTheme = theme
  state.pendingUpdate = state.pendingUpdate
    .then(() => applyThemeToUserConfiguration(theme))
    .catch((error) => {
      // Allow a future sync attempt if services were not ready yet.
      if (state.lastRequestedTheme === theme)
        state.lastRequestedTheme = null
      console.debug('[monaco] theme sync skipped:', error)
    })
  return state.pendingUpdate
}

/**
 * Keeps Monaco's `workbench.colorTheme` synchronized with `document.documentElement`'s
 * `.dark` class (the single site-wide theme source) rather than OS media queries.
 */
export function ensureMonacoThemeSync(): void {
  if (typeof document === 'undefined')
    return

  void syncMonacoColorTheme(resolveDocumentColorTheme())

  const state = getThemeSyncState()
  if (state.observer || typeof MutationObserver === 'undefined')
    return

  const observer = new MutationObserver(() => {
    void syncMonacoColorTheme(resolveDocumentColorTheme())
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  state.observer = observer
}

import.meta.webpackHot?.accept()
