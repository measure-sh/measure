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

const { stripHtmlComments, mdPathToSlug } = require("./copy_docs");

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
function generateLlmsTxt(navData) {
  const lines = [];
  lines.push("# measure.sh");
  lines.push("");
  lines.push(
    "> Open-source, privacy-focused mobile analytics and crash reporting for Android, iOS, and Flutter apps."
  );
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
                `- [${grandchild.title}](${SITE_URL}${grandchild.slug})`
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

  lines.push("## Optional");
  lines.push("");
  lines.push(
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): Complete documentation in a single file`
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
      }
    )
    .replace(
      /!\[([^\]]*)\]\((?:\.\/)?assets\/([^)]+)\)/g,
      (match, alt, assetPath) => {
        return `![${alt}](${SITE_URL}/docs/assets/${assetPath})`;
      }
    );
}

/**
 * Generate llms-full.txt with all documentation concatenated.
 * Follows the nav ordering, strips HTML comments, and rewrites
 * relative links to absolute URLs.
 */
function generateLlmsFullTxt(docsDir, navData) {
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
    const cleaned = stripHtmlComments(raw);
    const rewritten = rewriteRelativeLinks(cleaned);
    const sourceUrl =
      slug === "/docs" ? `${SITE_URL}/docs` : `${SITE_URL}${slug}`;

    sections.push(`---\nSource: ${sourceUrl}\n---\n\n${rewritten}`);
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
  SITE_URL,
};

// Main — only runs when executed directly, not when required by tests
if (require.main === module) {
  const docsDir = getDocsDirectory();
  const navPath = path.join(rootDir, "content", "docs_nav.json");

  if (!fs.existsSync(navPath)) {
    console.error(
      "Error: docs_nav.json not found. Run copy_docs.js first."
    );
    process.exit(1);
  }

  const navData = JSON.parse(fs.readFileSync(navPath, "utf-8"));

  // Generate llms.txt
  console.log("Generating llms.txt...");
  const llmsTxt = generateLlmsTxt(navData);
  const llmsTxtDest = path.join(rootDir, "public", "llms.txt");
  fs.mkdirSync(path.dirname(llmsTxtDest), { recursive: true });
  fs.writeFileSync(llmsTxtDest, llmsTxt);
  console.log("llms.txt generated.");

  // Generate llms-full.txt
  console.log("Generating llms-full.txt...");
  const llmsFullTxt = generateLlmsFullTxt(docsDir, navData);
  const llmsFullTxtDest = path.join(rootDir, "public", "llms-full.txt");
  fs.writeFileSync(llmsFullTxtDest, llmsFullTxt);
  console.log("llms-full.txt generated.");

  console.log("Done!");
}
