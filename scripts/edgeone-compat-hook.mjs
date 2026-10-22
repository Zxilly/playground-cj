import { registerHooks, createRequire } from 'node:module'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transformEdgeOneTurbopack } from './edgeone-turbopack-compat.mjs'

// Explicit opt-in: never install this hook through a global NODE_OPTIONS.
const cliDirectory = process.env.EDGEONE_CLI_DIRECTORY
if (!cliDirectory)
  throw new Error('EDGEONE_CLI_DIRECTORY must identify the installed EdgeOne package')
const cliPackagePath = join(resolve(cliDirectory), 'package.json')
const require = createRequire(cliPackagePath)
const adapterPackagePath = require.resolve('@edgeone/opennextjs-pages/package.json')

for (const [path, name, version] of [
  [cliPackagePath, 'edgeone', '1.6.45'],
  [adapterPackagePath, '@edgeone/opennextjs-pages', '0.2.10-beta.12'],
]) {
  const metadata = JSON.parse(readFileSync(path, 'utf8'))
  if (metadata.name !== name || metadata.version !== version)
    throw new Error(`Expected ${name}@${version}, found ${metadata.name}@${metadata.version}; review the compatibility hook`)
}

const compilerPath = realpathSync(join(dirname(adapterPackagePath), 'dist/build/functions/middleware/compiler.js'))
const compilerUrl = pathToFileURL(compilerPath).href

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context)
    if (url !== compilerUrl)
      return loaded
    const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8')
    // The pure transform validates the original function hash. Only the module
    // returned to Node changes; installed dependencies remain byte-for-byte intact.
    const transformed = transformEdgeOneTurbopack(source)
    console.log('[edgeone-compat] Loaded the validated Turbopack compiler through the in-memory hook')
    return { ...loaded, source: transformed }
  },
})
