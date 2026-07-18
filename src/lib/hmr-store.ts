// Holds module-level mutable state on globalThis so it survives Webpack/Next.js
// HMR module re-evaluation. Without this, every HMR boundary that touches a
// Monaco/LSP module resets singletons (workers, output channels, command
// registrations, the live LSP connection), even though the underlying browser
// state still exists — producing duplicate registrations and orphan workers.

const STORE_KEY = Symbol.for('playground-cj.hmr-store')

interface Slot<T> {
  value: T
}

interface Store {
  slots: Map<string, Slot<unknown>>
}

function getStore(): Store {
  const g = globalThis as unknown as { [k: symbol]: Store | undefined }
  let store = g[STORE_KEY]
  if (!store) {
    store = { slots: new Map() }
    g[STORE_KEY] = store
  }
  return store
}

export function hmrSlot<T>(key: string, factory: () => T): T {
  const store = getStore()
  let slot = store.slots.get(key) as Slot<T> | undefined
  if (!slot) {
    slot = { value: factory() }
    store.slots.set(key, slot)
  }
  return slot.value
}

export function hmrFlag(key: string): { get: () => boolean, set: (v: boolean) => void } {
  const slot = hmrSlot(`flag:${key}`, () => ({ value: false }))
  return {
    get: () => slot.value,
    set: (v: boolean) => {
      slot.value = v
    },
  }
}

// Centralized slot keys so HMR-persisted state is discoverable from one place
// and typos can't silently fork into a fresh empty slot.
export const HMR_SLOT_KEYS = {
  LSP_STATE: 'lsp.state',
  LSP_OUTPUT_CHANNEL: 'lsp.outputChannel',
  LSP_COMMAND_REGISTRATION: 'lsp.commandRegistration',
  LSP_LANGUAGE_CLIENT: 'lsp.languageClient',
  LSP_SERVICE_LEASES: 'lsp.serviceLeases',
  MONACO_CANGJIE_FORMATTING_PROVIDER: 'monaco.cangjieFormattingProvider',
  MONACO_CANGJIE_MONARCH_PROVIDER: 'monaco.cangjieMonarchProvider',
  MONACO_CANGJIE_COMPLETION_PROVIDER: 'monaco.cangjieCompletionProvider',
  MONACO_MODEL_REGISTRY: 'monaco.modelRegistry',
  MONACO_MODEL_PAGE_CLEANUP: 'monaco.modelPageCleanup',
} as const

declare global {
  interface ImportMeta {
    webpackHot?: {
      accept: ((cb?: () => void) => void) & ((deps: string | string[], cb?: () => void) => void)
      decline: () => void
    }
  }
}

import.meta.webpackHot?.accept()
