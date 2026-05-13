/**
 * Generates llms.txt and llms-full.txt for LLM consumption.
 *
 * Reads the nav tree from content/docs_nav.json (produced by copy_docs.js)
 * and the markdown files from content/docs/ to produce:
 * - public/llms.txt: structured index with links to all doc pages
 * - public/llms-full.txt: all documentation concatenated into a single file
 *
 * Must run after copy_docs.js.
 */

const fs = require("fs");
const path = require("path");

const {
  stripHtmlComments,
  stripFrontmatter,
  mdPathToSlug,
} = require("./copy_docs");

const rootDir = path.resolve(__dirname, "..");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

function getDocsDirectory() {
  const contentDir = path.join(rootDir, "content", "docs");
  if (fs.existsSync(contentDir)) {
    return contentDir;
  }
  // Local dev fallback
  return path.resolve(rootDir, "..", "..", "docs");
}

function getAppDirectory() {
  return path.join(rootDir, "app");
}

/**
 * Parse flat key:value YAML frontmatter from a markdown file. Mirrors the
 * parser in app/docs/docs.ts — kept duplicated here because this script
 * runs at build time before Next.js compiles TS.
 */
function parseFrontmatterKV(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return {};
  }
  const kv = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) {
      continue;
    }
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    kv[m[1]] = v;
  }
  return kv;
}

/**
 * Walk app/ and return [{ slug, title, filePath }] for every route folder
 * that has both `page.tsx` (a real Next.js route) and `page.md` (a
 * hand-authored markdown twin).
 *
 * The dual-file check is the filter: folders like app/components/ have no
 * page.tsx so they're skipped; dynamic routes like app/[teamId]/ have
 * page.tsx but no page.md so they're also skipped. No hardcoded skip list.
 *
 * Slug mapping:
 *   app/page.md                       -> "/"
 *   app/about/page.md                 -> "/about"
 *   app/product/mcp/page.md           -> "/product/mcp"
 */
function walkPagesWithMd(appDir) {
  if (!fs.existsSync(appDir)) {
    return [];
  }
  const pages = [];

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const hasPageMd = entries.some((e) => e.isFile() && e.name === "page.md");
    const hasPageTsx = entries.some((e) => e.isFile() && e.name === "page.tsx");

    if (hasPageMd && hasPageTsx) {
      const slug = prefix.length === 0 ? "/" : `/${prefix.join("/")}`;
      const filePath = path.join(dir, "page.md");
      const raw = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatterKV(raw);
      pages.push({
        slug,
        title: fm.title || prefix[prefix.length - 1] || "index",
        filePath,
      });
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      }
    }
  }

  walk(appDir, []);
  // Homepage first, then alphabetical by slug
  return pages.sort((a, b) => {
    if (a.slug === "/") return -1;
    if (b.slug === "/") return 1;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * Resolve a /docs/... slug to a markdown file path.
 * e.g. "/docs/guide" -> "<docsDir>/guide.md" or "<docsDir>/guide/README.md"
 */
function slugToFilePath(docsDir, slug) {
  const rel = slug.replace(/^\/docs\/?/, "");
  if (rel === "") {
    return path.join(docsDir, "README.md");
  }
  const directPath = path.join(docsDir, `${rel}.md`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  const readmePath = path.join(docsDir, rel, "README.md");
  if (fs.existsSync(readmePath)) {
    return readmePath;
  }
  return null;
}

/**
 * Recursively flatten nav tree into an ordered list of slugs.
 * Starts with "/docs" (root page) then follows the nav ordering.
 */
function flattenNavSlugs(navData) {
  const slugs = ["/docs"];
  function walk(items) {
    for (const item of items) {
      if (item.slug) {
        slugs.push(item.slug);
      }
      if (item.children) {
        walk(item.children);
      }
    }
  }
  walk(navData);
  return slugs;
}

/**
 * Generate llms.txt content following the llms.txt spec.
 * Produces a markdown file with H1 title, blockquote description,
 * and organized links to all doc pages.
 */
function generateLlmsTxt(navData, pages = []) {
  const lines = [];
  lines.push("# measure.sh");
  lines.push("");
  lines.push("> Open source tool to monitor mobile apps");
  lines.push("");

  const standaloneItems = [];

  for (const item of navData) {
    if (item.children) {
      lines.push(`## ${item.title}`);
      lines.push("");
      for (const child of item.children) {
        if (child.children) {
          // Nested group (e.g. Bug Reporting with Android/iOS/Flutter)
          for (const grandchild of child.children) {
            if (grandchild.slug) {
              lines.push(
                `- [${grandchild.title}](${SITE_URL}${grandchild.slug})`,
              );
            }
          }
        } else if (child.slug) {
          lines.push(`- [${child.title}](${SITE_URL}${child.slug})`);
        }
      }
      lines.push("");
    } else if (item.slug) {
      standaloneItems.push(item);
    }
  }

  if (standaloneItems.length > 0) {
    lines.push("## Docs");
    lines.push("");
    for (const item of standaloneItems) {
      lines.push(`- [${item.title}](${SITE_URL}${item.slug})`);
    }
    lines.push("");
  }

  if (pages.length > 0) {
    lines.push("## Pages");
    lines.push("");
    for (const p of pages) {
      const url = p.slug === "/" ? SITE_URL : `${SITE_URL}${p.slug}`;
      lines.push(`- [${p.title}](${url})`);
    }
    lines.push("");
  }

  lines.push("## Optional");
  lines.push("");
  lines.push(
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): Complete documentation in a single file`,
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Rewrite relative markdown links and image paths to absolute URLs.
 */
function rewriteRelativeLinks(content) {
  return content
    .replace(
      /\[([^\]]+)\]\((?!https?:\/\/)([^)]+\.md(?:#[^)]*)?)\)/g,
      (match, text, href) => {
        const slug = mdPathToSlug(href);
        return `[${text}](${SITE_URL}${slug})`;
      },
    )
    .replace(
      /!\[([^\]]*)\]\((?:\.\/)?assets\/([^)]+)\)/g,
      (match, alt, assetPath) => {
        return `![${alt}](${SITE_URL}/docs/assets/${assetPath})`;
      },
    );
}

/**
 * Generate llms-full.txt with all documentation concatenated.
 * Follows the nav ordering, strips HTML comments and rewrites
 * relative links to absolute URLs.
 */
function generateLlmsFullTxt(docsDir, navData, pages = []) {
  const slugs = flattenNavSlugs(navData);
  const seen = new Set();
  const sections = [];

  for (const slug of slugs) {
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);

    const filePath = slugToFilePath(docsDir, slug);
    if (!filePath) {
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const cleaned = stripHtmlComments(stripFrontmatter(raw));
    const rewritten = rewriteRelativeLinks(cleaned);
    const sourceUrl =
      slug === "/docs" ? `${SITE_URL}/docs` : `${SITE_URL}${slug}`;

    sections.push(`---\nSource: ${sourceUrl}\n---\n\n${rewritten}`);
  }

  for (const p of pages) {
    const raw = fs.readFileSync(p.filePath, "utf-8");
    const cleaned = stripHtmlComments(stripFrontmatter(raw));
    const sourceUrl = p.slug === "/" ? SITE_URL : `${SITE_URL}${p.slug}`;
    sections.push(`---\nSource: ${sourceUrl}\n---\n\n${cleaned}`);
  }

  return sections.join("\n\n");
}

// Exports for testing
module.exports = {
  slugToFilePath,
  flattenNavSlugs,
  generateLlmsTxt,
  generateLlmsFullTxt,
  rewriteRelativeLinks,
  walkPagesWithMd,
  parseFrontmatterKV,
  SITE_URL,
};

// Main — only runs when executed directly, not when required by tests
if (require.main === module) {
  const docsDir = getDocsDirectory();
  const appDir = getAppDirectory();
  const navPath = path.join(rootDir, "content", "docs_nav.json");

  if (!fs.existsSync(navPath)) {
    console.error("Error: docs_nav.json not found. Run copy_docs.js first.");
    process.exit(1);
  }

  const navData = JSON.parse(fs.readFileSync(navPath, "utf-8"));
  const pages = walkPagesWithMd(appDir);
  console.log(`Found ${pages.length} pages with a markdown twin.`);

  // Generate llms.txt
  console.log("Generating llms.txt...");
  const llmsTxt = generateLlmsTxt(navData, pages);
  const llmsTxtDest = path.join(rootDir, "public", "llms.txt");
  fs.mkdirSync(path.dirname(llmsTxtDest), { recursive: true });
  fs.writeFileSync(llmsTxtDest, llmsTxt);
  console.log("llms.txt generated.");

  // Generate llms-full.txt
  console.log("Generating llms-full.txt...");
  const llmsFullTxt = generateLlmsFullTxt(docsDir, navData, pages);
  const llmsFullTxtDest = path.join(rootDir, "public", "llms-full.txt");
  fs.writeFileSync(llmsFullTxtDest, llmsFullTxt);
  console.log("llms-full.txt generated.");

  console.log("Done!");
}
