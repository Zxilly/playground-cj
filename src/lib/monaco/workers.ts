import { getEnhancedMonacoEnvironment } from 'monaco-languageclient/vscodeApiWrapper'

export function configureMonacoWorkers() {
  const env = getEnhancedMonacoEnvironment()

  env.getWorker = (_workerId: string, label: string) => {
    if (label === 'editorWorkerService') {
      return new Worker(
        new URL('../editor.worker.js', import.meta.url),
        { type: 'module', name: label },
      )
    }
    if (label === 'TextMateWorker') {
      return new Worker(
        new URL('../textmate.worker.js', import.meta.url),
        { type: 'module', name: label },
      )
    }
    throw new Error(`Unknown worker label: ${label}`)
  }
}
