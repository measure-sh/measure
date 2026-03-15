/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    proxyTimeout: 90000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9111",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
    ],
  },
  async rewrites() {
    const phHost = process.env.POSTHOG_HOST;
    console.log({ phHost });
    if (!phHost) return [];

    return {
      beforeFiles: [
        {
          source: "/yrtmlt/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/yrtmlt/:path*",
          destination: `${phHost}/:path*`,
        },
      ],
    };
  },
  async headers() {
    // allow loading assets for PostHog session replays
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://us.posthog.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://us.posthog.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
