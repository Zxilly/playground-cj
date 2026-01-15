import type { NextConfig } from 'next'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const LSP_DIR = join(process.cwd(), 'public', 'lsp')
const LSP_ZIP_URL = 'https://github.com/Zxilly/playground-cj/releases/download/wasm-lsp-1.1.0-alpha/lsp.zip'
const ZIP_PATH = join(LSP_DIR, 'lsp.zip')

function isLspDirEmpty() {
  if (!existsSync(LSP_DIR)) {
    return true
  }
  const files = readdirSync(LSP_DIR).filter(f => !f.startsWith('.'))
  return files.length === 0
}

function ensureLspFiles() {
  if (!isLspDirEmpty()) {
    return
  }

  console.log('LSP directory is empty, downloading LSP files...')

  if (!existsSync(LSP_DIR)) {
    mkdirSync(LSP_DIR, { recursive: true })
  }

  console.log(`Downloading from ${LSP_ZIP_URL}...`)
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Invoke-WebRequest -Uri '${LSP_ZIP_URL}' -OutFile '${ZIP_PATH}'"`, { stdio: 'inherit' })
  }
  else {
    execSync(`curl -L -o "${ZIP_PATH}" "${LSP_ZIP_URL}"`, { stdio: 'inherit' })
  }
  console.log('Download complete.')

  console.log('Extracting LSP files...')
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${LSP_DIR}' -Force"`, { stdio: 'inherit' })
  }
  else {
    execSync(`unzip -o "${ZIP_PATH}" -d "${LSP_DIR}"`, { stdio: 'inherit' })
  }

  rmSync(ZIP_PATH)
  console.log('LSP files extracted successfully.')
}

// Execute at config load time
ensureLspFiles()

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@lingui/swc-plugin', {}],
    ],
  },
  reactStrictMode: false,
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.cj$/i,
      use: 'raw-loader',
    })

    if (!isServer) {
      // Fix ES module resolution for @codingame packages
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules[\\/](@codingame|monaco-languageclient|vscode-languageclient)/,
        resolve: {
          fullySpecified: false,
        },
      })
    }

    config.module = {
      ...config.module,
      exprContextCritical: false,
    }

    config.resolve = config.resolve || {}
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      module: false,
    }

    return config
  },
}

export default nextConfig
