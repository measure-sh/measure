import fs from "fs";
import path from "path";

function getDocsDirectory(): string {
  // Docker/CI: content/docs is copied into the build context
  const contentDir = path.join(process.cwd(), "content", "docs");
  if (fs.existsSync(contentDir)) {
    return contentDir;
  }
  // Local dev: read from monorepo root
  return path.join(process.cwd(), "..", "..", "docs");
}

export interface DocPage {
  slug: string[];
  content: string;
  title: string;
  description: string;
  isIndex: boolean;
}

/**
 * Parse YAML frontmatter at the start of a markdown file. Only supports flat
 * `key: value` lines (with optional surrounding "single" or "double" quotes) —
 * enough for `title` and `description` fields, no nested structures.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!kv) {
      continue;
    }
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    frontmatter[kv[1]] = value;
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

/**
 * Resolves a URL slug array to a markdown file path.
 * - ["hosting"] -> hosting/README.md
 * - ["sdk-integration-guide"] -> sdk-integration-guide.md
 * - ["features", "feature-crash-reporting"] -> features/feature-crash-reporting.md
 */
function slugToFilePath(docsDir: string, slug: string[]): string | null {
  const joined = slug.join("/");

  // Try direct .md file first
  const directPath = path.join(docsDir, `${joined}.md`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // Try README.md inside directory
  const readmePath = path.join(docsDir, joined, "README.md");
  if (fs.existsSync(readmePath)) {
    return readmePath;
  }

  return null;
}

/**
 * Strip HTML comments like <!-- omit in toc --> from markdown content.
 */
export function cleanContent(content: string): string {
  return content.replace(/<!--.*?-->/gs, "");
}

/**
 * Strip HTML tags iteratively until the string stops changing. A single
 * regex pass is incomplete because a nested input like `<scr<script>ipt>`
 * leaves a partial tag behind after one replace — iterating to a fixed
 * point removes any residue. The regex always consumes ≥3 chars per
 * match, so the loop is guaranteed to terminate.
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
 * Reduce a markdown body to plain text suitable for full-text search.
 * Strips fences, headings, raw HTML, images/links, emphasis markers,
 * list/blockquote prefixes, table pipes, and GFM callout markers
 * (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
 */
export function stripSearchContent(content: string): string {
  const withoutTags = stripHtmlTags(
    cleanContent(content)
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^#{1,6}\s+.+$/gm, ""),
  );
  return withoutTags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, "")
    .replace(/[*_`~]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract title from the first # heading in markdown content
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Documentation";
}

/**
 * Extract the first plain paragraph from markdown content, skipping
 * the title, TOC lists, admonitions, headings, tables, and code blocks.
 * Returns an empty string when no suitable paragraph is found.
 */
export function extractDescription(content: string): string {
  const afterTitle = content.replace(/^#\s+.+$/m, "");
  const blocks = afterTitle.split(/\n\s*\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }
    const firstChar = trimmed[0];
    if (
      firstChar === "#" ||
      firstChar === "*" ||
      firstChar === "-" ||
      firstChar === "+" ||
      firstChar === ">" ||
      firstChar === "|" ||
      firstChar === "<" ||
      trimmed.startsWith("```")
    ) {
      continue;
    }

    const plain = trimmed
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!plain) {
      continue;
    }

    if (plain.length > 160) {
      const truncated = plain.slice(0, 157);
      const lastSpace = truncated.lastIndexOf(" ");
      const cut = lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated;
      return `${cut}…`;
    }
    return plain;
  }

  return "";
}

export function getDocBySlug(slug: string[]): DocPage | null {
  const docsDir = getDocsDirectory();
  const filePath = slugToFilePath(docsDir, slug);

  if (!filePath) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const cleaned = cleanContent(body);

  return {
    slug,
    content: cleaned,
    title: frontmatter.title || extractTitle(cleaned),
    description: frontmatter.description || extractDescription(cleaned),
    isIndex: filePath.endsWith(`${path.sep}README.md`),
  };
}

export function getDocIndex(): DocPage | null {
  const docsDir = getDocsDirectory();
  const filePath = path.join(docsDir, "README.md");

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const cleaned = cleanContent(body);

  return {
    slug: [],
    content: cleaned,
    title: frontmatter.title || extractTitle(cleaned),
    description: frontmatter.description || extractDescription(cleaned),
    isIndex: true,
  };
}

/**
 * Walk the docs directory and return all valid slugs for generateStaticParams.
 */
export function getAllDocSlugs(): string[][] {
  const docsDir = getDocsDirectory();
  const slugs: string[][] = [];

  function walk(dir: string, prefix: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skip assets directories
        if (entry.name === "assets") {
          continue;
        }
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        if (entry.name === "README.md") {
          // README.md maps to the directory itself
          if (prefix.length > 0) {
            slugs.push(prefix);
          }
          // Root README.md is handled by app/docs/page.tsx
        } else {
          const name = entry.name.replace(/\.md$/, "");
          slugs.push([...prefix, name]);
        }
      }
    }
  }

  walk(docsDir, []);
  return slugs;
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function extractTocEntries(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const idCounts = new Map<string, number>();
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  let isFirstH1 = true;

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;

    // Skip the first h1 (page title)
    if (level === 1 && isFirstH1) {
      isFirstH1 = false;
      continue;
    }
    if (level === 1) {
      isFirstH1 = false;
    }

    const text = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links
      .replace(/[*_`]/g, "") // strip emphasis
      .trim();
    const baseId = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    // Deduplicate IDs the same way rehype-slug does
    const count = idCounts.get(baseId) || 0;
    const id = count === 0 ? baseId : `${baseId}-${count}`;
    idCounts.set(baseId, count + 1);

    entries.push({ id, text, level });
  }

  return entries;
}

export interface SearchIndexEntry {
  slug: string;
  title: string;
  headings: string[];
  content: string;
}

/**
 * Generate search index data from all docs.
 */
export function generateSearchIndex(): SearchIndexEntry[] {
  const docsDir = getDocsDirectory();
  const entries: SearchIndexEntry[] = [];

  function processFile(filePath: string, slug: string[]) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { frontmatter, body: content } = parseFrontmatter(raw);

    const title = frontmatter.title || extractTitle(content);
    const headings: string[] = [];
    const headingRegex = /^#{2,3}\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1].trim());
    }

    const plainContent = stripSearchContent(content).slice(0, 500);

    entries.push({
      slug: slug.length === 0 ? "/" : `/${slug.join("/")}`,
      title,
      headings,
      content: plainContent,
    });
  }

  function walk(dir: string, prefix: string[]) {
    const dirEntries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        if (entry.name === "assets") {
          continue;
        }
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        if (entry.name === "README.md") {
          processFile(path.join(dir, entry.name), prefix);
        } else {
          const name = entry.name.replace(/\.md$/, "");
          processFile(path.join(dir, entry.name), [...prefix, name]);
        }
      }
    }
  }

  walk(docsDir, []);
  return entries;
}
