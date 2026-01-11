import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@lingui/swc-plugin', {}],
    ],
  },
  reactStrictMode: false,
  turbopack: {},
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
