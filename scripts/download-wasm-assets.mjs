import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path'
import { pipeline } from 'node:stream/promises'
import * as yauzl from 'yauzl'

const WASM_ASSETS_DIR = join(import.meta.dirname, '..', 'public', 'lsp')
const WASM_ASSETS_ZIP_URL = 'https://github.com/Zxilly/playground-cj/releases/download/wasm-assets-1.2.0-alpha.20260724/wasm_assets.zip'
const WASM_ASSETS_ZIP_SHA256 = '1dbf2c7fb5d36873009076449778c5c6373b4c0680b4a9a94ac9910560fc5585'
const WASM_ASSETS_VERSION_FILE = '.wasm-assets.sha256'
const CJO_TARGET = 'linux_x86_64_cjnative'
const REQUIRED_LSP_FILES = [
  'LSPServer-wasm.js',
  'LSPServer-wasm.wasm',
  'cjfmt-wasm.mjs',
  'cjfmt-wasm.wasm',
]
const WINDOWS_ABSOLUTE_RE = /^(?:[A-Za-z]:[\\/]|\\\\)/

function isFile(path) {
  try {
    return statSync(path).isFile()
  }
  catch {
    return false
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

function hasCjoModule(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).some((entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory())
        return hasCjoModule(fullPath)
      return entry.isFile() && entry.name.endsWith('.cjo')
    })
  }
  catch {
    return false
  }
}

export function isWasmAssetsComplete(assetsDir = WASM_ASSETS_DIR) {
  if (!isDirectory(assetsDir))
    return false

  const hasRequiredFiles = REQUIRED_LSP_FILES.every(file => isFile(join(assetsDir, file)))
  if (!hasRequiredFiles)
    return false
  try {
    const markerPath = join(assetsDir, WASM_ASSETS_VERSION_FILE)
    if (
      !statSync(markerPath).isFile()
      || readFileSync(markerPath, 'utf8').trim() !== WASM_ASSETS_ZIP_SHA256
    ) {
      return false
    }
  }
  catch {
    return false
  }

  const modulesDir = join(assetsDir, 'modules', CJO_TARGET)
  return isDirectory(modulesDir) && hasCjoModule(modulesDir)
}

export function assertWasmAssetsArchive(
  buffer,
  expectedSha256 = WASM_ASSETS_ZIP_SHA256,
) {
  const actualSha256 = createHash('sha256').update(buffer).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `WASM asset archive SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`,
    )
  }
}

export function resolveZipEntryPath(destDir, entryName) {
  const normalizedEntryName = entryName.replace(/\\/g, '/')
  const targetRoot = resolvePath(destDir)

  if (
    normalizedEntryName.startsWith('/')
    || WINDOWS_ABSOLUTE_RE.test(entryName)
    || normalizedEntryName.includes('\0')
  ) {
    throw new Error(`Zip entry is outside the target directory: ${entryName}`)
  }

  const targetPath = resolvePath(targetRoot, normalizedEntryName)
  const relativePath = relative(targetRoot, targetPath)

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Zip entry is outside the target directory: ${entryName}`)
  }

  return targetPath
}

async function extractZipFromBuffer(buffer, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err || new Error('Failed to open zip'))
        return
      }

      zipfile.on('error', reject)
      zipfile.on('end', resolve)

      zipfile.on('entry', (entry) => {
        let fullPath
        try {
          fullPath = resolveZipEntryPath(destDir, entry.fileName)
        }
        catch (error) {
          reject(error)
          zipfile.close()
          return
        }

        if (entry.fileName.endsWith('/')) {
          mkdirSync(fullPath, { recursive: true })
          zipfile.readEntry()
        }
        else {
          mkdirSync(dirname(fullPath), { recursive: true })
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              reject(streamErr || new Error('Failed to open read stream'))
              return
            }
            const writeStream = createWriteStream(fullPath)
            pipeline(readStream, writeStream)
              .then(() => zipfile.readEntry())
              .catch(reject)
          })
        }
      })

      zipfile.readEntry()
    })
  })
}

export async function ensureWasmAssets() {
  if (isWasmAssetsComplete()) {
    return
  }

  console.log('WASM asset directory is incomplete, downloading browser toolchain files...')

  mkdirSync(WASM_ASSETS_DIR, { recursive: true })

  console.log(`Downloading from ${WASM_ASSETS_ZIP_URL}...`)
  const response = await fetch(WASM_ASSETS_ZIP_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  assertWasmAssetsArchive(buffer)
  console.log('Download complete and SHA-256 verified.')

  console.log('Extracting browser toolchain files...')
  await extractZipFromBuffer(buffer, WASM_ASSETS_DIR)
  writeFileSync(
    join(WASM_ASSETS_DIR, WASM_ASSETS_VERSION_FILE),
    `${WASM_ASSETS_ZIP_SHA256}\n`,
    'utf8',
  )
  if (!isWasmAssetsComplete())
    throw new Error('Extracted WASM asset archive is incomplete')
  console.log('Browser toolchain files extracted successfully.')
}

// Allow direct invocation (`node scripts/download-wasm-assets.mjs`).
if (process.argv[1] === import.meta.filename) {
  await ensureWasmAssets()
}
