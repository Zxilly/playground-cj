import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@lingui/swc-plugin', {}],
    ],
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.cj$/i,
      use: 'raw-loader',
    })

    config.module.rules.forEach((rule: any) => {
      if (rule.use) {
        const loaders = Array.isArray(rule.use) ? rule.use : [rule.use]
        loaders.forEach((loader: any) => {
          if (typeof loader === 'object' && loader.options) {
            loader.dependency = loader.dependency || {}
            loader.dependency.not = loader.dependency.not || []
            if (!loader.dependency.not.includes('url')) {
              loader.dependency.not.push('url')
            }
          }
        })
      }
    })

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
