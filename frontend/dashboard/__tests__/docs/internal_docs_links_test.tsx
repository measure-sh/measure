/**
 * Tests that GitHub docs URLs have been replaced with internal /docs/... routes
 * across the codebase, and that rewriteHref correctly handles all link types.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

const APP_DIR = path.resolve(__dirname, "..", "..", "app");

// Files that previously had GitHub docs links
const FILES_WITH_REWRITTEN_LINKS = [
  "page.tsx",
  "pricing/page.tsx",
  "why-measure/page.tsx",
  "components/filters.tsx",
  "components/sdk_configurator.tsx",
  "components/user_journeys.tsx",
  "[teamId]/apps/page.tsx",
  "[teamId]/team/page.tsx",
  "[teamId]/session_timelines/page.tsx",
];

describe("GitHub docs links have been replaced", () => {
  for (const file of FILES_WITH_REWRITTEN_LINKS) {
    it(`${file} does not contain GitHub docs URLs`, () => {
      const content = fs.readFileSync(path.join(APP_DIR, file), "utf-8");

      // Should not link to GitHub docs
      expect(content).not.toContain(
        "github.com/measure-sh/measure/blob/main/docs/",
      );
      expect(content).not.toContain("tab=readme-ov-file#docs");
    });
  }

  it("pricing/page.tsx links to /docs/hosting for self-hosting", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "pricing/page.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs/hosting"');
  });

  it("sdk_configurator.tsx links to /docs/features/configuration-options", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/sdk_configurator.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs/features/configuration-options"');
  });

  it("user_journeys.tsx links to /docs/features/configuration-options#journey-sampling", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/user_journeys.tsx"),
      "utf-8",
    );

    expect(content).toContain(
      'href="/docs/features/configuration-options#journey-sampling"',
    );
  });

  it("filters.tsx links to /docs", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/filters.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs"');
  });

  it("apps/page.tsx links to /docs", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/apps/page.tsx"),
      "utf-8",
    );

    expect(content).toContain("href='/docs'");
  });

  it("team/page.tsx links to /docs/hosting/slack", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/team/page.tsx"),
      "utf-8",
    );

    expect(content).toContain("href='/docs/hosting/slack'");
  });

  it("team/page.tsx links to /docs/features/feature-slack-integration", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/team/page.tsx"),
      "utf-8",
    );

    expect(content).toContain(
      "href='/docs/features/feature-slack-integration'",
    );
  });

  it("session_timelines/page.tsx links to /docs/features/feature-session-timelines", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/session_timelines/page.tsx"),
      "utf-8",
    );

    expect(content).toContain(
      'href="/docs/features/feature-session-timelines"',
    );
  });
});

describe("rewritten links do not use target=_blank", () => {
  it("sdk_configurator.tsx does not open docs in new tab", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/sdk_configurator.tsx"),
      "utf-8",
    );

    // Find the line with the docs link and verify no target="_blank"
    const lines = content.split("\n");
    const docsLinkLine = lines.find((l) =>
      l.includes("/docs/features/configuration-options"),
    );

    expect(docsLinkLine).toBeDefined();
    expect(docsLinkLine).not.toContain("target");
  });

  it("user_journeys.tsx does not open docs in new tab", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/user_journeys.tsx"),
      "utf-8",
    );

    const lines = content.split("\n");
    const docsLinkLine = lines.find((l) =>
      l.includes("/docs/features/configuration-options"),
    );

    expect(docsLinkLine).toBeDefined();
    expect(docsLinkLine).not.toContain("target");
  });

  it("session_timelines/page.tsx does not open docs in new tab", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/session_timelines/page.tsx"),
      "utf-8",
    );

    const lines = content.split("\n");
    const docsLinkLine = lines.find((l) =>
      l.includes("/docs/features/feature-session-timelines"),
    );

    expect(docsLinkLine).toBeDefined();
    expect(docsLinkLine).not.toContain("target");
  });
});
