import type * as monaco from '@codingame/monaco-vscode-editor-api'

export type ViewsServiceType = 'EditorService' | 'ViewsService'

// The global `MonacoEnvironment` object doubles as our cross-editor init
// coordinator. monaco reads `getWorker` off it; we additionally hang the
// one-time vscode-api init state on it so multiple editors on one page boot
// the global services exactly once.
export interface MonacoEnvironmentEnhanced extends monaco.Environment {
  vscodeApiInitialising?: boolean
  vscodeApiInitialised?: boolean
  vscodeApiServicesInitialised?: boolean
  vscodeApiViewsInitialised?: boolean
  vscodeApiExtensionsInitialised?: boolean
  vscodeApiViewsType?: ViewsServiceType
  vscodeApiGlobalInitAwait?: Promise<void>
  vscodeApiGlobalInitResolve?: (value: void | PromiseLike<void>) => void
}

export function getEnhancedMonacoEnvironment(): MonacoEnvironmentEnhanced {
  if (typeof MonacoEnvironment === 'undefined') {
    globalThis.MonacoEnvironment = {}
  }
  const env = MonacoEnvironment as MonacoEnvironmentEnhanced
  env.vscodeApiInitialising ??= false
  env.vscodeApiInitialised ??= false
  env.vscodeApiServicesInitialised ??= false
  env.vscodeApiViewsInitialised ??= false
  env.vscodeApiExtensionsInitialised ??= false
  return env
}

export function mergeServices(
  target: monaco.editor.IEditorOverrideServices,
  services?: monaco.editor.IEditorOverrideServices,
): void {
  if (services) {
    for (const [name, service] of Object.entries(services)) {
      target[name] = service
    }
  }
}
