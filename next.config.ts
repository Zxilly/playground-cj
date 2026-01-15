import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LSP_DIR = join(process.cwd(), 'public', 'lsp')

function isLspDirEmpty() {
  if (!existsSync(LSP_DIR)) {
    return true
  }
  const files = readdirSync(LSP_DIR).filter(f => !f.startsWith('.'))
  return files.length === 0
}

// Execute at config load time
if (isLspDirEmpty()) {
  execSync('node scripts/download-lsp.mjs', { stdio: 'inherit' })
}

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
