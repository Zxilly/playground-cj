import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const CJ_RE = /\.cj$/i
const MJS_RE = /\.m?js$/
const CODINGAME_RE = /node_modules[\\/](@codingame|monaco-languageclient|vscode-languageclient)/
const PATH_SEP_RE = /[\\/]/
const CJO_TARGET = 'linux_x86_64_cjnative'

// Downloads LSP assets on fresh checkout; a no-op when already present.
execSync('node scripts/download-lsp.mjs', { stdio: 'inherit' })

function collectCjoModules(): string[] {
  const root = join(process.cwd(), 'public', 'lsp', 'modules', CJO_TARGET)
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

    // Inlined at config-load time; restart the dev server after adding .cjo files.
    config.plugins.push(new webpack.DefinePlugin({
      __CJO_TARGET__: JSON.stringify(CJO_TARGET),
      __CJO_MODULES__: JSON.stringify(collectCjoModules()),
    }))

    return config
  },
}

export default nextConfig
