/**
 * Verifies that internal links resolve across the docs and the app:
 * relative links between docs pages point at files that exist, anchors
 * point at real headings, images point at real assets, links that escape
 * the docs tree point at real repo files, and /docs hrefs hardcoded in app
 * code target real pages.
 *
 * Runs against content/docs, which pretest regenerates from the repo docs,
 * so a broken link fails here before it ships.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const CONTENT_DIR = path.join(ROOT, "content", "docs");
const APP_DIR = path.join(ROOT, "app");
const REPO_DOCS_DIR = path.resolve(ROOT, "..", "..", "docs");

const hasContentDocs = fs.existsSync(CONTENT_DIR);

function walkFiles(dir: string, extension: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Blank out fenced code blocks so their contents are not mistaken for links
 * or headings, while keeping line numbers intact.
 */
function blankFencedCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
}

/**
 * Additionally blank inline code spans, for link extraction only: heading
 * extraction must keep them because code-span text stays in GitHub slugs.
 */
function blankOutCode(markdown: string): string {
  return blankFencedCode(markdown).replace(/`[^`\n]*`/g, (span) =>
    " ".repeat(span.length),
  );
}

/**
 * GitHub's heading-anchor algorithm, which rehype-slug also uses for the
 * rendered site: lowercase, drop punctuation except hyphens and
 * underscores, spaces become hyphens, and repeated slugs get -1, -2...
 * suffixes in document order. Reimplemented here because github-slugger
 * ships as ESM only, which jest does not transform.
 */
function githubSlugs(headings: string[]): Set<string> {
  const counts = new Map<string, number>();
  const slugs = new Set<string>();
  for (const heading of headings) {
    const base = heading
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/ /g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

/**
 * Reduce a heading line to the text GitHub slugs: inline code keeps its
 * text, links keep their label, emphasis markers and HTML tags drop.
 */
function headingText(line: string): string {
  return line
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\*/g, "")
    .replace(/\b_+|_+\b/g, "");
}

const anchorCache = new Map<string, Set<string>>();

function anchorsFor(mdFile: string): Set<string> {
  const cached = anchorCache.get(mdFile);
  if (cached) {
    return cached;
  }
  const content = blankFencedCode(fs.readFileSync(mdFile, "utf-8"));
  const headings: string[] = [];
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    headings.push(headingText(match[1]));
  }
  const anchors = githubSlugs(headings);
  anchorCache.set(mdFile, anchors);
  return anchors;
}

/** Slugs of every page the docs site serves, mirroring copy_docs.js. */
function validDocsSlugs(): Set<string> {
  const slugs = new Set<string>(["/docs"]);
  for (const file of walkFiles(CONTENT_DIR, ".md")) {
    const relPath = path.relative(CONTENT_DIR, file).replaceAll(path.sep, "/");
    if (relPath.endsWith("README.md")) {
      const dir = relPath.replace(/\/?README\.md$/, "");
      slugs.add(dir === "" ? "/docs" : `/docs/${dir}`);
    } else {
      slugs.add(`/docs/${relPath.replace(/\.md$/, "")}`);
    }
  }
  return slugs;
}

/** The docs page a slug is rendered from, for anchor lookups. */
function mdFileForSlug(slug: string): string | null {
  if (slug === "/docs") {
    return path.join(CONTENT_DIR, "README.md");
  }
  const relPath = slug.replace(/^\/docs\//, "");
  const asFile = path.join(CONTENT_DIR, `${relPath}.md`);
  if (fs.existsSync(asFile)) {
    return asFile;
  }
  const asDirReadme = path.join(CONTENT_DIR, relPath, "README.md");
  if (fs.existsSync(asDirReadme)) {
    return asDirReadme;
  }
  return null;
}

interface DocLink {
  file: string;
  line: number;
  target: string;
}

function extractLinks(mdFile: string): DocLink[] {
  const content = blankOutCode(fs.readFileSync(mdFile, "utf-8"));
  const links: DocLink[] = [];
  for (const match of content.matchAll(
    /!?\[[^\]]*\]\(([^()\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    links.push({
      file: path.relative(CONTENT_DIR, mdFile),
      line: content.slice(0, match.index).split("\n").length,
      target: match[1],
    });
  }
  return links;
}

(hasContentDocs ? describe : describe.skip)("docs internal links", () => {
  const allLinks = walkFiles(CONTENT_DIR, ".md").flatMap(extractLinks);

  function describeLink(link: DocLink, reason: string): string {
    return `${link.file}:${link.line} -> ${link.target} (${reason})`;
  }

  it("has links to check", () => {
    expect(allLinks.length).toBeGreaterThan(0);
  });

  it("relative links resolve to existing files", () => {
    const failures: string[] = [];

    for (const link of allLinks) {
      if (/^(https?:|mailto:|#|\/)/.test(link.target)) {
        continue;
      }
      const [targetPath] = link.target.split("#");
      const resolved = path.resolve(
        CONTENT_DIR,
        path.dirname(link.file),
        targetPath,
      );

      if (resolved.startsWith(CONTENT_DIR + path.sep)) {
        if (!fs.existsSync(resolved)) {
          failures.push(describeLink(link, "file not found in docs"));
        }
        continue;
      }

      // Links that escape the docs tree render as GitHub blob URLs, so the
      // target must exist in the repo. Skipped when the checkout does not
      // include the repo root (content/docs prebuilt elsewhere).
      if (fs.existsSync(REPO_DOCS_DIR)) {
        const resolvedInRepo = path.resolve(
          REPO_DOCS_DIR,
          path.dirname(link.file),
          targetPath,
        );
        if (!fs.existsSync(resolvedInRepo)) {
          failures.push(describeLink(link, "file not found in repo"));
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("absolute /docs links point at real pages", () => {
    const failures: string[] = [];
    const slugs = validDocsSlugs();

    for (const link of allLinks) {
      if (!link.target.startsWith("/docs")) {
        continue;
      }
      const [route] = link.target.split("#");
      if (!slugs.has(route.replace(/\/$/, "") || "/docs")) {
        failures.push(describeLink(link, "no docs page for this route"));
      }
    }

    expect(failures).toEqual([]);
  });

  it("anchors point at real headings", () => {
    const failures: string[] = [];

    for (const link of allLinks) {
      if (/^(https?:|mailto:)/.test(link.target)) {
        continue;
      }
      const [targetPath, anchor] = link.target.split("#");
      if (anchor === undefined || anchor === "") {
        continue;
      }

      let targetFile: string | null;
      if (targetPath === "") {
        targetFile = path.join(CONTENT_DIR, link.file);
      } else if (targetPath.startsWith("/docs")) {
        targetFile = mdFileForSlug(targetPath.replace(/\/$/, ""));
      } else {
        targetFile = path.resolve(
          CONTENT_DIR,
          path.dirname(link.file),
          targetPath,
        );
      }

      if (
        targetFile === null ||
        !targetFile.endsWith(".md") ||
        !fs.existsSync(targetFile)
      ) {
        // Missing files are reported by the resolution tests above
        continue;
      }

      if (!anchorsFor(targetFile).has(anchor)) {
        failures.push(describeLink(link, "no heading for this anchor"));
      }
    }

    expect(failures).toEqual([]);
  });
});

(hasContentDocs ? describe : describe.skip)("app links to docs", () => {
  it("every /docs href in app code targets a real page and heading", () => {
    const failures: string[] = [];
    const slugs = validDocsSlugs();
    const files = [...walkFiles(APP_DIR, ".ts"), ...walkFiles(APP_DIR, ".tsx")];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (const match of content.matchAll(
        /["'`](\/docs(?:\/[\w\-/.]*)?(?:#[\w-]*)?)["'`$]/g,
      )) {
        const [route, anchor] = match[1].split("#");
        // A bare or trailing-slash /docs is a route prefix being
        // concatenated with a dynamic slug, which cannot be checked here
        const normalized = route.replace(/\/$/, "");
        if (normalized === "/docs" && route !== "/docs") {
          continue;
        }
        const line = content.slice(0, match.index).split("\n").length;
        const lineText = lines[line - 1].trim();
        if (lineText.startsWith("//") || lineText.startsWith("*")) {
          continue;
        }
        const location = `${path.relative(ROOT, file)}:${line}`;

        // A route with a file extension is a static asset fetch, served
        // from public/ rather than rendered as a docs page
        if (/\.\w+$/.test(normalized)) {
          if (!fs.existsSync(path.join(ROOT, "public", normalized))) {
            failures.push(`${location} -> ${match[1]} (no public asset)`);
          }
          continue;
        }

        if (!slugs.has(normalized)) {
          failures.push(`${location} -> ${match[1]} (no docs page)`);
          continue;
        }
        if (anchor) {
          const targetFile = mdFileForSlug(normalized);
          if (targetFile === null || !anchorsFor(targetFile).has(anchor)) {
            failures.push(`${location} -> ${match[1]} (no heading)`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
