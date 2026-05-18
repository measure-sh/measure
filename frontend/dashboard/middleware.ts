/**
 * Reverse proxies (`/api`, `/yrtmlt`) and markdown content negotiation
 * for marketing/docs pages.
 *
 * Marketing page markdown twins:
 *   Each public marketing route (homepage, /about, /pricing, /why-measure,
 *   /security, /crashlytics-alternatives, /product/*) has a hand-authored
 *   `page.md` colocated with its `page.tsx`:
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
 *   markdown twin — agents requesting them get 406.
 *
 *   **Sync rule:** if you change a marketing `page.tsx`, update the
 *   sibling `page.md` in the same change. Visual-only components
 *   (calculators, demos, icons, CTA buttons, layout chrome) are
 *   intentionally omitted from the markdown — keep copy, prices, links,
 *   and definitions aligned; drop the chrome.
 *
 *   `scripts/generate_llms_txts.js` walks `app/` for folders containing
 *   both `page.tsx` and `page.md` (no skip list — the dual-file check is
 *   the filter) and emits the `## Pages` section in `llms.txt` plus the
 *   marketing portion of `llms-full.txt`.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    // reverse proxy all API requests
    const apiOrigin = process.env.API_BASE_URL || "http://api:8080";
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
  // path. Rewrite to the internal /page-md/* route which resolves the
  // markdown source on disk.
  const url = request.nextUrl.clone();
  url.pathname = `/page-md${pathname === "/" ? "/index" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/yrtmlt/:path*",
    {
      source: "/((?!_next|page-md|api|yrtmlt|favicon\\.ico).*)",
      has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
    },
  ],
};
