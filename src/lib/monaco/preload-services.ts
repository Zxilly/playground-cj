// Start independent downloads at the editor import boundary, rather than after
// the large VS Code module graph has finished evaluating. Call only after NLS.
let pending: Promise<unknown> | undefined

export function preloadEditorServices(): Promise<unknown> {
  pending ??= Promise.all([
    import('@codingame/monaco-vscode-languages-service-override'),
    import('@codingame/monaco-vscode-textmate-service-override'),
    import('@codingame/monaco-vscode-theme-service-override'),
    import('@codingame/monaco-vscode-editor-service-override'),
    import('@codingame/monaco-vscode-extensions-service-override'),
    import('@codingame/monaco-vscode-theme-defaults-default-extension'),
  ]).catch((error) => {
    pending = undefined
    throw error
  })
  return pending
}
