/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/clarity/:path*',
                destination: 'https://www.clarity.ms/tag/:path*',
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '9111'
            },
        ],
    },
}

module.exports = nextConfig
