import { createMDX } from "fumadocs-mdx/next";
import { withPostHogConfig } from "@posthog/nextjs-config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output exists for the self-hosted Docker image, which copies
  // .next/standalone and runs its server.js. Vercel builds through its
  // deployment adapter instead, which assembles per-route functions and never
  // writes the .next/next-server.js.nft.json trace that the standalone step
  // reads, so requesting standalone there fails the build with ENOENT.
  output: process.env.VERCEL ? undefined : "standalone",
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
  // This app is one folder inside a larger repository, and there is a
  // package-lock.json at the repository root as well as in this folder. Left
  // to itself the bundler picks the repository root as the base for file
  // tracing and walks the Go backend and every node_modules alongside it.
  // Pinning the base to this folder keeps tracing to the dashboard.
  outputFileTracingRoot: import.meta.dirname,
  // The /page-md/[...path] route handler reads the marketing page.md twins
  // at runtime. Next's tracer can't infer these dynamic reads, so include
  // them explicitly in the standalone output. Without this, agents
  // requesting Accept:text/markdown would get 406 in production. Docs
  // markdown doesn't need tracing: the /llms.docs route is fully static.
  outputFileTracingIncludes: {
    "/page-md/[...path]": ["./app/**/page.md"],
  },
  // Docs and blog pages are also served as processed markdown at their
  // URL plus a .md suffix, handled by the static /llms.docs and /llms.blog
  // routes.
  async rewrites() {
    return [
      {
        source: "/docs.md",
        destination: "/llms.docs",
      },
      {
        source: "/docs/:path*.md",
        destination: "/llms.docs/:path*",
      },
      {
        source: "/blog.md",
        destination: "/llms.blog",
      },
      {
        source: "/blog/:path*.md",
        destination: "/llms.blog/:path*",
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
      // Session timelines became session replay.
      {
        source: "/product/session-timelines",
        destination: "/product/session-replays",
        permanent: true,
      },
      {
        source: "/:teamId/session_timelines",
        destination: "/:teamId/session_replays",
        permanent: true,
      },
      {
        source: "/:teamId/session_timelines/:rest*",
        destination: "/:teamId/session_replays/:rest*",
        permanent: true,
      },
      {
        source: "/docs/session-timeline",
        destination: "/docs/session-replay",
        permanent: true,
      },
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
        destination: "/docs/adaptive-capture",
        permanent: true,
      },
      {
        source: "/docs/features/performance-impact",
        destination: "/docs/performance-impact",
        permanent: true,
      },
      // Configuration Options was renamed Adaptive Capture. Forward the old
      // flat URL; the browser carries anchors like #journey-sampling across.
      {
        source: "/docs/configuration-options",
        destination: "/docs/adaptive-capture",
        permanent: true,
      },
      // The Slack Integration page's setup content moved to the Integrations
      // page. Forward the old URL to its Slack section.
      {
        source: "/docs/slack-integration",
        destination: "/docs/integrations#slack",
        permanent: true,
      },
      // The /docs/getting-started folder groups the per-platform pages but has
      // no page of its own (the chooser lives at the /docs root), so its bare
      // URL would 404. Send it to the chooser. Temporary (like the api section
      // folders below) so it isn't hard-cached if the folder gains a page later.
      {
        source: "/docs/getting-started",
        destination: "/docs",
        permanent: false,
      },
      // The SDK Integration guide was split into per-platform pages under
      // /docs/getting-started. Forward the old URL to the docs home.
      {
        source: "/docs/sdk-integration-guide",
        destination: "/docs",
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
      // Bug reporting moved from four per-platform pages under features/ into
      // its own top-level Bug reports section. Forward the old URLs to it.
      {
        source: "/docs/features/feature-bug-report-android",
        destination: "/docs/bug-reports",
        permanent: true,
      },
      {
        source: "/docs/features/feature-bug-report-ios",
        destination: "/docs/bug-reports",
        permanent: true,
      },
      {
        source: "/docs/features/feature-bug-report-flutter",
        destination: "/docs/bug-reports",
        permanent: true,
      },
      {
        source: "/docs/features/feature-bug-report-react-native",
        destination: "/docs/bug-reports",
        permanent: true,
      },
      // Connectivity changes moved out of features/ into the Network
      // monitoring section. The navigation and lifecycle feature page was
      // removed; screen view tracking now lives in the API reference.
      // Forward the old URLs.
      {
        source: "/docs/features/feature-network-connectivity-changes",
        destination: "/docs/network-monitoring/connectivity-changes",
        permanent: true,
      },
      {
        source: "/docs/features/feature-navigation-lifecycle-tracking",
        destination: "/docs/navigation-tracking",
        permanent: true,
      },
      // The features section was dissolved. Each page's content moved into a
      // feature section, the API reference, or Configuration Options. Forward
      // the old URLs.
      {
        source: "/docs/features/feature-network-monitoring",
        destination: "/docs/network-monitoring",
        permanent: true,
      },
      {
        source: "/docs/features/feature-custom-events",
        destination: "/docs/custom-events",
        permanent: true,
      },
      {
        source: "/docs/features/feature-identify-users",
        destination: "/docs/api-reference#identify-users",
        permanent: true,
      },
      {
        source: "/docs/features/feature-manually-start-stop-sdk",
        destination: "/docs/api-reference#start-tracking",
        permanent: true,
      },
      {
        source: "/docs/features/feature-screenshot-masking-swiftui",
        destination: "/docs/error-monitoring/screenshot-masking#ios",
        permanent: true,
      },
      {
        source: "/docs/features/feature-screenshot-masking-flutter",
        destination: "/docs/error-monitoring/screenshot-masking#flutter",
        permanent: true,
      },
      {
        source: "/docs/features/feature-app-launch-metrics",
        destination: "/docs/app-launch-metrics",
        permanent: true,
      },
      {
        source: "/docs/features/feature-app-size-monitoring",
        destination: "/docs/app-size-monitoring",
        permanent: true,
      },
      {
        source: "/docs/features/feature-gesture-tracking",
        destination: "/docs/gesture-tracking",
        permanent: true,
      },
      {
        source: "/docs/features/feature-session-timelines",
        destination: "/docs/session-replay",
        permanent: true,
      },
      {
        source: "/docs/features/feature-cpu-monitoring",
        destination: "/docs/cpu-memory-monitoring#cpu-usage",
        permanent: true,
      },
      {
        source: "/docs/features/feature-memory-monitoring",
        destination: "/docs/cpu-memory-monitoring#memory-usage",
        permanent: true,
      },
      {
        source: "/docs/features/feature-crash-reporting",
        destination: "/docs/error-monitoring",
        permanent: true,
      },
      {
        source: "/docs/features/feature-error-tracking",
        destination: "/docs/error-monitoring",
        permanent: true,
      },
      {
        source: "/docs/features/feature-anr-reporting",
        destination: "/docs/error-monitoring#anr-reporting",
        permanent: true,
      },
      {
        source: "/docs/features/feature-upload-symbols",
        destination: "/docs/error-monitoring/upload-symbols",
        permanent: true,
      },
      {
        source: "/docs/features/feature-profiling",
        destination: "/docs/performance-tracing/profiling",
        permanent: true,
      },
      {
        source: "/docs/features/feature-alerts",
        destination: "/docs/alerts",
        permanent: true,
      },
      {
        source: "/docs/features/feature-slack-integration",
        destination: "/docs/integrations#slack",
        permanent: true,
      },
      // Profiling moved from a top-level page into the Performance tracing
      // section. Forward the old flat URL.
      {
        source: "/docs/profiling",
        destination: "/docs/performance-tracing/profiling",
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
