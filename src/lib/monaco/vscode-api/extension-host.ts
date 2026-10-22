import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import { markEditorStartup } from '../startup-timing'

const state = hmrSlot<{ pending?: Promise<void> }>(HMR_SLOT_KEYS.LSP_EXTENSION_HOST, () => ({}))

/** Load the VS Code extension API only when the language client needs it. */
export function ensureExtensionHost(): Promise<void> {
  state.pending ??= startExtensionHost().catch((error) => {
    state.pending = undefined
    throw error
  })
  return state.pending
}

async function startExtensionHost(): Promise<void> {
  markEditorStartup('extension-host-start')
  const { defaultApi } = await import('vscode/localExtensionHost')
  if (defaultApi)
    return
  const { registerExtension, ExtensionHostKind } = await import('@codingame/monaco-vscode-api/extensions')
  // Registering a browser extension starts a local host even after the editor
  // services have initialized. Its public API backs vscode-languageclient.
  const extension = registerExtension({
    name: 'cangjie-language-client',
    publisher: 'zxilly',
    version: '1.0.0',
    engines: { vscode: '*' },
    browser: './client.js',
  }, ExtensionHostKind.LocalProcess)
  const file = extension.registerFileUrl('./client.js', 'data:text/javascript,export%20function%20activate()%20%7B%7D')
  try {
    await extension.whenReady()
    const [{ getService }, { IExtensionService }] = await Promise.all([
      import('@codingame/monaco-vscode-api'),
      import('@codingame/monaco-vscode-api/vscode/vs/workbench/services/extensions/common/extensions.service'),
    ])
    await (await getService(IExtensionService)).startExtensionHosts()
    await extension.setAsDefaultApi()
    markEditorStartup('extension-host-ready')
  }
  catch (error) {
    file.dispose()
    await extension.dispose()
    throw error
  }
}
