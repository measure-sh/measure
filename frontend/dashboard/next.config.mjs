import { createMDX } from "fumadocs-mdx/next";
import { withPostHogConfig } from "@posthog/nextjs-config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Without this, fumadocs-mdx's createMDX defaults pageExtensions to a list
  // that includes "md", turning the marketing page.md markdown twins into
  // route candidates that collide with their page.tsx pages ("Duplicate page
  // detected" warnings). Docs content lives in content/docs and is compiled
  // by fumadocs-mdx collections, not routing, so no md/mdx extension needed.
  pageExtensions: ["js", "jsx", "ts", "tsx"],
  experimental: {
    // proxy.ts reverse-proxies /api/* and /yrtmlt/* to external origins
    // via NextResponse.rewrite(). Raise the proxy timeout from the 30s default
    // so long-running API requests aren't cut off.
    proxyTimeout: 90000,
  },
  // The /page-md/[...path] route handler reads the marketing page.md twins
  // at runtime. Next's tracer can't infer these dynamic reads, so include
  // them explicitly in the standalone output. Without this, agents
  // requesting Accept:text/markdown would get 406 in production. Docs
  // markdown doesn't need tracing: the /llms.mdx route is fully static.
  outputFileTracingIncludes: {
    "/page-md/[...path]": ["./app/**/page.md"],
  },
  // Docs pages are also served as processed markdown at their URL plus a
  // .md suffix, handled by the static /llms.mdx route.
  async rewrites() {
    return [
      {
        source: "/docs.md",
        destination: "/llms.mdx",
      },
      {
        source: "/docs/:path*.md",
        destination: "/llms.mdx/:path*",
      },
    ];
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
      // The Crashlytics alternatives page moved from the plural slug to the
      // singular. Forward the old URL so existing links keep working.
      {
        source: "/crashlytics-alternatives",
        destination: "/crashlytics-alternative",
        permanent: true,
      },
      // Configuration Options and Performance Impact are top-level docs;
      // their files historically lived under features/, which put the
      // extra segment in their URLs. Forward the old URLs to the flat
      // slugs the files now have.
      {
        source: "/docs/features/configuration-options",
        destination: "/docs/configuration-options",
        permanent: true,
      },
      {
        source: "/docs/features/performance-impact",
        destination: "/docs/performance-impact",
        permanent: true,
      },
      // The API reference's section folders group generated operation pages
      // but have no index page of their own, so their plain URLs would 404.
      // Send them to the reference overview.
      {
        source: "/docs/api/dashboard",
        destination: "/docs/api",
        permanent: false,
      },
      {
        source: "/docs/api/sdk",
        destination: "/docs/api",
        permanent: false,
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

// Docs content in content/docs is compiled by fumadocs-mdx; collections are
// defined in source.config.ts and the generated .source/ folder is emitted
// during dev/build.
const withMDX = createMDX();

const mdxConfig = withMDX(nextConfig);

// Sourcemap upload is opt-in via an explicit build-time flag, NOT NODE_ENV:
// staging and local self-host builds also run with NODE_ENV=production but must
// not upload. Only when UPLOAD_SOURCEMAPS=true do we wrap with withPostHogConfig
// (which validates its config eagerly and runs the upload). Otherwise the plain
// Next.js config is exported untouched and no PostHog build hooks run.
const uploadSourcemaps = process.env.UPLOAD_SOURCEMAPS === "true";

export default uploadSourcemaps
  ? withPostHogConfig(mdxConfig, {
      personalApiKey: process.env.POSTHOG_SOURCEMAP_PERSONAL_KEY,
      projectId: process.env.POSTHOG_PROJECT_ID,
      sourcemaps: {
        enabled: true,
        deleteAfterUpload: true,
      },
    })
  : mdxConfig;
