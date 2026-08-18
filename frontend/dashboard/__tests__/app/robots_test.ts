import { afterAll, describe, expect, it, jest } from "@jest/globals";
import type { MetadataRoute } from "next";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

async function robotsFor(siteUrl?: string): Promise<MetadataRoute.Robots> {
  jest.resetModules();
  if (siteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  }
  const robots = (await import("@/app/robots")).default;
  return robots();
}

afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("robots", () => {
  it("allows crawling and advertises a sitemap on the canonical site", async () => {
    const r = await robotsFor("https://measure.sh");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    expect(rule.allow).toBe("/");
    expect(rule.disallow).toContain("/auth/");
    expect(rule.disallow).toContain("/api/");
    expect(rule.disallow).toContain("/yrtmlt/");
    expect(r.sitemap).toBe("https://measure.sh/sitemap.xml");
    expect(r.host).toBe("https://measure.sh");
  });

  it("disallows all crawling on non-canonical hosts", async () => {
    const r = await robotsFor("https://staging.measure.sh");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    expect(rule.disallow).toBe("/");
    expect(rule.allow).toBeUndefined();
    expect(r.sitemap).toBeUndefined();
    expect(r.host).toBeUndefined();
  });

  it("disallows all crawling when NEXT_PUBLIC_SITE_URL is unset", async () => {
    const r = await robotsFor(undefined);
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    expect(rule.disallow).toBe("/");
    expect(rule.allow).toBeUndefined();
    expect(r.sitemap).toBeUndefined();
    expect(r.host).toBeUndefined();
  });
});
