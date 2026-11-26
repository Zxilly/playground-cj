import { preloadEditorServices } from './preload-services'
import { markEditorStartup } from './startup-timing'

let zhLocalizationReady: Promise<unknown> | undefined

function loadChineseLocalization(): Promise<unknown> {
  zhLocalizationReady ??= import('./localization').catch((error) => {
    zhLocalizationReady = undefined
    throw error
  })
  return zhLocalizationReady
}

/**
 * Every lazy editor entry must register NLS before evaluating any VS Code
 * module, then download the editor chunk and service overrides in parallel.
 */
export async function loadEditorRuntime<T>(locale: string | undefined, load: () => Promise<T>): Promise<T> {
  markEditorStartup('requested')
  if (locale === 'zh') {
    await loadChineseLocalization()
    markEditorStartup('locale-ready')
  }
  const [editor] = await Promise.all([load(), preloadEditorServices()])
  return editor
}
