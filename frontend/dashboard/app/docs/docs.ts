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
 * Extract title from the first # heading in markdown content
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Documentation";
}

export function getDocBySlug(slug: string[]): DocPage | null {
  const docsDir = getDocsDirectory();
  const filePath = slugToFilePath(docsDir, slug);

  if (!filePath) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const cleaned = cleanContent(content);

  return {
    slug,
    content: cleaned,
    title: extractTitle(cleaned),
  };
}

export function getDocIndex(): DocPage | null {
  const docsDir = getDocsDirectory();
  const filePath = path.join(docsDir, "README.md");

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const cleaned = cleanContent(content);

  return {
    slug: [],
    content: cleaned,
    title: extractTitle(cleaned),
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
    const content = fs.readFileSync(filePath, "utf-8");

    const title = extractTitle(content);
    const headings: string[] = [];
    const headingRegex = /^#{2,3}\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1].trim());
    }

    // Strip markdown syntax for plain text search content
    const plainContent = content
      .replace(/^#{1,6}\s+.+$/gm, "") // Remove headings (already captured)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links -> text
      .replace(/[*_`~]/g, "") // Remove emphasis markers
      .replace(/\n{2,}/g, "\n") // Collapse newlines
      .trim()
      .slice(0, 500); // Keep first 500 chars for search

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
