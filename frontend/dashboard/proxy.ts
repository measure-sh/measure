/**
 * Reverse proxies (`/api`, `/yrtmlt`) and markdown content negotiation
 * for marketing/docs pages.
 *
 * Marketing page markdown twins:
 *   Each public marketing route (homepage, /about, /pricing, /why-measure,
 *   /security, /crashlytics-alternative, /sentry-alternative,
 *   /bugsnag-alternative, /embrace-alternative, /luciq-alternative,
 *   /datadog-alternative, /new-relic-alternative, /for/*, /product/*) has
 *   a hand-authored `page.md` colocated with its `page.tsx`:
 *
 *     app/about/page.tsx        ← React component (HTML)
 *     app/about/page.md         ← markdown twin for agents
 *
 *   When a request arrives with `Accept: text/markdown`, the matcher
 *   below fires and the function rewrites to `/page-md/<path>` (or
 *   `/page-md/index` for the homepage). The route handler at
 *   `app/page-md/[...path]/route.ts` reads `app/<segments>/page.md` and
 *   returns it with `Content-Type: text/markdown`.
 *
 *   `/privacy-policy` and `/terms-of-service` deliberately have no
 *   markdown twin; agents requesting them get 406.
 *
 *   **Sync rule:** if you change a marketing `page.tsx`, update the
 *   sibling `page.md` in the same change. Visual-only components
 *   (calculators, demos, icons, CTA buttons, layout chrome) are
 *   intentionally omitted from the markdown; keep copy, prices, links,
 *   and definitions aligned and drop the chrome.
 *
 *   `app/utils/llms/markdown_generator.ts` walks `app/` for folders containing both `page.tsx`
 *   and `page.md` (no skip list; the dual-file check is the filter) and
 *   emits the `## Pages` section in `llms.txt` plus the marketing
 *   portion of `llms-full.txt`.
 *
 * Docs pages are negotiated separately: they rewrite to the static
 * `/llms.mdx` route, which serves the fumadocs processed markdown also
 * exposed at the public `/docs/<path>.md` URLs.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    // reverse proxy all API requests
    const apiOrigin = process.env.API_BASE_URL;
    if (!apiOrigin) {
      throw new Error("API_BASE_URL is not set");
    }
    const apiOriginUrl = new URL(apiOrigin);

    const url = request.nextUrl.clone();
    url.protocol = apiOriginUrl.protocol;
    url.pathname = pathname.replace("/api", "");
    url.search = request.nextUrl.search;
    url.hostname = apiOriginUrl.hostname;
    url.port = apiOriginUrl.port;

    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/yrtmlt/static/")) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = "us-assets.i.posthog.com";
    url.port = "";
    url.pathname = pathname.replace("/yrtmlt/static", "/static");

    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/yrtmlt/")) {
    const phHost = new URL(process.env.POSTHOG_HOST || "");

    const url = request.nextUrl.clone();
    url.protocol = phHost.protocol;
    url.hostname = phHost.hostname;
    url.port = phHost.port;
    url.pathname = pathname.replace("/yrtmlt", "");

    return NextResponse.rewrite(url);
  }

  // Content negotiation: the third matcher entry below (with `has`)
  // only fires when Accept asks for text/markdown, so reaching this
  // point means the agent wants markdown for a non-/api, non-/yrtmlt
  // path.
  const url = request.nextUrl.clone();

  // Docs pages: serve the processed markdown from the static /llms.mdx
  // route. The path after /docs carries over unchanged, so these three
  // requests return the same document:
  //
  //   /docs/features/feature-crash-reporting.md            (public .md URL)
  //   /docs/features/feature-crash-reporting  + this Accept header
  //   /llms.mdx/features/feature-crash-reporting           (rewrite target)
  //
  // An explicit .md suffix is stripped so /docs/foo.md and /docs.md with
  // Accept: text/markdown resolve the same pages as their suffix-free
  // forms rather than double-suffixing.
  if (
    pathname === "/docs" ||
    pathname === "/docs.md" ||
    pathname.startsWith("/docs/")
  ) {
    const docPath = pathname.slice("/docs".length).replace(/\.md$/, "");
    url.pathname = `/llms.mdx${docPath}`;
    return NextResponse.rewrite(url);
  }

  // Marketing pages: rewrite to the internal /page-md/* route which
  // resolves the colocated page.md twin on disk.
  url.pathname = `/page-md${pathname === "/" ? "/index" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/yrtmlt/:path*",
    {
      // llms is a prefix exclusion covering /llms.txt, /llms-full.txt and
      // /llms.mdx/*: they already serve text, so markdown-preferring
      // requests pass straight through. Any future route starting with
      // "llms" is excluded with them.
      source: "/((?!_next|page-md|llms|api|yrtmlt|favicon\\.ico).*)",
      has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
    },
  ],
};
