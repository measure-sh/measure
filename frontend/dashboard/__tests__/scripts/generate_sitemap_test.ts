import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

import {
  APP_DIR,
  buildSitemap,
  getBlogRoutes,
  getDocsRoutes,
  isDynamic,
  isExcluded,
  main,
  PUBLIC_DIR,
  ROOT,
  routeFromFile,
  SITE_URL,
  walk,
} from "@/scripts/generate_sitemap";

// ─── routeFromFile ──────────────────────────────────────────────────────────

describe("routeFromFile", () => {
  it("returns / for root page.tsx", () => {
    const file = path.join(APP_DIR, "page.tsx");

    expect(routeFromFile(file)).toBe("/");
  });

  it("returns /about for app/about/page.tsx", () => {
    const file = path.join(APP_DIR, "about", "page.tsx");

    expect(routeFromFile(file)).toBe("/about");
  });

  it("returns nested route for deeply nested page", () => {
    const file = path.join(APP_DIR, "product", "app-health", "page.tsx");

    expect(routeFromFile(file)).toBe("/product/app-health");
  });

  it("returns route with dynamic segments intact", () => {
    const file = path.join(APP_DIR, "[teamId]", "apps", "page.tsx");

    expect(routeFromFile(file)).toBe("/[teamId]/apps");
  });
});

// ─── getDocsRoutes ──────────────────────────────────────────────────────────

describe("getDocsRoutes", () => {
  it("maps index.mdx to its directory and leaf files to their path", () => {
    const routes = getDocsRoutes();

    expect(routes).toContain("/docs");
    expect(routes).toContain("/docs/hosting");
    expect(routes).toContain("/docs/sdk-integration-guide");
  });

  it("drops parenthesized folder-group segments from routes", () => {
    const routes = getDocsRoutes();

    expect(routes).toContain("/docs/features/feature-bug-report-android");
    for (const route of routes) {
      expect(route).not.toContain("(");
    }
  });

  it("has no duplicate routes", () => {
    const routes = getDocsRoutes();

    expect(new Set(routes).size).toBe(routes.length);
  });
});

// ─── getBlogRoutes ──────────────────────────────────────────────────────────

describe("getBlogRoutes", () => {
  it("maps each post file to its /blog route", () => {
    // Derived from the content on disk rather than pinned slugs, so
    // renaming a post can't leave this asserting a stale route.
    const files = fs
      .readdirSync(path.join(ROOT, "content", "blog"))
      .filter((name) => name.endsWith(".mdx"));
    const routes = getBlogRoutes();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(routes).toContain(`/blog/${file.replace(/\.mdx$/, "")}`);
    }
  });

  it("adds kebab-case tag routes under /blog/tags", () => {
    const tagRoutes = getBlogRoutes().filter((route) =>
      route.startsWith("/blog/tags/"),
    );

    expect(tagRoutes.length).toBeGreaterThan(0);
    for (const route of tagRoutes) {
      expect(route).toMatch(/^\/blog\/tags\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("has no duplicate routes", () => {
    const routes = getBlogRoutes();

    expect(new Set(routes).size).toBe(routes.length);
  });
});

// ─── isDynamic ──────────────────────────────────────────────────────────────

describe("isDynamic", () => {
  it("returns true for single dynamic segment", () => {
    expect(isDynamic("/[teamId]/apps")).toBe(true);
  });

  it("returns true for catch-all dynamic segment", () => {
    expect(isDynamic("/docs/[...slug]")).toBe(true);
  });

  it("returns true for optional catch-all segment", () => {
    expect(isDynamic("/docs/[[...slug]]")).toBe(true);
  });

  it("returns false for static route", () => {
    expect(isDynamic("/about")).toBe(false);
  });

  it("returns false for root route", () => {
    expect(isDynamic("/")).toBe(false);
  });

  it("returns false for nested static route", () => {
    expect(isDynamic("/product/app-health")).toBe(false);
  });
});

// ─── isExcluded ─────────────────────────────────────────────────────────────

describe("isExcluded", () => {
  it("returns true for /auth/ root", () => {
    expect(isExcluded("/auth/")).toBe(true);
  });

  it("returns true for /auth/login", () => {
    expect(isExcluded("/auth/login")).toBe(true);
  });

  it("returns true for nested auth routes", () => {
    expect(isExcluded("/auth/callback/google")).toBe(true);
  });

  it('returns false for routes that contain "auth" but are not under /auth/', () => {
    expect(isExcluded("/about/auth-team")).toBe(false);
  });

  it("returns false for marketing pages", () => {
    expect(isExcluded("/about")).toBe(false);
    expect(isExcluded("/pricing")).toBe(false);
    expect(isExcluded("/product/crashes-and-anrs")).toBe(false);
  });

  it("returns false for root", () => {
    expect(isExcluded("/")).toBe(false);
  });

  it("returns false for docs routes", () => {
    expect(isExcluded("/docs")).toBe(false);
    expect(isExcluded("/docs/features/feature-example")).toBe(false);
  });
});

// ─── walk ───────────────────────────────────────────────────────────────────

describe("walk", () => {
  it("finds page.tsx files in the app directory", () => {
    const files = walk(APP_DIR);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toMatch(/page\.tsx$/);
    }
  });

  it("includes the root page.tsx", () => {
    const files = walk(APP_DIR);
    const rootPage = path.join(APP_DIR, "page.tsx");

    expect(files).toContain(rootPage);
  });

  it("includes nested page.tsx files", () => {
    const files = walk(APP_DIR);
    const aboutPage = path.join(APP_DIR, "about", "page.tsx");

    expect(files).toContain(aboutPage);
  });

  it("does not include non-page files", () => {
    const files = walk(APP_DIR);

    for (const file of files) {
      expect(path.basename(file)).toBe("page.tsx");
    }
  });
});

// ─── buildSitemap ───────────────────────────────────────────────────────────

describe("buildSitemap", () => {
  it("generates valid XML with the correct declaration", () => {
    const xml = buildSitemap(["https://measure.sh"]);

    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it("wraps URLs in urlset element", () => {
    const xml = buildSitemap(["https://measure.sh"]);

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml).toContain("</urlset>");
  });

  it("includes each URL in a <url><loc> element", () => {
    const urls = ["https://measure.sh", "https://measure.sh/about"];
    const xml = buildSitemap(urls);

    expect(xml).toContain("<loc>https://measure.sh</loc>");
    expect(xml).toContain("<loc>https://measure.sh/about</loc>");
  });

  it("includes lastmod timestamps", () => {
    const xml = buildSitemap(["https://measure.sh"]);

    expect(xml).toMatch(
      /<lastmod>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z<\/lastmod>/,
    );
  });

  it("generates one <url> block per input URL", () => {
    const urls = ["https://a.com", "https://b.com", "https://c.com"];
    const xml = buildSitemap(urls);
    const urlBlocks = xml.match(/<url>/g);

    expect(urlBlocks).toHaveLength(3);
  });

  it("handles empty URL list", () => {
    const xml = buildSitemap([]);

    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("<url>");
  });
});

// ─── main (integration) ────────────────────────────────────────────────────

describe("main", () => {
  let writtenPath: string | null = null;
  let writtenContent: string | null = null;
  const originalWriteFileSync = fs.writeFileSync;

  beforeEach(() => {
    writtenPath = null;
    writtenContent = null;
    // Intercept writeFileSync to capture output without writing to disk
    jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation((filePath: any, content: any) => {
        writtenPath = filePath;
        writtenContent = content;
      });
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes sitemap.xml to the public directory", () => {
    main();

    expect(writtenPath).toBe(path.join(PUBLIC_DIR, "sitemap.xml"));
  });

  it("generates valid XML content", () => {
    main();

    expect(writtenContent).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>/,
    );
    expect(writtenContent).toContain("<urlset");
    expect(writtenContent).toContain("</urlset>");
  });

  it("includes the site root URL", () => {
    main();

    expect(writtenContent).toContain(`<loc>${SITE_URL}</loc>`);
  });

  it("includes static pages", () => {
    main();

    expect(writtenContent).toContain(`<loc>${SITE_URL}/about</loc>`);
    expect(writtenContent).toContain(`<loc>${SITE_URL}/pricing</loc>`);
  });

  it("excludes dynamic routes", () => {
    main();

    expect(writtenContent).not.toContain("[teamId]");
    expect(writtenContent).not.toContain("[...slug]");
  });

  it("excludes auth routes", () => {
    main();

    expect(writtenContent).not.toContain(`${SITE_URL}/auth/`);
    expect(writtenContent).not.toContain(`${SITE_URL}/auth/login`);
  });

  it("includes every docs page", () => {
    main();

    // getDocsRoutes derives routes from the content/docs sources on disk;
    // the derivation itself is covered by the getDocsRoutes tests, so this
    // only asserts that every derived route lands in the sitemap.
    const routes = getDocsRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(writtenContent).toContain(`<loc>${SITE_URL}${route}</loc>`);
    }
  });

  it("includes every blog post and tag page", () => {
    main();

    // Same shape as the docs assertion: the derivation is covered by the
    // getBlogRoutes tests, so this only asserts the routes land in the
    // sitemap.
    const routes = getBlogRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(writtenContent).toContain(`<loc>${SITE_URL}${route}</loc>`);
    }
  });

  it("produces sorted URLs", () => {
    main();

    const locs = (writtenContent as string).match(/<loc>(.+?)<\/loc>/g) || [];
    const urls = locs.map((l: string) => l.replace(/<\/?loc>/g, ""));
    const sorted = [...urls].sort();

    expect(urls).toEqual(sorted);
  });

  it("has no duplicate URLs", () => {
    main();

    const locs = (writtenContent as string).match(/<loc>(.+?)<\/loc>/g) || [];
    const urls = locs.map((l: string) => l.replace(/<\/?loc>/g, ""));
    const unique = new Set(urls);

    expect(urls.length).toBe(unique.size);
  });
});
