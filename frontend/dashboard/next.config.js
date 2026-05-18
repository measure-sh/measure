/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    proxyTimeout: 90000,
    // The /_md/[...path] route handler reads markdown source files at runtime.
    // Next's tracer can't infer these dynamic reads, so include them explicitly
    // in the standalone output. Without this, agents requesting Accept:text/markdown
    // would get 406 in production.
    outputFileTracingIncludes: {
      "/page-md/[...path]": ["./app/**/page.md", "./content/docs/**/*"],
    },
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
  async headers() {
    return [
      // deny framing on every route to prevent clickjacking
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
      // allow loading assets for PostHog session replays
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
