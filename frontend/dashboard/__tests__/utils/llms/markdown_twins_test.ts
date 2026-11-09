import { describe, expect, it, jest } from "@jest/globals";
import fs from "fs";
import path from "path";

import {
  hasMarkdownTwin,
  readMarkdownTwin,
} from "@/app/utils/llms/markdown_twins";

const APP_DIR = path.join(process.cwd(), "app");

// Docs and blog pages are served as markdown from their own sources through
// the /llms.docs and /llms.blog routes.
const SECTIONS_WITHOUT_TWINS = ["/docs", "/blog"];
// The login page belongs to the app, and the legal pages have no markdown
// twin on purpose.
const PAGES_WITHOUT_TWINS = new Set([
  "/auth/login",
  "/privacy-policy",
  "/terms-of-service",
]);

// Routes with a dynamic segment, such as the signed-in app under [teamId],
// have no fixed URL for a page.md, so the walk skips them.
function staticPagePaths(dir = APP_DIR, prefix = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const pages = entries.some((e) => e.isFile() && e.name === "page.tsx")
    ? [prefix || "/"]
    : [];
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("[")) {
      pages.push(
        ...staticPagePaths(
          path.join(dir, entry.name),
          `${prefix}/${entry.name}`,
        ),
      );
    }
  }
  return pages;
}

describe("markdown twins", () => {
  it("has a page.md next to every static page.tsx outside docs and blog", () => {
    const missing = staticPagePaths()
      .filter(
        (page) =>
          !PAGES_WITHOUT_TWINS.has(page) &&
          !SECTIONS_WITHOUT_TWINS.some(
            (section) => page === section || page.startsWith(`${section}/`),
          ),
      )
      .filter((page) => !hasMarkdownTwin(page));

    expect(missing).toEqual([]);
  });

  it("has a page.tsx next to every page.md", () => {
    const orphans = fs
      .readdirSync(APP_DIR, { recursive: true, encoding: "utf-8" })
      .filter((file) => path.basename(file) === "page.md")
      .filter(
        (file) =>
          !fs.existsSync(path.join(APP_DIR, path.dirname(file), "page.tsx")),
      );

    expect(orphans).toEqual([]);
  });

  it("reads the homepage twin from app/page.md", () => {
    expect(readMarkdownTwin("/")).toBe(
      fs.readFileSync(path.join(APP_DIR, "page.md"), "utf-8"),
    );
  });

  it("finds no twin for a page without page.md", () => {
    expect(hasMarkdownTwin("/privacy-policy")).toBe(false);
    expect(readMarkdownTwin("/privacy-policy")).toBeNull();
  });

  it("finds no twin for a path outside app/", () => {
    // Every file appears to exist, so only the app/ boundary check can
    // reject the path.
    const existsSync = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    try {
      expect(hasMarkdownTwin("/../secret")).toBe(false);
      expect(readMarkdownTwin("/../secret")).toBeNull();
    } finally {
      existsSync.mockRestore();
    }
  });
});
