interface CangjieFormatterResult {
  success: unknown
  formatted: unknown
}

export interface CangjieFormatterModule {
  formatCangjie: (source: string, path: string) => CangjieFormatterResult
}

type FormatterModuleLoader = () => Promise<CangjieFormatterModule>

interface EmscriptenFormatterFactory {
  (options: {
    locateFile: (path: string) => string
  }): Promise<unknown>
}

const WASM_ASSETS_VERSION = process.env.WASM_ASSETS_VERSION ?? 'fallback'
const VERSION_QUERY = `?v=${WASM_ASSETS_VERSION}`
const FORMATTER_MODULE_URL = `/lsp/cjfmt-wasm.mjs${VERSION_QUERY}`
const FORMATTER_WASM_URL = `/lsp/cjfmt-wasm.wasm${VERSION_QUERY}`

function isFormatterModule(value: unknown): value is CangjieFormatterModule {
  return typeof value === 'object'
    && value !== null
    && 'formatCangjie' in value
    && typeof value.formatCangjie === 'function'
}

async function loadBrowserFormatterModule(): Promise<CangjieFormatterModule> {
  const imported: unknown = await import(
    /* webpackIgnore: true */
    FORMATTER_MODULE_URL,
  )
  if (
    typeof imported !== 'object'
    || imported === null
    || !('default' in imported)
    || typeof imported.default !== 'function'
  ) {
    throw new Error('Cangjie formatter module is invalid')
  }

  const factory = imported.default as EmscriptenFormatterFactory
  const formatterModule = await factory({
    locateFile: path => path.endsWith('.wasm') ? FORMATTER_WASM_URL : path,
  })
  if (!isFormatterModule(formatterModule))
    throw new Error('Cangjie formatter module is invalid')
  return formatterModule
}

export function createCangjieFormatter(
  loadModule: FormatterModuleLoader = loadBrowserFormatterModule,
) {
  let modulePromise: Promise<CangjieFormatterModule> | undefined

  const getModule = async () => {
    modulePromise ??= loadModule()
    try {
      return await modulePromise
    }
    catch (error) {
      modulePromise = undefined
      throw error
    }
  }

  return {
    async format(source: string, path = 'main.cj'): Promise<string> {
      const formatterModule = await getModule()
      const result: unknown = formatterModule.formatCangjie(source, path)
      if (
        typeof result !== 'object'
        || result === null
        || !('success' in result)
        || typeof result.success !== 'boolean'
        || !('formatted' in result)
        || typeof result.formatted !== 'string'
      ) {
        throw new Error('Cangjie formatter returned an invalid result')
      }
      if (!result.success)
        throw new Error('Cangjie formatter rejected the source')
      return result.formatted
    },
  }
}

export const browserCangjieFormatter = createCangjieFormatter()
