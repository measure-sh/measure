import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

// Mock next/server before importing the middleware so the import picks up
// the mock. NextResponse.rewrite captures the destination URL as a string.
jest.mock("next/server", () => ({
  NextResponse: {
    rewrite: (url: URL) => ({ type: "rewrite", url: url.toString() }),
    next: () => ({ type: "next" }),
  },
}));

import { config, middleware } from "@/middleware";

// Build a minimal stub of NextRequest. The middleware only touches
// `request.nextUrl.pathname`, `request.nextUrl.search`, and the cloned
// URL returned by `request.nextUrl.clone()`. Headers are not inspected
// by the function — they're filtered upstream by `config.matcher`.
function makeRequest(pathname: string, search = "", origin = "https://measure.sh") {
  return {
    nextUrl: {
      pathname,
      search,
      clone() {
        return new URL(`${origin}${pathname}${search}`);
      },
    },
  } as any;
}

describe("middleware", () => {
  const originalApi = process.env.API_BASE_URL;
  const originalPosthog = process.env.POSTHOG_HOST;

  beforeEach(() => {
    delete process.env.API_BASE_URL;
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
    it("rewrites /api/foo to the default API origin", () => {
      const result: any = middleware(makeRequest("/api/foo"));
      expect(result.type).toBe("rewrite");
      expect(result.url).toBe("http://api:8080/foo");
    });

    it("preserves query string", () => {
      const result: any = middleware(makeRequest("/api/users", "?limit=10&offset=20"));
      expect(result.url).toBe("http://api:8080/users?limit=10&offset=20");
    });

    it("uses API_BASE_URL env var when set", () => {
      process.env.API_BASE_URL = "https://api.example.com:9000";
      const result: any = middleware(makeRequest("/api/foo"));
      expect(result.url).toBe("https://api.example.com:9000/foo");
    });

    it("replaces only the first /api occurrence", () => {
      // /api/api-keys → after replace("/api", "") → /api-keys (not //-keys)
      const result: any = middleware(makeRequest("/api/api-keys"));
      expect(result.url).toBe("http://api:8080/api-keys");
    });

    it("handles a bare /api with no trailing path", () => {
      // After replacement pathname becomes "" — URL normalizes to "/"
      const result: any = middleware(makeRequest("/api"));
      expect(result.url).toBe("http://api:8080/");
    });

    it("handles a deeply nested path", () => {
      const result: any = middleware(makeRequest("/api/teams/abc/apps/xyz/sessions"));
      expect(result.url).toBe("http://api:8080/teams/abc/apps/xyz/sessions");
    });

    it("falls back to http://api:8080 when API_BASE_URL is empty string", () => {
      process.env.API_BASE_URL = "";
      const result: any = middleware(makeRequest("/api/foo"));
      expect(result.url).toBe("http://api:8080/foo");
    });
  });

  describe("/yrtmlt/static proxy", () => {
    it("rewrites /yrtmlt/static/array.js to PostHog assets CDN", () => {
      const result: any = middleware(makeRequest("/yrtmlt/static/array.js"));
      expect(result.url).toBe("https://us-assets.i.posthog.com/static/array.js");
    });

    it("preserves nested static paths", () => {
      const result: any = middleware(makeRequest("/yrtmlt/static/recorder/recorder.js"));
      expect(result.url).toBe("https://us-assets.i.posthog.com/static/recorder/recorder.js");
    });

    it("static branch takes precedence over generic /yrtmlt branch", () => {
      // Path starts with /yrtmlt/static/ so it must hit the assets CDN,
      // not the POSTHOG_HOST branch (which doesn't need to be set).
      const result: any = middleware(makeRequest("/yrtmlt/static/foo.js"));
      expect(result.url).toContain("us-assets.i.posthog.com");
    });
  });

  describe("/yrtmlt non-static proxy", () => {
    it("rewrites /yrtmlt/decide to POSTHOG_HOST", () => {
      process.env.POSTHOG_HOST = "https://us.posthog.com";
      const result: any = middleware(makeRequest("/yrtmlt/decide"));
      expect(result.url).toBe("https://us.posthog.com/decide");
    });

    it("handles POSTHOG_HOST with a custom port", () => {
      process.env.POSTHOG_HOST = "http://posthog.local:8000";
      const result: any = middleware(makeRequest("/yrtmlt/e"));
      expect(result.url).toBe("http://posthog.local:8000/e");
    });

    it("does not match the /static/ branch when path is /yrtmlt/static (no trailing slash)", () => {
      // "/yrtmlt/static".startsWith("/yrtmlt/static/") is false, so this
      // falls through to the generic /yrtmlt branch.
      process.env.POSTHOG_HOST = "https://us.posthog.com";
      const result: any = middleware(makeRequest("/yrtmlt/static"));
      expect(result.url).toBe("https://us.posthog.com/static");
    });

    it("throws when POSTHOG_HOST is unset (documented behavior)", () => {
      // The middleware constructs `new URL(process.env.POSTHOG_HOST || "")`.
      // Empty string is not a valid URL, so this throws — the runtime
      // contract assumes POSTHOG_HOST is set whenever /yrtmlt routes are live.
      expect(() => middleware(makeRequest("/yrtmlt/foo"))).toThrow();
    });
  });

  describe("markdown content negotiation (fall-through)", () => {
    it("rewrites / to /page-md/index (homepage sentinel)", () => {
      const result: any = middleware(makeRequest("/"));
      expect(result.url).toBe("https://measure.sh/page-md/index");
    });

    it("rewrites /about to /page-md/about", () => {
      const result: any = middleware(makeRequest("/about"));
      expect(result.url).toBe("https://measure.sh/page-md/about");
    });

    it("rewrites nested product paths", () => {
      const result: any = middleware(makeRequest("/product/mcp"));
      expect(result.url).toBe("https://measure.sh/page-md/product/mcp");
    });

    it("rewrites docs paths so /page-md/[...path]/route.ts can serve them", () => {
      const result: any = middleware(makeRequest("/docs/sdk-integration-guide"));
      expect(result.url).toBe("https://measure.sh/page-md/docs/sdk-integration-guide");
    });

    it("rewrites pages with query strings (search params preserved on the URL)", () => {
      const result: any = middleware(makeRequest("/about", "?utm=email"));
      expect(result.url).toBe("https://measure.sh/page-md/about?utm=email");
    });

    it("preserves the original origin", () => {
      const result: any = middleware(makeRequest("/pricing", "", "http://localhost:3000"));
      expect(result.url).toBe("http://localhost:3000/page-md/pricing");
    });
  });

  describe("config.matcher", () => {
    it("exports three matcher entries", () => {
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher).toHaveLength(3);
    });

    it("first entry routes /api/:path*", () => {
      expect(config.matcher[0]).toBe("/api/:path*");
    });

    it("second entry routes /yrtmlt/:path*", () => {
      expect(config.matcher[1]).toBe("/yrtmlt/:path*");
    });

    it("third entry is an object with source + has filter", () => {
      const m: any = config.matcher[2];
      expect(typeof m).toBe("object");
      expect(m.source).toBe("/((?!_next|page-md|api|yrtmlt|favicon\\.ico).*)");
      expect(m.has).toEqual([
        { type: "header", key: "accept", value: ".*text/markdown.*" },
      ]);
    });

    it("third entry's source excludes Next internals, the markdown route itself, API and PostHog proxies, and favicon", () => {
      const m: any = config.matcher[2];
      const sourceRegex = new RegExp(
        m.source
          .replace("/((?!", "^/(?!")
          .replace(").*)", ").*$"),
      );
      // Should NOT match (filtered by negative lookahead)
      expect(sourceRegex.test("/_next/static/foo.js")).toBe(false);
      expect(sourceRegex.test("/page-md/about")).toBe(false);
      expect(sourceRegex.test("/api/teams")).toBe(false);
      expect(sourceRegex.test("/yrtmlt/decide")).toBe(false);
      expect(sourceRegex.test("/favicon.ico")).toBe(false);
      // Should match (paths the markdown rewrite handles)
      expect(sourceRegex.test("/about")).toBe(true);
      expect(sourceRegex.test("/docs/foo")).toBe(true);
      expect(sourceRegex.test("/product/mcp")).toBe(true);
    });

    it("`has.value` regex matches text/markdown in common Accept formats", () => {
      const m: any = config.matcher[2];
      const re = new RegExp(m.has[0].value);
      expect(re.test("text/markdown")).toBe(true);
      expect(re.test("text/markdown;q=0.9")).toBe(true);
      expect(re.test("text/html, text/markdown")).toBe(true);
      expect(re.test("application/json")).toBe(false);
      expect(re.test("text/html")).toBe(false);
    });

    it("`has.value` regex is intentionally loose — matches text/markdownx too", () => {
      // The pattern `.*text/markdown.*` has no word boundary, so subtypes
      // like `text/markdownx` would also satisfy the matcher. No real
      // client sends that, but flagging here so future tightening is
      // explicit.
      const m: any = config.matcher[2];
      const re = new RegExp(m.has[0].value);
      expect(re.test("text/markdownx")).toBe(true);
    });
  });

  describe("path edge cases", () => {
    it("/api/ with trailing slash rewrites to API origin root", () => {
      // pathname.replace("/api", "") → "/", URL keeps it
      const result: any = middleware(makeRequest("/api/"));
      expect(result.url).toBe("http://api:8080/");
    });

    it("/api/foo/ preserves trailing slash on the rewritten path", () => {
      const result: any = middleware(makeRequest("/api/foo/"));
      expect(result.url).toBe("http://api:8080/foo/");
    });

    it("preserves percent-encoded segments through the API rewrite", () => {
      const result: any = middleware(makeRequest("/api/teams/team%20one"));
      expect(result.url).toBe("http://api:8080/teams/team%20one");
    });

    it("preserves a leading double slash after /api stripping", () => {
      // /api//foo → pathname.replace("/api", "") → "//foo"
      // URL does not collapse the double slash; documents existing behavior.
      const result: any = middleware(makeRequest("/api//foo"));
      expect(result.url).toBe("http://api:8080//foo");
    });

    it("markdown rewrite preserves a trailing slash on marketing paths", () => {
      const result: any = middleware(makeRequest("/about/"));
      expect(result.url).toBe("https://measure.sh/page-md/about/");
    });
  });

  describe("header behavior", () => {
    it("API branch does not consult Accept header — /api routes to API origin regardless", () => {
      // Even if the markdown matcher fires alongside the /api matcher,
      // the function's if-chain checks pathname first and routes the
      // request to the API origin. Agents requesting /api/foo with
      // Accept: text/markdown still hit the API.
      const req = makeRequest("/api/foo");
      // Provide a headers object to make the test's intent explicit;
      // the function should not read it.
      req.headers = {
        get: (name: string) =>
          name.toLowerCase() === "accept" ? "text/markdown" : null,
      };
      const result: any = middleware(req);
      expect(result.url).toBe("http://api:8080/foo");
    });
  });

  describe("POSTHOG_HOST configuration edge cases", () => {
    it("throws when POSTHOG_HOST is a non-URL string", () => {
      process.env.POSTHOG_HOST = "not-a-url";
      expect(() => middleware(makeRequest("/yrtmlt/foo"))).toThrow();
    });

    it("silently drops the path component of POSTHOG_HOST", () => {
      // The middleware reads only protocol/hostname/port off POSTHOG_HOST
      // and overwrites pathname with the rewritten /yrtmlt/* path. Any
      // path in POSTHOG_HOST (e.g. /proxy) is therefore discarded.
      process.env.POSTHOG_HOST = "https://us.posthog.com/proxy";
      const result: any = middleware(makeRequest("/yrtmlt/decide"));
      expect(result.url).toBe("https://us.posthog.com/decide");
    });
  });
});
