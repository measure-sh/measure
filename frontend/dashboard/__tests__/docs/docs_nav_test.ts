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
    // Samples are derived from the nav so a doc rename cannot break the test
    const pairs = docsNav
      .filter((item) => (item.children ?? []).length > 0)
      .map((group) => ({
        label: group.title,
        leaf: group.children!.find((child) => child.slug),
      }))
      .filter((pair) => pair.leaf);
    expect(pairs.length).toBeGreaterThan(0);

    for (const { label, leaf } of pairs) {
      expect(findSectionTitle(leaf!.slug!)).toBe(label);
    }
  });

  it("returns the label for trailing leaves merged into the previous cluster", () => {
    // Top-level leaves that follow a labeled group belong to that group's cluster
    let lastGroupTitle: string | null = null;
    const trailing: Array<{ slug: string; label: string }> = [];
    for (const item of docsNav) {
      if ((item.children ?? []).length > 0) {
        lastGroupTitle = item.title;
      } else if (lastGroupTitle && item.slug) {
        trailing.push({ slug: item.slug, label: lastGroupTitle });
      }
    }
    expect(trailing.length).toBeGreaterThan(0);

    for (const { slug, label } of trailing) {
      expect(findSectionTitle(slug)).toBe(label);
    }
  });

  it("returns the label for nested group children", () => {
    const outerGroup = docsNav.find((item) =>
      (item.children ?? []).some((child) => (child.children ?? []).length > 0),
    );
    expect(outerGroup).toBeDefined();
    const nestedGroup = outerGroup!.children!.find(
      (child) => (child.children ?? []).length > 0,
    );
    const leaf = nestedGroup!.children!.find((child) => child.slug);
    expect(leaf).toBeDefined();

    expect(findSectionTitle(leaf!.slug!)).toBe(outerGroup!.title);
  });

  it("returns null for pages in the unlabeled lead cluster", () => {
    const firstGroupIndex = docsNav.findIndex(
      (item) => (item.children ?? []).length > 0,
    );
    expect(firstGroupIndex).toBeGreaterThan(0);
    const leadLeaves = docsNav
      .slice(0, firstGroupIndex)
      .filter((item) => item.slug);
    expect(leadLeaves.length).toBeGreaterThan(0);

    for (const leaf of leadLeaves) {
      expect(findSectionTitle(leaf.slug!)).toBeNull();
    }
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
    function collectDfs(items: NavItem[]): string[] {
      const slugs: string[] = [];
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug);
        }
        if (item.children) {
          slugs.push(...collectDfs(item.children));
        }
      }
      return slugs;
    }

    // The flat list is the docs root followed by a depth-first walk of the tree
    expect(getFlatNavSlugs()).toEqual(["/docs", ...collectDfs(docsNav)]);
  });

  it("contains more entries than top-level nav items due to nested children", () => {
    const slugs = getFlatNavSlugs();

    // /docs + all nav items with slugs (including deeply nested ones)
    expect(slugs.length).toBeGreaterThan(docsNav.length);
  });
});
