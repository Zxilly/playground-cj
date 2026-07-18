import * as vscode from 'vscode'

export interface ModelFileMirror {
  update: (text: string) => void
  dispose: () => Promise<void>
}

/**
 * Back a Monaco text model with the in-memory VS Code file service.
 *
 * Monaco's model service can render a `file://` model that has no file-system
 * entry, but workbench features such as WordHighlighter may later resolve that
 * resource through `workspace.fs`. Keeping this lightweight mirror prevents
 * those background reads from falling through to a nonexistent browser file.
 */
export async function createModelFileMirror(uri: string, initialText: string): Promise<ModelFileMirror> {
  const resource = vscode.Uri.parse(uri)
  const encoder = new TextEncoder()
  let pendingText: string | null = null
  let writePromise: Promise<void> | null = null
  let disposed = false

  const write = (text: string) => vscode.workspace.fs.writeFile(resource, encoder.encode(text))
  await write(initialText)

  const flush = async () => {
    while (pendingText !== null) {
      const text = pendingText
      pendingText = null
      try {
        await write(text)
      }
      catch (error) {
        // The editor model remains usable even if the browser file service is
        // temporarily unavailable. Report once at the integration boundary and
        // keep the queue recoverable for a later edit.
        console.warn('[monaco] Unable to mirror model into the VS Code file service', error)
      }
    }
  }

  const scheduleFlush = () => {
    if (writePromise)
      return
    writePromise = flush().finally(() => {
      writePromise = null
      if (!disposed && pendingText !== null)
        scheduleFlush()
    })
  }

  return {
    update(text) {
      if (disposed)
        return
      pendingText = text
      scheduleFlush()
    },
    async dispose() {
      disposed = true
      await writePromise
    },
  }
}
