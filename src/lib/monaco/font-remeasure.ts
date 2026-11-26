import * as monaco from '@codingame/monaco-vscode-editor-api'

const FONT_REMEASURE_KEY = Symbol.for('playground-cj.monaco-font-remeasure')
const REMEASURE_DEBOUNCE_MS = 100

interface FontRemeasureState {
  installed: boolean
  timer: ReturnType<typeof setTimeout> | null
}

function getFontRemeasureState(): FontRemeasureState {
  const g = globalThis as unknown as { [k: symbol]: FontRemeasureState | undefined }
  let state = g[FONT_REMEASURE_KEY]
  if (!state) {
    state = { installed: false, timer: null }
    g[FONT_REMEASURE_KEY] = state
  }
  return state
}

function safeRemeasureFonts(): void {
  try {
    monaco.editor.remeasureFonts()
  }
  catch {
    // Ignore if called in environments without a live Monaco font cache.
  }
}

/**
 * Web fonts use `display: swap` and unicode-range subsets (e.g. CJK chunks
 * load lazily on first Chinese glyph). Remeasuring after initial readiness and
 * subsequent `loadingdone` events prevents cursor/selection drift.
 */
export function ensureMonacoFontRemeasure(): void {
  if (typeof document === 'undefined' || !('fonts' in document) || !document.fonts)
    return

  const state = getFontRemeasureState()
  if (state.installed)
    return
  state.installed = true

  void document.fonts.ready.then(() => {
    safeRemeasureFonts()
  }).catch(() => undefined)

  if (typeof document.fonts.addEventListener === 'function') {
    document.fonts.addEventListener('loadingdone', () => {
      if (state.timer !== null)
        clearTimeout(state.timer)
      state.timer = setTimeout(() => {
        state.timer = null
        safeRemeasureFonts()
      }, REMEASURE_DEBOUNCE_MS)
    })
  }
}

import.meta.webpackHot?.accept()
