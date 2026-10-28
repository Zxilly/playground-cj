import { preloadEditorServices } from './preload-services'
import { markEditorStartup } from './startup-timing'

/** Every lazy editor entry must load NLS before evaluating any VS Code module. */
export async function loadEditorRuntime<T>(locale: string | undefined, load: () => Promise<T>): Promise<T> {
  markEditorStartup('requested')
  if (locale === 'zh') {
    await import('./localization')
    markEditorStartup('locale-ready')
  }
  const [editor] = await Promise.all([load(), preloadEditorServices()])
  return editor
}
