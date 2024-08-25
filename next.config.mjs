/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizePackageImports: [
            "shiki"
        ]
    }
};

export default nextConfig;
