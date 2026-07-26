import { Buffer } from 'node:buffer'
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path'
import { pipeline } from 'node:stream/promises'
import * as yauzl from 'yauzl'

const LSP_DIR = join(import.meta.dirname, '..', 'public', 'lsp')
const LSP_ZIP_URL = 'https://github.com/Zxilly/playground-cj/releases/download/wasm-lsp-1.2.0-alpha.20260724/lsp.zip'
const CJO_TARGET = 'linux_x86_64_cjnative'
const REQUIRED_LSP_FILES = [
  'LSPServer-wasm.js',
  'LSPServer-wasm.wasm',
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

export function isLspAssetsComplete(lspDir = LSP_DIR) {
  if (!isDirectory(lspDir))
    return false

  const hasRequiredFiles = REQUIRED_LSP_FILES.every(file => isFile(join(lspDir, file)))
  if (!hasRequiredFiles)
    return false

  const modulesDir = join(lspDir, 'modules', CJO_TARGET)
  return isDirectory(modulesDir) && hasCjoModule(modulesDir)
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

export async function ensureLspFiles() {
  if (isLspAssetsComplete()) {
    return
  }

  console.log('LSP directory is empty, downloading LSP files...')

  mkdirSync(LSP_DIR, { recursive: true })

  console.log(`Downloading from ${LSP_ZIP_URL}...`)
  const response = await fetch(LSP_ZIP_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log('Download complete.')

  console.log('Extracting LSP files...')
  await extractZipFromBuffer(buffer, LSP_DIR)
  console.log('LSP files extracted successfully.')
}

// Allow direct invocation (`node scripts/download-lsp.mjs`).
if (process.argv[1] === import.meta.filename) {
  await ensureLspFiles()
}
