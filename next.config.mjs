/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'shiki',
    ],
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
