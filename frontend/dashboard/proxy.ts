/**
 * Reverse proxies (`/api`, `/yrtmlt`) and markdown content negotiation.
 *
 * Docs pages, blog posts and the marketing pages with a hand-authored
 * `page.md` next to their `page.tsx` are also served as markdown, to
 * agents that prefer it in the Accept header or add `.md` to the URL.
 * `/privacy-policy` and `/terms-of-service` have no `page.md` on purpose.
 *
 * **Sync rule:** if you change a marketing `page.tsx`, update the
 * sibling `page.md` in the same change. Visual-only components
 * (calculators, demos, icons, CTA buttons, layout chrome) are
 * intentionally omitted from the markdown; keep copy, prices, links,
 * and definitions aligned and drop the chrome. A new or removed
 * `page.md` also goes in `app/utils/llms/markdown_twins.ts`.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { negotiate } from "@/app/utils/llms/content_negotiation";
import { MARKDOWN_TWIN_PATHS } from "@/app/utils/llms/markdown_twins";

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

  return negotiateRepresentation(request);
}

function markdownRoute(pagePath: string): string | null {
  if (pagePath === "/docs" || pagePath.startsWith("/docs/")) {
    return `/llms.docs${pagePath.slice("/docs".length)}`;
  }
  // Blog tag pages are post lists rendered by HTML components and have no
  // markdown source.
  if (
    pagePath === "/blog" ||
    (pagePath.startsWith("/blog/") && !pagePath.startsWith("/blog/tags/"))
  ) {
    return `/llms.blog${pagePath.slice("/blog".length)}`;
  }
  if (MARKDOWN_TWIN_PATHS.has(pagePath)) {
    return `/page-md${pagePath === "/" ? "/index" : pagePath}`;
  }
  return null;
}

function withVaryAccept(response: NextResponse): NextResponse {
  response.headers.append("Vary", "Accept");
  return response;
}

function negotiateRepresentation(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const explicitMarkdown = pathname.endsWith(".md");

  let pagePath = pathname.replace(/\.md$/, "").replace(/\/$/, "");
  // /index.md is the homepage's .md URL.
  if (explicitMarkdown && pagePath === "/index") {
    pagePath = "";
  }
  pagePath = pagePath || "/";

  const route = markdownRoute(pagePath);
  const rewriteToMarkdown = () => {
    const url = request.nextUrl.clone();
    url.pathname = route!;
    return NextResponse.rewrite(url);
  };

  // A .md URL asks for markdown whatever the Accept header says. Without a
  // markdown route, Next.js returns its 404 page.
  if (explicitMarkdown) {
    return route ? rewriteToMarkdown() : NextResponse.next();
  }

  // Server actions POST to page URLs with Accept: text/x-component, and
  // negotiating them as documents would return 406.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  // HTML is listed first so that a client which weights both equally,
  // such as a browser sending only */*, gets the HTML page.
  const offered = route ? ["text/html", "text/markdown"] : ["text/html"];
  const chosen = negotiate(request.headers.get("accept"), offered);

  if (chosen === null) {
    return withVaryAccept(
      new NextResponse(
        `Not Acceptable. Available representations: ${offered.join(", ")}\n`,
        {
          status: 406,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      ),
    );
  }
  if (chosen === "text/markdown") {
    return withVaryAccept(rewriteToMarkdown());
  }
  // Next.js replaces the Vary header of App Router page responses with its
  // own list, so a Vary: Accept set here would not reach the client. A
  // shared cache added in front of the app needs to vary HTML pages on
  // Accept itself.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/yrtmlt/:path*",
    // Route handlers and files in public/ are skipped, because negotiating
    // them as pages would return 406 to fetches that accept only JSON,
    // feeds or images. Docs slugs can contain dots
    // (/docs/hosting/migration-guides/v0.4.x), so the file extension check
    // does not apply under /docs and /blog.
    "/((?!_next|page-md|llms|api|yrtmlt|sandbox-attachments|auth/(?:callback|logout|refresh|status)(?:/|$)|docs/(?:assets|chat|search)(?:/|$)|blog/(?:assets/|rss\\.xml$))(?!(?!docs/|blog/).*\\.(?!md$)[^/.]+$).*)",
  ],
};
