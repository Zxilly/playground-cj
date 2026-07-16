import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'

export interface DisposableModelResource {
  dispose: () => void
  isDisposed?: () => boolean
}

interface ModelEntry<TResource extends DisposableModelResource> {
  resource: TResource
  owned: boolean
  references: number
  retainWhenUnused: boolean
  scope?: string
  disposeRequested: boolean
}

export interface ModelLease<TResource> {
  resource: TResource
  release: () => void
}

interface AcquireOptions {
  scope?: string
  retainWhenUnused?: boolean
}

/** Reference-counted ownership for Monaco models, kept generic for unit tests. */
export class ModelLeaseRegistry<TResource extends DisposableModelResource> {
  private readonly entries = new Map<string, ModelEntry<TResource>>()
  private readonly scopes = new Map<string, number>()

  acquire(
    key: string,
    create: () => { resource: TResource, owned: boolean },
    options: AcquireOptions = {},
  ): ModelLease<TResource> {
    let entry = this.entries.get(key)
    if (entry?.resource.isDisposed?.()) {
      this.entries.delete(key)
      entry = undefined
    }
    if (!entry) {
      const created = create()
      entry = {
        ...created,
        references: 0,
        retainWhenUnused: options.retainWhenUnused === true,
        scope: options.scope,
        disposeRequested: false,
      }
      this.entries.set(key, entry)
    }
    else {
      if (entry.scope && options.scope && entry.scope !== options.scope)
        throw new Error(`Monaco model ${key} cannot belong to multiple lifecycle scopes`)
      entry.scope ??= options.scope
      entry.retainWhenUnused ||= options.retainWhenUnused === true
    }

    if (entry.scope && (this.scopes.get(entry.scope) ?? 0) > 0)
      entry.disposeRequested = false
    entry.references += 1
    let released = false
    return {
      resource: entry.resource,
      release: () => {
        if (released)
          return
        released = true
        entry!.references = Math.max(0, entry!.references - 1)
        this.disposeIfUnused(key, entry!)
      },
    }
  }

  retainScope(scope: string): () => void {
    const previous = this.scopes.get(scope) ?? 0
    this.scopes.set(scope, previous + 1)
    if (previous === 0) {
      for (const entry of this.entries.values()) {
        if (entry.scope === scope)
          entry.disposeRequested = false
      }
    }

    let released = false
    return () => {
      if (released)
        return
      released = true
      const next = Math.max(0, (this.scopes.get(scope) ?? 1) - 1)
      if (next > 0) {
        this.scopes.set(scope, next)
        return
      }
      this.scopes.delete(scope)
      for (const [key, entry] of this.entries) {
        if (entry.scope !== scope)
          continue
        entry.disposeRequested = true
        this.disposeIfUnused(key, entry)
      }
    }
  }

  disposeAll(): void {
    this.scopes.clear()
    for (const [key, entry] of this.entries) {
      entry.disposeRequested = true
      this.disposeIfUnused(key, entry)
    }
  }

  private disposeIfUnused(key: string, entry: ModelEntry<TResource>): void {
    if (entry.references > 0)
      return
    if (entry.retainWhenUnused && !entry.disposeRequested)
      return
    this.entries.delete(key)
    if (entry.owned && !entry.resource.isDisposed?.())
      entry.resource.dispose()
  }
}

const modelRegistry = hmrSlot(
  HMR_SLOT_KEYS.MONACO_MODEL_REGISTRY,
  () => new ModelLeaseRegistry<DisposableModelResource>(),
)

export function acquireModel<TResource extends DisposableModelResource>(
  key: string,
  create: () => { resource: TResource, owned: boolean },
  options: AcquireOptions = {},
): ModelLease<TResource> {
  return modelRegistry.acquire(key, create, options) as ModelLease<TResource>
}

export function retainModelScope(scope: string): () => void {
  return modelRegistry.retainScope(scope)
}

if (typeof window !== 'undefined') {
  const state = hmrSlot(HMR_SLOT_KEYS.MONACO_MODEL_PAGE_CLEANUP, () => ({ installed: false }))
  if (!state.installed) {
    state.installed = true
    window.addEventListener('pagehide', (event) => {
      // A bfcache page remains live and may be restored with its editors intact.
      if (!event.persisted)
        modelRegistry.disposeAll()
    })
  }
}

import.meta.webpackHot?.accept()
