import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

// Mock next/server before importing the proxy so the import picks up
// the mock. NextResponse.rewrite captures the destination URL as a string.
jest.mock("next/server", () => {
  class FakeHeaders {
    private values = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      for (const [key, value] of Object.entries(init ?? {})) {
        this.set(key, value);
      }
    }
    get(key: string) {
      return this.values.get(key.toLowerCase()) ?? null;
    }
    set(key: string, value: string) {
      this.values.set(key.toLowerCase(), value);
    }
    append(key: string, value: string) {
      const existing = this.get(key);
      this.set(key, existing === null ? value : `${existing}, ${value}`);
    }
  }
  class NextResponse {
    type = "response";
    url?: string;
    status: number;
    body: unknown;
    headers: FakeHeaders;
    constructor(
      body?: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new FakeHeaders(init?.headers);
    }
    static rewrite(url: URL) {
      const response = new NextResponse();
      response.type = "rewrite";
      response.url = url.toString();
      return response;
    }
    static next() {
      const response = new NextResponse();
      response.type = "next";
      return response;
    }
  }
  return { NextResponse };
});

import { config, proxy } from "@/proxy";

// Build a minimal stub of NextRequest. The proxy only touches
// `request.nextUrl`, `request.method` and `request.headers.get`.
function makeRequest(
  pathname: string,
  search = "",
  origin = "https://measure.sh",
  {
    accept = null,
    method = "GET",
    headers = {},
  }: {
    accept?: string | null;
    method?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const allHeaders: Record<string, string> = { ...headers };
  if (accept !== null) {
    allHeaders.accept = accept;
  }
  return {
    method,
    headers: {
      get: (name: string) => allHeaders[name.toLowerCase()] ?? null,
    },
    nextUrl: {
      pathname,
      search,
      clone() {
        return new URL(`${origin}${pathname}${search}`);
      },
    },
  } as any;
}

function markdownRequest(pathname: string, search = "", origin?: string) {
  return makeRequest(pathname, search, origin, { accept: "text/markdown" });
}

describe("proxy", () => {
  const originalApi = process.env.API_BASE_URL;
  const originalPosthog = process.env.POSTHOG_HOST;

  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:8080";
    delete process.env.POSTHOG_HOST;
  });

  afterEach(() => {
    if (originalApi === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = originalApi;
    }
    if (originalPosthog === undefined) {
      delete process.env.POSTHOG_HOST;
    } else {
      process.env.POSTHOG_HOST = originalPosthog;
    }
  });

  describe("/api proxy", () => {
    it("rewrites /api/foo to the API origin", () => {
      const result: any = proxy(makeRequest("/api/foo"));
      expect(result.type).toBe("rewrite");
      expect(result.url).toBe("http://api:8080/foo");
    });

    it("preserves query string", () => {
      const result: any = proxy(
        makeRequest("/api/users", "?limit=10&offset=20"),
      );
      expect(result.url).toBe("http://api:8080/users?limit=10&offset=20");
    });

    it("uses API_BASE_URL env var when set", () => {
      process.env.API_BASE_URL = "https://api.example.com:9000";
      const result: any = proxy(makeRequest("/api/foo"));
      expect(result.url).toBe("https://api.example.com:9000/foo");
    });

    it("replaces only the first /api occurrence", () => {
      // /api/api-keys → after replace("/api", "") → /api-keys (not //-keys)
      const result: any = proxy(makeRequest("/api/api-keys"));
      expect(result.url).toBe("http://api:8080/api-keys");
    });

    it("handles a bare /api with no trailing path", () => {
      // After replacement pathname becomes "" — URL normalizes to "/"
      const result: any = proxy(makeRequest("/api"));
      expect(result.url).toBe("http://api:8080/");
    });

    it("handles a deeply nested path", () => {
      const result: any = proxy(
        makeRequest("/api/teams/abc/apps/xyz/sessions"),
      );
      expect(result.url).toBe("http://api:8080/teams/abc/apps/xyz/sessions");
    });

    it("throws when API_BASE_URL is unset", () => {
      delete process.env.API_BASE_URL;
      expect(() => proxy(makeRequest("/api/foo"))).toThrow(
        "API_BASE_URL is not set",
      );
    });

    it("throws when API_BASE_URL is an empty string", () => {
      process.env.API_BASE_URL = "";
      expect(() => proxy(makeRequest("/api/foo"))).toThrow(
        "API_BASE_URL is not set",
      );
    });
  });

  describe("/yrtmlt/static proxy", () => {
    it("rewrites /yrtmlt/static/array.js to PostHog assets CDN", () => {
      const result: any = proxy(makeRequest("/yrtmlt/static/array.js"));
      expect(result.url).toBe(
        "https://us-assets.i.posthog.com/static/array.js",
      );
    });

    it("preserves nested static paths", () => {
      const result: any = proxy(
        makeRequest("/yrtmlt/static/recorder/recorder.js"),
      );
      expect(result.url).toBe(
        "https://us-assets.i.posthog.com/static/recorder/recorder.js",
      );
    });

    it("static branch takes precedence over generic /yrtmlt branch", () => {
      // Path starts with /yrtmlt/static/ so it must hit the assets CDN,
      // not the POSTHOG_HOST branch (which doesn't need to be set).
      const result: any = proxy(makeRequest("/yrtmlt/static/foo.js"));
      expect(result.url).toContain("us-assets.i.posthog.com");
    });
  });

  describe("/yrtmlt non-static proxy", () => {
    it("rewrites /yrtmlt/decide to POSTHOG_HOST", () => {
      process.env.POSTHOG_HOST = "https://us.posthog.com";
      const result: any = proxy(makeRequest("/yrtmlt/decide"));
      expect(result.url).toBe("https://us.posthog.com/decide");
    });

    it("handles POSTHOG_HOST with a custom port", () => {
      process.env.POSTHOG_HOST = "http://posthog.local:8000";
      const result: any = proxy(makeRequest("/yrtmlt/e"));
      expect(result.url).toBe("http://posthog.local:8000/e");
    });

    it("does not match the /static/ branch when path is /yrtmlt/static (no trailing slash)", () => {
      // "/yrtmlt/static".startsWith("/yrtmlt/static/") is false, so this
      // falls through to the generic /yrtmlt branch.
      process.env.POSTHOG_HOST = "https://us.posthog.com";
      const result: any = proxy(makeRequest("/yrtmlt/static"));
      expect(result.url).toBe("https://us.posthog.com/static");
    });

    it("throws when POSTHOG_HOST is unset (documented behavior)", () => {
      // The proxy constructs `new URL(process.env.POSTHOG_HOST || "")`.
      // Empty string is not a valid URL, so this throws — the runtime
      // contract assumes POSTHOG_HOST is set whenever /yrtmlt routes are live.
      expect(() => proxy(makeRequest("/yrtmlt/foo"))).toThrow();
    });
  });

  describe("markdown rewrites for markdown-preferring requests", () => {
    it("rewrites / to /page-md/index (homepage sentinel)", () => {
      const result: any = proxy(markdownRequest("/"));
      expect(result.url).toBe("https://measure.sh/page-md/index");
    });

    it("rewrites /about to /page-md/about", () => {
      const result: any = proxy(markdownRequest("/about"));
      expect(result.url).toBe("https://measure.sh/page-md/about");
    });

    it("rewrites nested product paths", () => {
      const result: any = proxy(markdownRequest("/product/mcp"));
      expect(result.url).toBe("https://measure.sh/page-md/product/mcp");
    });

    it("rewrites docs paths to the /llms.docs processed-markdown route", () => {
      const result: any = proxy(
        markdownRequest("/docs/getting-started/android"),
      );
      expect(result.url).toBe(
        "https://measure.sh/llms.docs/getting-started/android",
      );
    });

    it("rewrites the docs index to /llms.docs (no trailing segment)", () => {
      const result: any = proxy(markdownRequest("/docs"));
      expect(result.url).toBe("https://measure.sh/llms.docs");
    });

    it("rewrites nested docs paths", () => {
      const result: any = proxy(
        markdownRequest("/docs/network-monitoring/endpoint-patterns"),
      );
      expect(result.url).toBe(
        "https://measure.sh/llms.docs/network-monitoring/endpoint-patterns",
      );
    });

    it("rewrites blog post paths to the /llms.blog processed-markdown route", () => {
      const result: any = proxy(markdownRequest("/blog/some-post"));
      expect(result.url).toBe("https://measure.sh/llms.blog/some-post");
    });

    it("rewrites the blog index to /llms.blog (markdown post index)", () => {
      const result: any = proxy(markdownRequest("/blog"));
      expect(result.url).toBe("https://measure.sh/llms.blog");
    });

    it("rewrites pages with query strings (search params preserved on the URL)", () => {
      const result: any = proxy(markdownRequest("/about", "?utm=email"));
      expect(result.url).toBe("https://measure.sh/page-md/about?utm=email");
    });

    it("preserves the original origin", () => {
      const result: any = proxy(
        markdownRequest("/pricing", "", "http://localhost:3000"),
      );
      expect(result.url).toBe("http://localhost:3000/page-md/pricing");
    });

    it("drops a trailing slash when resolving the markdown route", () => {
      const result: any = proxy(markdownRequest("/about/"));
      expect(result.url).toBe("https://measure.sh/page-md/about");
    });

    it("sets Vary: Accept on markdown rewrites", () => {
      const result: any = proxy(markdownRequest("/about"));
      expect(result.headers.get("vary")).toBe("Accept");
    });

    it("serves HEAD requests the same way as GET", () => {
      const result: any = proxy(
        makeRequest("/about", "", undefined, {
          accept: "text/markdown",
          method: "HEAD",
        }),
      );
      expect(result.url).toBe("https://measure.sh/page-md/about");
    });
  });

  describe("q-value negotiation", () => {
    function negotiated(pathname: string, accept: string | null) {
      return proxy(makeRequest(pathname, "", undefined, { accept })) as any;
    }

    it("serves HTML when markdown is refused with q=0", () => {
      const result = negotiated("/about", "text/markdown;q=0, */*");
      expect(result.type).toBe("next");
    });

    it("serves HTML when the client ranks HTML higher", () => {
      const result = negotiated("/about", "text/html, text/markdown;q=0.1");
      expect(result.type).toBe("next");
    });

    it("serves markdown when the client ranks markdown higher", () => {
      const result = negotiated(
        "/docs/mcp",
        "text/html;q=0.5, text/markdown;q=0.9",
      );
      expect(result.url).toBe("https://measure.sh/llms.docs/mcp");
    });

    it("breaks a q tie by the order in the Accept header", () => {
      expect(negotiated("/about", "text/markdown, text/html").url).toBe(
        "https://measure.sh/page-md/about",
      );
      expect(negotiated("/about", "text/html, text/markdown").type).toBe(
        "next",
      );
    });

    it("serves HTML to browsers", () => {
      const result = negotiated(
        "/about",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      );
      expect(result.type).toBe("next");
    });

    it("serves HTML for */* and for a missing Accept header", () => {
      expect(negotiated("/about", "*/*").type).toBe("next");
      expect(negotiated("/about", null).type).toBe("next");
    });

    it("serves HTML for a page without a twin when HTML is acceptable", () => {
      const result = negotiated(
        "/privacy-policy",
        "text/markdown, text/html;q=0.9",
      );
      expect(result.type).toBe("next");
    });

    it("serves HTML for blog tag pages, which have no markdown", () => {
      const result = negotiated(
        "/blog/tags/android",
        "text/markdown, text/html;q=0.9",
      );
      expect(result.type).toBe("next");
    });

    it("does not treat /docsomething or /blogsomething as docs or blog", () => {
      const accept = "text/markdown, text/html;q=0.9";
      expect(negotiated("/docsomething", accept).type).toBe("next");
      expect(negotiated("/blogsomething", accept).type).toBe("next");
    });

    it("returns 406 with Vary: Accept when a page without a twin is asked for markdown only", () => {
      const result = negotiated("/privacy-policy", "text/markdown");
      expect(result.status).toBe(406);
      expect(result.headers.get("vary")).toBe("Accept");
      expect(result.body).toContain("text/html");
      expect(result.body).not.toContain("text/markdown");
    });

    it("returns 406 when the client refuses both representations", () => {
      const result = negotiated("/about", "application/pdf");
      expect(result.status).toBe(406);
      expect(result.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      expect(result.body).toContain("text/html, text/markdown");
    });

    it("passes server actions through without negotiating", () => {
      const result: any = proxy(
        makeRequest("/about", "", undefined, {
          accept: "text/x-component",
          method: "POST",
        }),
      );
      expect(result.type).toBe("next");
    });
  });

  describe(".md URLs", () => {
    function md(pathname: string) {
      return proxy(
        makeRequest(pathname, "", undefined, { accept: "text/html" }),
      ) as any;
    }

    it("serves markdown for a marketing page whatever the Accept header says", () => {
      expect(md("/about.md").url).toBe("https://measure.sh/page-md/about");
      expect(md("/product/mcp.md").url).toBe(
        "https://measure.sh/page-md/product/mcp",
      );
    });

    it("maps /index.md to the homepage twin", () => {
      expect(md("/index.md").url).toBe("https://measure.sh/page-md/index");
    });

    it("strips the suffix on docs and blog paths instead of double-suffixing", () => {
      expect(md("/docs/getting-started/android.md").url).toBe(
        "https://measure.sh/llms.docs/getting-started/android",
      );
      expect(md("/blog/some-post.md").url).toBe(
        "https://measure.sh/llms.blog/some-post",
      );
    });

    it("routes /docs.md and /blog.md to the index routes", () => {
      expect(md("/docs.md").url).toBe("https://measure.sh/llms.docs");
      expect(md("/blog.md").url).toBe("https://measure.sh/llms.blog");
    });

    it("passes a .md URL without a markdown route through to the 404 page", () => {
      expect(md("/privacy-policy.md").type).toBe("next");
      expect(md("/blog/tags/android.md").type).toBe("next");
    });
  });

  describe("config.matcher", () => {
    const pageMatcher = config.matcher[2];
    const pageRegex = new RegExp(
      `^${pageMatcher.replace("/(", "/").slice(0, -1)}$`,
    );

    it("routes /api and /yrtmlt to the reverse proxies", () => {
      expect(config.matcher[0]).toBe("/api/:path*");
      expect(config.matcher[1]).toBe("/yrtmlt/:path*");
      expect(config.matcher).toHaveLength(3);
    });

    it.each([
      "/",
      "/about",
      "/about.md",
      "/index.md",
      "/docs",
      "/docs/foo",
      "/docs/foo.md",
      "/docs/chatbots",
      "/docs/hosting/migration-guides/v0.4.x",
      "/docs/hosting/migration-guides/v0.12.x.md",
      "/docs.md",
      "/blog/some-post",
      "/blog/some.post.md",
      "/product/mcp",
      "/auth/login",
      "/sandbox",
      "/privacy-policy",
    ])("negotiates %s", (path) => {
      expect(pageRegex.test(path)).toBe(true);
    });

    it.each([
      "/_next/static/foo.js",
      "/page-md/about",
      "/llms.txt",
      "/llms-full.txt",
      "/llms.docs/getting-started/android",
      "/llms.blog/some-post",
      "/api/teams",
      "/yrtmlt/decide",
      "/favicon.ico",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
      "/blog/rss.xml",
      "/docs/assets/foo.png",
      "/blog/assets/foo.png",
      "/images/foo.bar.png",
      "/docs/chat",
      "/docs/search",
      "/auth/callback/github",
      "/auth/logout",
      "/auth/refresh",
      "/sandbox-attachments/abc",
    ])("skips %s", (path) => {
      expect(pageRegex.test(path)).toBe(false);
    });

    // A route handler that serves JSON, images or redirects would get a
    // 406 from negotiation when its caller accepts only those types.
    it("skips every route handler under app/", () => {
      const fs = jest.requireActual<typeof import("fs")>("fs");
      const path = jest.requireActual<typeof import("path")>("path");
      const appDir = path.join(process.cwd(), "app");
      const routes: string[] = [];
      function walk(dir: string, segments: string[]) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), [...segments, entry.name]);
          } else if (/^route\.(ts|tsx|js)$/.test(entry.name)) {
            routes.push(
              "/" +
                segments
                  .filter((s) => !/^\(.*\)$/.test(s))
                  .map((s) => (s.startsWith("[") ? "x" : s))
                  .join("/"),
            );
          }
        }
      }
      walk(appDir, []);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.filter((route) => pageRegex.test(route))).toEqual([]);
    });

    it("skips every file in public/", () => {
      const fs = jest.requireActual<typeof import("fs")>("fs");
      const path = jest.requireActual<typeof import("path")>("path");
      const publicDir = path.join(process.cwd(), "public");
      const files = (
        fs.readdirSync(publicDir, { recursive: true }) as string[]
      ).filter((rel) => fs.statSync(path.join(publicDir, rel)).isFile());
      expect(files.length).toBeGreaterThan(0);
      expect(
        files
          .map((rel) => `/${rel.split(path.sep).join("/")}`)
          .filter((url) => pageRegex.test(url)),
      ).toEqual([]);
    });
  });

  describe("path edge cases", () => {
    it("/api/ with trailing slash rewrites to API origin root", () => {
      // pathname.replace("/api", "") → "/", URL keeps it
      const result: any = proxy(makeRequest("/api/"));
      expect(result.url).toBe("http://api:8080/");
    });

    it("/api/foo/ preserves trailing slash on the rewritten path", () => {
      const result: any = proxy(makeRequest("/api/foo/"));
      expect(result.url).toBe("http://api:8080/foo/");
    });

    it("preserves percent-encoded segments through the API rewrite", () => {
      const result: any = proxy(makeRequest("/api/teams/team%20one"));
      expect(result.url).toBe("http://api:8080/teams/team%20one");
    });

    it("preserves a leading double slash after /api stripping", () => {
      // /api//foo → pathname.replace("/api", "") → "//foo"
      // URL does not collapse the double slash; documents existing behavior.
      const result: any = proxy(makeRequest("/api//foo"));
      expect(result.url).toBe("http://api:8080//foo");
    });
  });

  describe("header behavior", () => {
    it("API branch does not consult Accept header — /api routes to API origin regardless", () => {
      // Even if the markdown matcher fires alongside the /api matcher,
      // the function's if-chain checks pathname first and routes the
      // request to the API origin. Agents requesting /api/foo with
      // Accept: text/markdown still hit the API.
      const result: any = proxy(markdownRequest("/api/foo"));
      expect(result.url).toBe("http://api:8080/foo");
    });
  });

  describe("POSTHOG_HOST configuration edge cases", () => {
    it("throws when POSTHOG_HOST is a non-URL string", () => {
      process.env.POSTHOG_HOST = "not-a-url";
      expect(() => proxy(makeRequest("/yrtmlt/foo"))).toThrow();
    });

    it("silently drops the path component of POSTHOG_HOST", () => {
      // The proxy reads only protocol/hostname/port off POSTHOG_HOST
      // and overwrites pathname with the rewritten /yrtmlt/* path. Any
      // path in POSTHOG_HOST (e.g. /proxy) is therefore discarded.
      process.env.POSTHOG_HOST = "https://us.posthog.com/proxy";
      const result: any = proxy(makeRequest("/yrtmlt/decide"));
      expect(result.url).toBe("https://us.posthog.com/decide");
    });
  });
});
