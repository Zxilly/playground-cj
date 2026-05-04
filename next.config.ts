import type { NextConfig } from 'next'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const CJ_RE = /\.cj$/i
const MJS_RE = /\.m?js$/
const CODINGAME_RE = /node_modules[\\/](@codingame|monaco-languageclient|vscode-languageclient)/
const PATH_SEP_RE = /[\\/]/
const CJO_TARGET = 'linux_x86_64_cjnative'
const IS_DEV = process.env.NODE_ENV === 'development'
const LSP_PUBLIC_DIR = join(import.meta.dirname, 'public', 'lsp')

// Content hash, not mtime — CI re-downloads the LSP archive on every build,
// so an mtime-based key would bust caches across deploys even when the wasm
// is byte-identical. Hashing 50 MB once at config load is ~100 ms.
function detectLspVersion(): string {
  try {
    const bytes = readFileSync(join(LSP_PUBLIC_DIR, 'LSPServer-wasm.wasm'))
    return createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  }
  catch {
    return 'fallback'
  }
}

function collectCjoModules(): string[] {
  const root = join(LSP_PUBLIC_DIR, 'modules', CJO_TARGET)
  const results: string[] = []
  const walk = (dir: string) => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    }
    catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      }
      else if (entry.name.endsWith('.cjo')) {
        // Normalize Windows backslashes so the runtime URL matches the posix layout
        results.push(relative(root, full).split(PATH_SEP_RE).join('/'))
      }
    }
  }
  walk(root)
  return results.sort()
}

// Next.js 16 loads next.config.ts via require(), which forbids top-level await,
// so we cannot kick off the async download here. Require LSP assets to exist
// at config-load time; run `node scripts/download-lsp-cli.mjs` (or `pnpm prep`)
// to populate them on a fresh checkout.
function lspDirEmpty(): boolean {
  if (!existsSync(LSP_PUBLIC_DIR))
    return true
  return readdirSync(LSP_PUBLIC_DIR).filter(f => !f.startsWith('.')).length === 0
}
if (lspDirEmpty()) {
  throw new Error(
    `LSP assets missing in ${LSP_PUBLIC_DIR}. Run "node scripts/download-lsp-cli.mjs" first.`,
  )
}
const LSP_VERSION = detectLspVersion()
const CJO_MODULES = collectCjoModules()

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@lingui/swc-plugin', {
        runtimeModules: {
          i18n: ['@/lib/i18n', 'i18n'],
          trans: ['@lingui/react', 'Trans'],
        },
      }],
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
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      // Dev: no-store so a fresh wasm build isn't masked by an immutable cache entry.
      {
        source: '/lsp/:path*',
        headers: [{
          key: 'Cache-Control',
          value: IS_DEV ? 'no-store' : 'public, max-age=31536000, immutable',
        }],
      },
    ]
  },
  webpack: (config, { isServer, webpack }) => {
    config.module.rules.push({
      test: CJ_RE,
      type: 'asset/source',
    })

    if (!isServer) {
      // Fix ES module resolution for @codingame packages
      config.module.rules.push({
        test: MJS_RE,
        include: CODINGAME_RE,
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

    // Inlined at config-load time; restart `next dev` after rebuilding the
    // wasm or adding .cjo files.
    config.plugins.push(new webpack.DefinePlugin({
      __CJO_TARGET__: JSON.stringify(CJO_TARGET),
      __CJO_MODULES__: JSON.stringify(CJO_MODULES),
      __LSP_VERSION__: JSON.stringify(LSP_VERSION),
    }))

    return config
  },
}

export default nextConfig
