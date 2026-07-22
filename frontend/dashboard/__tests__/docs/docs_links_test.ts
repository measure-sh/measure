/**
 * Verifies that internal links resolve across the docs and the app:
 * docs links use absolute /docs routes that point at existing pages,
 * anchors point at real headings, images and other asset links point at
 * real files in public/, GitHub blob links point at real repo files, and
 * /docs hrefs hardcoded in app code target real pages.
 *
 * Runs against the .mdx sources under content/docs/, so a broken link
 * fails here before it ships.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

// The file-to-route mapping is the sitemap generator's; sharing it keeps
// this test and the sitemap agreeing on the slug rules.
import { docsRouteFromFile } from "@/scripts/generate_sitemap";

const ROOT = path.resolve(__dirname, "..", "..");
const APP_DIR = path.join(ROOT, "app");
const CONTENT_DOCS_DIR = path.join(ROOT, "content", "docs");
const PUBLIC_DIR = path.join(ROOT, "public");
const REPO_ROOT = path.resolve(ROOT, "..", "..");

const GITHUB_BLOB_PREFIX = "https://github.com/measure-sh/measure/blob/main/";

function walkFiles(dir: string, suffix: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, suffix));
    } else if (entry.name.endsWith(suffix)) {
      files.push(fullPath);
    }
  }
  return files;
}

function docsPageFiles(): string[] {
  return walkFiles(CONTENT_DOCS_DIR, ".mdx");
}

/** The /docs route of a content file. */
function routeForFile(mdxFile: string): string {
  return docsRouteFromFile(CONTENT_DOCS_DIR, mdxFile);
}

/** The markdown body of a docs page: everything after the frontmatter. */
function pageBody(mdxFile: string): string {
  const source = fs.readFileSync(mdxFile, "utf-8");
  const match = source.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/);
  return match ? source.slice(match[0].length) : source;
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
 * GitHub's heading-anchor algorithm, which fumadocs' heading slugger also
 * follows: lowercase, drop punctuation except hyphens and underscores,
 * spaces become hyphens, and repeated slugs get -1, -2... suffixes in
 * document order. Reimplemented here because github-slugger ships as ESM
 * only, which jest does not transform.
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
 * Strip HTML tags iteratively until the string stops changing: a single
 * pass leaves a partial tag behind for nested input like `<scr<script>ipt>`.
 * The regex always consumes at least 3 chars per match, so the loop
 * terminates.
 */
function stripHtmlTags(input: string): string {
  let out = input;
  for (let i = 0; i < 50; i++) {
    const next = out.replace(/<[^>]+>/g, "");
    if (next === out) {
      return next;
    }
    out = next;
  }
  return out;
}

/**
 * Reduce a heading line to the text GitHub slugs: MDX escapes resolve to
 * their characters, inline code keeps its text, links keep their label,
 * emphasis markers and HTML tags drop.
 */
function headingText(line: string): string {
  return stripHtmlTags(
    line
      .replace(/\\([<{}])/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
  )
    .replace(/\*/g, "")
    .replace(/\b_+|_+\b/g, "");
}

const anchorCache = new Map<string, Set<string>>();

function anchorsFor(mdxFile: string): Set<string> {
  const cached = anchorCache.get(mdxFile);
  if (cached) {
    return cached;
  }
  const content = blankFencedCode(pageBody(mdxFile));
  const headings: string[] = [];
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    headings.push(headingText(match[1]));
  }
  const anchors = githubSlugs(headings);
  anchorCache.set(mdxFile, anchors);
  return anchors;
}

const routeToFile = new Map<string, string>();
for (const file of docsPageFiles()) {
  routeToFile.set(routeForFile(file), file);
}

/** Slugs of every page the docs site serves. */
function validDocsSlugs(): Set<string> {
  return new Set(routeToFile.keys());
}

/** The content file a /docs slug is rendered from, for anchor lookups. */
function mdxFileForSlug(slug: string): string | null {
  return routeToFile.get(slug) ?? null;
}

interface DocLink {
  file: string;
  line: number;
  target: string;
}

function extractLinks(mdxFile: string): DocLink[] {
  const content = blankOutCode(pageBody(mdxFile));
  const links: DocLink[] = [];
  for (const match of content.matchAll(
    /!?\[[^\]]*\]\(([^()\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    links.push({
      file: path.relative(CONTENT_DOCS_DIR, mdxFile),
      line: content.slice(0, match.index).split("\n").length,
      target: match[1],
    });
  }
  return links;
}

describe("docs internal links", () => {
  const allLinks = docsPageFiles().flatMap(extractLinks);

  function describeLink(link: DocLink, reason: string): string {
    return `${link.file}:${link.line} -> ${link.target} (${reason})`;
  }

  it("has links to check", () => {
    expect(allLinks.length).toBeGreaterThan(0);
  });

  it("uses only absolute, anchor, or external targets", () => {
    // Docs pages are routed from a virtual page tree: relative links have
    // no file tree to resolve against, so every link must be a /docs
    // route, a root-relative asset, an anchor, or an external URL.
    const failures: string[] = [];

    for (const link of allLinks) {
      if (!/^(https?:|mailto:|#|\/)/.test(link.target)) {
        failures.push(describeLink(link, "relative link in MDX docs"));
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
      // Page slugs may end in version suffixes like v0.4.x, so check them
      // before treating a dotted tail as a file extension
      if (slugs.has(route.replace(/\/$/, "") || "/docs")) {
        continue;
      }
      // Asset links are checked against public/ separately
      if (/\.\w+$/.test(route)) {
        continue;
      }
      failures.push(describeLink(link, "no docs page for this route"));
    }

    expect(failures).toEqual([]);
  });

  it("root-relative asset links point at real public files", () => {
    const failures: string[] = [];
    const slugs = validDocsSlugs();

    for (const link of allLinks) {
      if (!link.target.startsWith("/")) {
        continue;
      }
      const [route] = link.target.split("#");
      // Page slugs may end in version suffixes like v0.4.x, so a route
      // that matches a real page is never treated as an asset
      if (slugs.has(route.replace(/\/$/, "") || "/docs")) {
        continue;
      }
      if (!/\.\w+$/.test(route)) {
        continue;
      }
      if (!fs.existsSync(path.join(PUBLIC_DIR, route))) {
        failures.push(describeLink(link, "no public asset"));
      }
    }

    expect(failures).toEqual([]);
  });

  it("GitHub blob links point at real repo files", () => {
    // Links that escaped the docs tree were rewritten to GitHub blob URLs
    // in the MDX migration; the linked files must exist in this repo.
    const failures: string[] = [];

    for (const link of allLinks) {
      if (!link.target.startsWith(GITHUB_BLOB_PREFIX)) {
        continue;
      }
      const [repoPath] = link.target
        .slice(GITHUB_BLOB_PREFIX.length)
        .split("#");
      if (!fs.existsSync(path.join(REPO_ROOT, repoPath))) {
        failures.push(describeLink(link, "file not found in repo"));
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
        targetFile = path.join(CONTENT_DOCS_DIR, link.file);
      } else if (targetPath.startsWith("/docs")) {
        targetFile = mdxFileForSlug(targetPath.replace(/\/$/, ""));
      } else {
        // Non-docs targets (assets, external) carry no heading anchors
        continue;
      }

      if (targetFile === null || !fs.existsSync(targetFile)) {
        // Missing pages are reported by the resolution tests above
        continue;
      }

      if (!anchorsFor(targetFile).has(anchor)) {
        failures.push(describeLink(link, "no heading for this anchor"));
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("app links to docs", () => {
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
        // A trailing-slash /docs route is a prefix being concatenated with a
        // dynamic slug (e.g. `/docs/getting-started/${slug}`), which cannot be
        // checked statically
        if (route.endsWith("/")) {
          continue;
        }
        const normalized = route.replace(/\/$/, "");
        // The docs search and AI chat endpoints are route handlers, not pages
        if (normalized === "/docs/search" || normalized === "/docs/chat") {
          continue;
        }
        const line = content.slice(0, match.index).split("\n").length;
        const lineText = lines[line - 1].trim();
        if (lineText.startsWith("//") || lineText.startsWith("*")) {
          continue;
        }
        const location = `${path.relative(ROOT, file)}:${line}`;

        // Page slugs may end in version suffixes like v0.4.x, so check
        // pages before treating a dotted tail as a file extension. A
        // non-page route with an extension is a static asset fetch,
        // served from public/ rather than rendered as a docs page.
        if (!slugs.has(normalized)) {
          if (/\.\w+$/.test(normalized)) {
            if (!fs.existsSync(path.join(ROOT, "public", normalized))) {
              failures.push(`${location} -> ${match[1]} (no public asset)`);
            }
          } else {
            failures.push(`${location} -> ${match[1]} (no docs page)`);
          }
          continue;
        }
        if (anchor) {
          const targetFile = mdxFileForSlug(normalized);
          if (targetFile === null || !anchorsFor(targetFile).has(anchor)) {
            failures.push(`${location} -> ${match[1]} (no heading)`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
