import { describe, expect, it } from "@jest/globals";
import {
  pageMetadata,
  previewImage,
  siteHandle,
  siteMetadata,
  siteXUrl,
} from "@/app/utils/metadata";

const seo = {
  title: "Pricing & Plans",
  description: "What Measure costs.",
  path: "/pricing",
};

type OpenGraphTags = {
  title?: string;
  description?: string;
  url?: string;
  type?: string;
  siteName?: string;
  images?: { url: string; alt?: string; width?: number; height?: number }[];
  publishedTime?: string;
  authors?: string[];
};

type TwitterTags = {
  card?: string;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  images?: { url: string; alt?: string }[];
};

function openGraphOf(metadata: { openGraph?: unknown }): OpenGraphTags {
  return metadata.openGraph as OpenGraphTags;
}

function twitterOf(metadata: { twitter?: unknown }): TwitterTags {
  return metadata.twitter as TwitterTags;
}

describe("pageMetadata", () => {
  it("carries the page title, description and canonical path", () => {
    const metadata = pageMetadata(seo);

    expect(metadata.title).toBe("Pricing & Plans");
    expect(metadata.description).toBe("What Measure costs.");
    expect(metadata.alternates).toEqual({ canonical: "/pricing" });
    expect(openGraphOf(metadata).url).toBe("/pricing");
  });

  it("appends the Measure suffix to the social titles by default", () => {
    const metadata = pageMetadata(seo);

    expect(openGraphOf(metadata).title).toBe("Pricing & Plans | Measure");
    expect(twitterOf(metadata).title).toBe("Pricing & Plans | Measure");
  });

  it("leaves the social titles alone when the suffix is turned off", () => {
    const metadata = pageMetadata(seo, { addMeasureSuffixToTitle: false });

    expect(openGraphOf(metadata).title).toBe("Pricing & Plans");
    expect(twitterOf(metadata).title).toBe("Pricing & Plans");
    expect(metadata.title).toBe("Pricing & Plans");
  });

  it("gives Open Graph and Twitter the same title and description", () => {
    const metadata = pageMetadata(seo);

    expect(twitterOf(metadata).title).toBe(openGraphOf(metadata).title);
    expect(twitterOf(metadata).description).toBe(
      openGraphOf(metadata).description,
    );
  });

  it("builds a large image card attributed to the Measure account", () => {
    const twitter = twitterOf(pageMetadata(seo));

    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.site).toBe(siteHandle);
    expect(twitter.creator).toBe(siteHandle);
  });

  it("falls back to the site-wide preview image with its dimensions", () => {
    const metadata = pageMetadata(seo);
    const expected = [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "Measure preview image",
      },
    ];

    expect(openGraphOf(metadata).images).toEqual(expected);
    expect(twitterOf(metadata).images).toEqual(expected);
  });

  it("uses the page's own images for both tag sets when given", () => {
    const images = [{ url: "/blog/assets/hero.webp", alt: "A post" }];
    const metadata = pageMetadata(seo, { images });

    expect(openGraphOf(metadata).images).toEqual(images);
    expect(twitterOf(metadata).images).toEqual(images);
  });

  it("describes a page as a website unless it is an article", () => {
    expect(openGraphOf(pageMetadata(seo)).type).toBe("website");
  });

  it("adds the publication date and authors for an article", () => {
    const metadata = pageMetadata(seo, {
      article: {
        publishedTime: "2026-07-19T00:00:00.000Z",
        authors: ["Anup Cowkur"],
      },
    });
    const openGraph = openGraphOf(metadata);

    expect(openGraph.type).toBe("article");
    expect(openGraph.publishedTime).toBe("2026-07-19T00:00:00.000Z");
    expect(openGraph.authors).toEqual(["Anup Cowkur"]);
  });

  it("omits the description when a page has none", () => {
    const metadata = pageMetadata({ title: "Untitled", path: "/untitled" });

    expect(metadata.description).toBeUndefined();
    expect(openGraphOf(metadata).description).toBeUndefined();
    expect(twitterOf(metadata).description).toBeUndefined();
  });
});

describe("siteMetadata", () => {
  it("suffixes every page's document title through the template", () => {
    expect(siteMetadata.title).toEqual({
      default: "Measure",
      template: "%s | Measure",
    });
  });

  it("declares no canonical link, which pages would inherit", () => {
    expect(siteMetadata.alternates).toBeUndefined();
  });

  it("carries fallback social tags for routes without their own", () => {
    expect(openGraphOf(siteMetadata).title).toBe("Measure");
    expect(twitterOf(siteMetadata).title).toBe("Measure");
    expect(twitterOf(siteMetadata).site).toBe(siteHandle);
  });

  it("resolves relative paths against the site origin", () => {
    expect(siteMetadata.metadataBase?.toString()).toBe("https://measure.sh/");
  });
});

describe("the X account", () => {
  it("gives the handle and the profile URL the same username", () => {
    expect(siteXUrl).toBe(`https://x.com/${siteHandle.replace("@", "")}`);
  });
});
