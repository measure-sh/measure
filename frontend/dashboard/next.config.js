import { withPostHogConfig } from "@posthog/nextjs-config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // middleware.ts reverse-proxies /api/* and /yrtmlt/* to external origins
    // via NextResponse.rewrite(). Raise the proxy timeout from the 30s default
    // so long-running API requests aren't cut off.
    proxyTimeout: 90000,
  },
  // The /page-md/[...path] route handler reads markdown source files at runtime.
  // Next's tracer can't infer these dynamic reads, so include them explicitly
  // in the standalone output. Without this, agents requesting Accept:text/markdown
  // would get 406 in production.
  outputFileTracingIncludes: {
    "/page-md/[...path]": ["./app/**/page.md", "./content/docs/**/*"],
  },
  images: {
    // Next 16 blocks optimizing images served from local/private IPs by default.
    // The localhost:9111 remote pattern below points at self-hosted object storage,
    // so this must stay enabled to keep serving app icons and avatars in
    // self-hosted deployments.
    dangerouslyAllowLocalIP: true,
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
  // /crashes and /anrs were consolidated into /errors. Catch any stale links
  // from old emails or bookmarks and forward them to the new path.
  async redirects() {
    return [
      {
        source: "/:teamId/crashes/:rest*",
        destination: "/:teamId/errors/:rest*",
        permanent: true,
      },
      {
        source: "/:teamId/anrs/:rest*",
        destination: "/:teamId/errors/:rest*",
        permanent: true,
      },
      // The REST API reference is no longer published on the docs site. Forward
      // stale links to the old /docs/api pages (overview, sdk, dashboard) to the
      // docs home.
      {
        source: "/docs/api/:path*",
        destination: "/docs",
        permanent: true,
      },
    ];
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

// Sourcemap upload is opt-in via an explicit build-time flag, NOT NODE_ENV:
// staging and local self-host builds also run with NODE_ENV=production but must
// not upload. Only when UPLOAD_SOURCEMAPS=true do we wrap with withPostHogConfig
// (which validates its config eagerly and runs the upload). Otherwise the plain
// Next.js config is exported untouched and no PostHog build hooks run.
const uploadSourcemaps = process.env.UPLOAD_SOURCEMAPS === "true";

export default uploadSourcemaps
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_SOURCEMAP_PERSONAL_KEY,
      projectId: process.env.POSTHOG_PROJECT_ID,
      sourcemaps: {
        enabled: true,
        deleteAfterUpload: true,
      },
    })
  : nextConfig;
