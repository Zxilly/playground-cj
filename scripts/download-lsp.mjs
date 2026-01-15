import { Buffer } from 'node:buffer'
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import * as yauzl from 'yauzl'

const LSP_DIR = join(process.cwd(), 'public', 'lsp')
const LSP_ZIP_URL = 'https://github.com/Zxilly/playground-cj/releases/download/wasm-lsp-1.1.0-alpha/lsp.zip'

function isLspDirEmpty() {
  if (!existsSync(LSP_DIR)) {
    return true
  }
  const files = readdirSync(LSP_DIR).filter(f => !f.startsWith('.'))
  return files.length === 0
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
        const fullPath = join(destDir, entry.fileName)

        if (entry.fileName.endsWith('/')) {
          mkdirSync(fullPath, { recursive: true })
          zipfile.readEntry()
        }
        else {
          mkdirSync(join(fullPath, '..'), { recursive: true })
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

async function ensureLspFiles() {
  if (!isLspDirEmpty()) {
    return
  }

  console.log('LSP directory is empty, downloading LSP files...')

  if (!existsSync(LSP_DIR)) {
    mkdirSync(LSP_DIR, { recursive: true })
  }

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

await ensureLspFiles()
