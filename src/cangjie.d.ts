declare module '*.cj' {
  const value: any
  export default value
}

declare module '*.md' {
  const value: string
  export default value
}

declare module '@codingame/monaco-vscode-views-service-override'

// Injected by webpack DefinePlugin (next.config.ts).
declare const __CJO_TARGET__: string
declare const __CJO_MODULES__: readonly string[]
