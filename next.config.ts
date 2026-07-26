import type { NextConfig } from 'next'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PATH_SEP_RE = /[\\/]/
const CJO_TARGET = 'linux_x86_64_cjnative'
const IS_DEV = process.env.NODE_ENV === 'development'
const WASM_ASSETS_PUBLIC_DIR = join(import.meta.dirname, 'public', 'lsp')
const PASSIVE_RESOURCE_POLICY = [
  'base-uri \'self\'',
  'object-src \'none\'',
  'frame-src \'none\'',
  'img-src \'self\' blob: data:',
  'media-src \'self\' blob: data:',
].join('; ')

// Content hash, not mtime — CI re-downloads the WASM archive on every build,
// so an mtime-based key would bust caches across deploys even when the wasm
// is byte-identical. Hashing 50 MB once at config load is ~100 ms.
function detectWasmAssetsVersion(): string {
  try {
    const hash = createHash('sha256')
    for (const name of ['LSPServer-wasm.wasm', 'cjfmt-wasm.wasm'])
      hash.update(readFileSync(join(WASM_ASSETS_PUBLIC_DIR, name)))
    return hash.digest('hex').slice(0, 16)
  }
  catch {
    return 'fallback'
  }
}

function collectCjoModules(): string[] {
  const root = join(WASM_ASSETS_PUBLIC_DIR, 'modules', CJO_TARGET)
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
// so we cannot kick off the async download here. Require WASM assets to exist
// at config-load time; run `node scripts/download-wasm-assets-cli.mjs` (or `pnpm prep`)
// to populate them on a fresh checkout.
function lspDirEmpty(): boolean {
  if (!existsSync(WASM_ASSETS_PUBLIC_DIR))
    return true
  return readdirSync(WASM_ASSETS_PUBLIC_DIR).filter(f => !f.startsWith('.')).length === 0
}
if (lspDirEmpty()) {
  throw new Error(
    `WASM assets missing in ${WASM_ASSETS_PUBLIC_DIR}. Run "node scripts/download-wasm-assets-cli.mjs" first.`,
  )
}
const WASM_ASSETS_VERSION = detectWasmAssetsVersion()
const CJO_MODULES = collectCjoModules()

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
  ],
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
  turbopack: {
    rules: {
      // .cj source files are imported as raw text.
      '*.cj': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  // Inlined into the bundle as process.env.*. Computed at config load from the
  // browser WASM assets; restart the dev server after rebuilding the wasm or adding
  // .cjo files.
  env: {
    CJO_TARGET,
    CJO_MODULES: JSON.stringify(CJO_MODULES),
    WASM_ASSETS_VERSION,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Content-Security-Policy', value: PASSIVE_RESOURCE_POLICY },
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
}

export default nextConfig
