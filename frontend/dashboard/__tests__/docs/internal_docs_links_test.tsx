/**
 * Tests that GitHub docs URLs have been replaced with internal /docs/... routes
 * across the codebase.
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
  "[teamId]/session_replays/page.tsx",
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

  it("sdk_configurator.tsx links to /docs/adaptive-capture", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/sdk_configurator.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs/adaptive-capture"');
  });

  it("app_breadcrumbs.tsx links to /docs/adaptive-capture#journey-sampling", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/app_breadcrumbs.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs/adaptive-capture#journey-sampling"');
  });

  it("app_breadcrumbs.tsx links to /docs/session-replay", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/app_breadcrumbs.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs/session-replay"');
  });

  it("onboarding.tsx links to the getting started docs", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/onboarding.tsx"),
      "utf-8",
    );

    expect(content).toContain("/docs/getting-started/");
  });

  it("apps/page.tsx links to /docs", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/apps/page.tsx"),
      "utf-8",
    );

    expect(content).toContain('href="/docs"');
  });

  it("team/page.tsx links to /docs/hosting/slack", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/team/page.tsx"),
      "utf-8",
    );

    expect(content).toMatch(/href=['"]\/docs\/hosting\/slack['"]/);
  });

  it("team/page.tsx links to /docs/integrations#slack", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "[teamId]/team/page.tsx"),
      "utf-8",
    );

    expect(content).toMatch(/href=['"]\/docs\/integrations#slack['"]/);
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
      l.includes("/docs/adaptive-capture"),
    );

    expect(docsLinkLine).toBeDefined();
    expect(docsLinkLine).not.toContain("target");
  });

  it("app_breadcrumbs.tsx does not open the journeys docs link in new tab", () => {
    const content = fs.readFileSync(
      path.join(APP_DIR, "components/app_breadcrumbs.tsx"),
      "utf-8",
    );

    const lines = content.split("\n");
    const docsLinkLine = lines.find((l) =>
      l.includes("/docs/adaptive-capture"),
    );

    expect(docsLinkLine).toBeDefined();
    expect(docsLinkLine).not.toContain("target");
  });
});
