/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizePackageImports: [
            "shiki",
        ]
    },
    reactStrictMode: false,
};

export default nextConfig;
