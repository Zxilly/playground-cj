# cangjie-editor module

`components/` contains the Monaco editor shell and status UI. The wrapper owns
model leases and shares the page's language service across editor instances.

`hooks/` contains client hooks and state-to-view adapters. `useCodeRunner` owns
each surface's run/format commands and cancels them on unmount or scope changes.
It writes through injected output callbacks instead of a global command bus.

`lib/runner.ts` defines the shared execution result. `service/run.ts` adapts it
to text for native Output channels and existing console views; classroom
persistence and evaluation stay outside this module.

Surfaces inject their capabilities into `lib/monaco/actions.ts`. Formatting
returns Monaco edits to preserve undo history; share actions are registered
only by surfaces that own a share dialog. Every lazy editor entry uses
`loadEditorRuntime` so localization runs before the VS Code runtime.

`context/` contains the editor bridge context object, provider component, and consumer hook as separate files.
