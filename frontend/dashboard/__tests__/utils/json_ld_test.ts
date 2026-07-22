import { describe, expect, it } from "@jest/globals";
import {
  absoluteUrl,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  techArticleJsonLd,
  webPageJsonLd,
} from "@/app/utils/json_ld";
import { previewImage, siteOrigin } from "@/app/utils/metadata";

describe("absoluteUrl", () => {
  it("returns the origin without a trailing slash for the root path", () => {
    expect(absoluteUrl("/")).toBe(siteOrigin);
  });

  it("prefixes other paths with the origin", () => {
    expect(absoluteUrl("/pricing")).toBe(`${siteOrigin}/pricing`);
  });
});

describe("webPageJsonLd", () => {
  const seo = {
    title: "Pricing & Plans",
    description: "What Measure costs.",
    path: "/pricing",
  };

  it("builds a WebPage node by default", () => {
    expect(webPageJsonLd(seo)).toEqual({
      "@type": "WebPage",
      name: "Pricing & Plans",
      description: "What Measure costs.",
      url: `${siteOrigin}/pricing`,
    });
  });

  it("accepts a more specific page type", () => {
    expect(webPageJsonLd(seo, "AboutPage")["@type"]).toBe("AboutPage");
  });
});

describe("blogPostingJsonLd", () => {
  const post = {
    title: "Mobile breaks differently",
    description: "Why mobile failures are stateful.",
    path: "/blog/mobile-breaks-differently",
    datePublished: "2026-04-17",
    authorName: "Anup Cowkur",
    image: "/blog/assets/hero.webp",
    tags: ["observability", "error-monitoring"],
  };

  it("maps post fields onto a BlogPosting node", () => {
    expect(blogPostingJsonLd(post)).toEqual({
      "@type": "BlogPosting",
      headline: "Mobile breaks differently",
      description: "Why mobile failures are stateful.",
      url: `${siteOrigin}/blog/mobile-breaks-differently`,
      mainEntityOfPage: `${siteOrigin}/blog/mobile-breaks-differently`,
      datePublished: "2026-04-17",
      author: { "@type": "Person", name: "Anup Cowkur" },
      image: `${siteOrigin}/blog/assets/hero.webp`,
      keywords: "observability, error-monitoring",
      publisher: organizationJsonLd,
    });
  });

  it("falls back to the site preview image when the post has no cover", () => {
    const node = blogPostingJsonLd({ ...post, image: undefined });
    expect(node.image).toBe(`${siteOrigin}${previewImage}`);
  });

  it("omits keywords when the post has no tags", () => {
    expect(blogPostingJsonLd({ ...post, tags: [] })).not.toHaveProperty(
      "keywords",
    );
  });

  it("omits the description when the post has none", () => {
    expect(
      blogPostingJsonLd({ ...post, description: undefined }),
    ).not.toHaveProperty("description");
  });
});

describe("techArticleJsonLd", () => {
  it("builds a TechArticle attributed to the organization", () => {
    const node = techArticleJsonLd({
      headline: "Crash Reporting",
      description: "Track crashes.",
      path: "/docs/features/feature-crash-reporting",
    });
    expect(node).toEqual({
      "@type": "TechArticle",
      headline: "Crash Reporting",
      description: "Track crashes.",
      url: `${siteOrigin}/docs/features/feature-crash-reporting`,
      mainEntityOfPage: `${siteOrigin}/docs/features/feature-crash-reporting`,
      author: organizationJsonLd,
      publisher: organizationJsonLd,
    });
  });
});

describe("breadcrumbJsonLd", () => {
  it("builds sequential ListItems with absolute URLs", () => {
    const node = breadcrumbJsonLd([
      { name: "Docs", url: "/docs" },
      {
        name: "Crash Reporting",
        url: "/docs/features/feature-crash-reporting",
      },
    ]);
    expect(node).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Docs",
          item: `${siteOrigin}/docs`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Crash Reporting",
          item: `${siteOrigin}/docs/features/feature-crash-reporting`,
        },
      ],
    });
  });

  it("drops intermediate crumbs without a URL and renumbers positions", () => {
    const node = breadcrumbJsonLd([
      { name: "Docs", url: "/docs" },
      { name: "Features" },
      {
        name: "Crash Reporting",
        url: "/docs/features/feature-crash-reporting",
      },
    ]);
    expect(node.itemListElement.map((item) => item.name)).toEqual([
      "Docs",
      "Crash Reporting",
    ]);
    expect(node.itemListElement.map((item) => item.position)).toEqual([1, 2]);
  });

  it("keeps a URL-less last crumb, without an item link", () => {
    const node = breadcrumbJsonLd([
      { name: "Docs", url: "/docs" },
      { name: "Current Page" },
    ]);
    expect(node.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Current Page",
    });
  });

  it("drops crumbs whose name is not a plain string", () => {
    const node = breadcrumbJsonLd([
      { name: 42, url: "/docs" },
      {
        name: "Crash Reporting",
        url: "/docs/features/feature-crash-reporting",
      },
    ]);
    expect(node.itemListElement.map((item) => item.name)).toEqual([
      "Crash Reporting",
    ]);
  });
});
