import {
  buildClusters,
  docsNav,
  findSectionTitle,
  getFlatNavSlugs,
  type NavItem,
} from "@/app/docs/docs_nav";
import { describe, expect, it } from "@jest/globals";

describe("buildClusters", () => {
  it("labels group clusters and merges leading leaves into an unlabeled cluster", () => {
    const clusters = buildClusters([
      { title: "Overview", slug: "/docs" },
      { title: "Getting Started", slug: "/docs/start" },
      { title: "Features", children: [{ title: "A", slug: "/docs/f/a" }] },
    ]);
    expect(clusters.length).toBe(2);
    expect(clusters[0].label).toBeUndefined();
    expect(clusters[0].items.map((i) => i.title)).toEqual([
      "Overview",
      "Getting Started",
    ]);
    expect(clusters[1].label).toBe("Features");
  });

  it("merges trailing leaves into the previous labeled cluster", () => {
    const clusters = buildClusters([
      { title: "Features", children: [{ title: "A", slug: "/docs/f/a" }] },
      { title: "Configuration Options", slug: "/docs/f/config" },
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].label).toBe("Features");
    expect(clusters[0].items.map((i) => i.title)).toEqual([
      "A",
      "Configuration Options",
    ]);
  });
});

describe("findSectionTitle", () => {
  it("returns the cluster label for pages inside a labeled cluster", () => {
    expect(findSectionTitle("/docs/features/feature-crash-reporting")).toBe(
      "Features",
    );
  });

  it("returns the label for trailing leaves merged into the previous cluster", () => {
    expect(findSectionTitle("/docs/features/configuration-options")).toBe(
      "Features",
    );
    expect(findSectionTitle("/docs/features/performance-impact")).toBe(
      "Features",
    );
  });

  it("returns the label for nested group children", () => {
    const title = findSectionTitle("/docs/features/feature-bug-report-android");
    expect(title).toBe("Features");
  });

  it("returns null for pages in the unlabeled lead cluster", () => {
    expect(findSectionTitle("/docs/sdk-integration-guide")).toBeNull();
  });

  it("returns null for slugs missing from the nav", () => {
    expect(findSectionTitle("/docs/not-a-real-page")).toBeNull();
  });
});

describe("docsNav", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(docsNav)).toBe(true);
    expect(docsNav.length).toBeGreaterThan(0);
  });

  it("has a title on every item", () => {
    function checkTitles(items: NavItem[]) {
      for (const item of items) {
        expect(typeof item.title).toBe("string");
        expect(item.title.length).toBeGreaterThan(0);
        if (item.children) {
          checkTitles(item.children);
        }
      }
    }

    checkTitles(docsNav);
  });

  it("every leaf item has a slug", () => {
    function checkLeaves(items: NavItem[]) {
      for (const item of items) {
        if (!item.children || item.children.length === 0) {
          expect(item.slug).toBeDefined();
          expect(item.slug).toMatch(/^\/docs/);
        }
        if (item.children) {
          checkLeaves(item.children);
        }
      }
    }

    checkLeaves(docsNav);
  });

  it("all slugs start with /docs/", () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = [];
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug);
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children));
        }
      }
      return slugs;
    }

    const slugs = collectSlugs(docsNav);

    for (const slug of slugs) {
      expect(slug).toMatch(/^\/docs\//);
    }
  });

  it("has no duplicate slugs", () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = [];
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug);
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children));
        }
      }
      return slugs;
    }

    const slugs = collectSlugs(docsNav);
    const unique = new Set(slugs);

    expect(slugs.length).toBe(unique.size);
  });
});

describe("getFlatNavSlugs", () => {
  it("starts with /docs as the first entry", () => {
    const slugs = getFlatNavSlugs();

    expect(slugs[0]).toBe("/docs");
  });

  it("returns a flat array of strings", () => {
    const slugs = getFlatNavSlugs();

    expect(Array.isArray(slugs)).toBe(true);
    for (const slug of slugs) {
      expect(typeof slug).toBe("string");
    }
  });

  it("includes all slugs from the nav tree", () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = [];
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug);
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children));
        }
      }
      return slugs;
    }

    const flatSlugs = getFlatNavSlugs();
    const treeSlugs = collectSlugs(docsNav);

    for (const slug of treeSlugs) {
      expect(flatSlugs).toContain(slug);
    }
  });

  it("has no duplicate entries", () => {
    const slugs = getFlatNavSlugs();
    const unique = new Set(slugs);

    expect(slugs.length).toBe(unique.size);
  });

  it("preserves depth-first traversal order", () => {
    const slugs = getFlatNavSlugs();

    // Getting Started should come before Features children
    const gettingStarted = slugs.indexOf("/docs/sdk-integration-guide");
    const sessionTimelines = slugs.indexOf(
      "/docs/features/feature-session-timelines",
    );

    expect(gettingStarted).toBeLessThan(sessionTimelines);

    // SDK Upgrade Guides should come after Performance Impact
    const performanceImpact = slugs.indexOf(
      "/docs/features/performance-impact",
    );
    const upgradeGuides = slugs.indexOf("/docs/sdk-upgrade-guides");

    expect(performanceImpact).toBeLessThan(upgradeGuides);
  });

  it("contains more entries than top-level nav items due to nested children", () => {
    const slugs = getFlatNavSlugs();

    // /docs + all nav items with slugs (including deeply nested ones)
    expect(slugs.length).toBeGreaterThan(docsNav.length);
  });
});
