/**
 * Pre-build script that:
 * 1. Copies docs/ markdown files into content/docs/ for the Next.js build (skipped if content/docs already exists, e.g. in Docker)
 * 2. Copies doc assets into public/docs/assets/
 * 3. Generates the search index JSON
 * 4. Generates the sidebar nav JSON from README.md link structure
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const docsSource = path.resolve(rootDir, "..", "..", "docs");
const contentDest = path.join(rootDir, "content", "docs");
const assetsDest = path.join(rootDir, "public", "docs", "assets");
const searchIndexDest = path.join(
  rootDir,
  "public",
  "docs",
  "search-index.json",
);
const navDest = path.join(rootDir, "content", "docs_nav.json");

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function stripHtmlComments(text) {
  let result = text;
  while (result.includes("<!--")) {
    result = result.replace(/<!--[\s\S]*?-->/g, "");
  }
  return result.trim();
}

/**
 * Strip leading YAML frontmatter (--- ... --- block at start of file).
 */
function stripFrontmatter(text) {
  const match = text.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/);
  return match ? text.slice(match[0].length) : text;
}

function extractTitle(content) {
  const match = stripFrontmatter(content).match(/^#\s+(.+)$/m);
  return match ? stripHtmlComments(match[1]).trim() : "Documentation";
}

function generateSearchIndex(docsDir) {
  const entries = [];

  function walk(dir, prefix) {
    const dirEntries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        if (entry.name === "assets") continue;
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const filePath = path.join(dir, entry.name);
        const content = fs.readFileSync(filePath, "utf-8");
        const body = stripFrontmatter(content);

        const title = extractTitle(body);
        const headings = [];
        const headingRegex = /^#{2,3}\s+(.+)$/gm;
        let match;
        while ((match = headingRegex.exec(body)) !== null) {
          headings.push(stripHtmlComments(match[1]).trim());
        }

        const plainContent = stripHtmlComments(body)
          .replace(/^#{1,6}\s+.+$/gm, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[*_`~]/g, "")
          .replace(/\n{2,}/g, "\n")
          .trim();

        let slug;
        if (entry.name === "README.md") {
          slug = prefix.length === 0 ? "/" : `/${prefix.join("/")}`;
        } else {
          const name = entry.name.replace(/\.md$/, "");
          slug = `/${[...prefix, name].join("/")}`;
        }

        entries.push({ slug, title, headings, content: plainContent });
      }
    }
  }

  walk(docsDir, []);
  return entries;
}

// ─── Nav generation ─────────────────────────────────────────────────────────

/**
 * Convert a relative .md path to a /docs/... slug.
 * e.g. "features/feature-crash-reporting.md" → "/docs/features/feature-crash-reporting"
 *      "hosting/README.md" → "/docs/hosting"
 */
function mdPathToSlug(href) {
  let p = href.split("#")[0].replace(/^\.\//, "");
  if (p === "README.md") {
    return "/docs";
  }
  if (p.endsWith("/README.md")) {
    p = p.slice(0, -"/README.md".length);
  } else {
    p = p.replace(/\.md$/, "");
  }
  return `/docs/${p}`;
}

/**
 * Read h1 title from a .md file.
 */
function getTitleFromFile(docsDir, mdPath) {
  const resolved = mdPath.replace(/^\.\//, "");
  const filePath = path.join(docsDir, resolved);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = stripFrontmatter(fs.readFileSync(filePath, "utf-8"));
  const match = content.match(/^#\s+(.+)$/m);
  return match ? stripHtmlComments(match[1]).trim() : null;
}

/**
 * Parse ordered nav children from a subdirectory's README.md links.
 * Also appends any .md files in the directory not covered by the README.
 */
function parseDirectoryNav(docsDir, subDir) {
  const readmePath = path.join(docsDir, subDir, "README.md");
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const readme = stripFrontmatter(fs.readFileSync(readmePath, "utf-8"));
  const children = [];
  const seen = new Set();

  const linkRegex = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(([^)]+\.md)\)/g;
  let match;

  while ((match = linkRegex.exec(readme)) !== null) {
    const href = match[2];
    if (
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("../")
    ) {
      continue;
    }

    const cleanHref = href.replace(/^\.\//, "");
    const fullPath = `${subDir}/${cleanHref}`;
    const slug = mdPathToSlug(fullPath);

    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);

    if (cleanHref.endsWith("README.md")) {
      const nestedDir = fullPath.replace(/\/README\.md$/, "");
      const nestedChildren = parseDirectoryNav(docsDir, nestedDir);
      const title =
        getTitleFromFile(docsDir, fullPath) ||
        match[1].replace(/\*\*/g, "").trim();

      if (nestedChildren.length > 0) {
        children.push({
          title,
          children: [{ title: "Overview", slug }, ...nestedChildren],
        });
      } else {
        children.push({ title, slug });
      }
    } else {
      const title =
        getTitleFromFile(docsDir, fullPath) ||
        match[1].replace(/\*\*/g, "").trim();
      children.push({ title, slug });
    }
  }

  // Append any .md files not linked from the README
  const dirPath = path.join(docsDir, subDir);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === "README.md" || entry.name === "assets") {
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const fullPath = `${subDir}/${entry.name}`;
      const slug = mdPathToSlug(fullPath);
      if (!seen.has(slug)) {
        seen.add(slug);
        const title =
          getTitleFromFile(docsDir, fullPath) ||
          entry.name.replace(/\.md$/, "");
        children.push({ title, slug });
      }
    }
    if (
      entry.isDirectory() &&
      fs.existsSync(path.join(dirPath, entry.name, "README.md"))
    ) {
      const fullPath = `${subDir}/${entry.name}/README.md`;
      const slug = mdPathToSlug(fullPath);
      if (!seen.has(slug)) {
        seen.add(slug);
        const nestedChildren = parseDirectoryNav(
          docsDir,
          `${subDir}/${entry.name}`,
        );
        const title = getTitleFromFile(docsDir, fullPath) || entry.name;
        if (nestedChildren.length > 0) {
          children.push({
            title,
            children: [{ title: "Overview", slug }, ...nestedChildren],
          });
        } else {
          children.push({ title, slug });
        }
      }
    }
  }

  return children;
}

/**
 * Generate sidebar nav tree from the root README.md structure.
 *
 * The README defines ordering and grouping through:
 * - # headings for sections (Integrate the SDK, Explore Features, etc.)
 * - Bullet lists with links for feature items
 * - Indented bullets for nested groups (e.g. Bug Reporting → Android/iOS/Flutter)
 * - "Further Reading" section for directory-based groups
 */
function generateDocsNav(docsDir) {
  const readme = stripFrontmatter(
    fs.readFileSync(path.join(docsDir, "README.md"), "utf-8"),
  );
  const lines = readme.split("\n");
  const nav = [];
  const preambleLinks = []; // .md links from before the first content section

  let currentSection = null;
  let featuresGroup = null;
  let currentBulletGroup = null;
  const processedSections = new Set();

  for (const line of lines) {
    // Track # headings
    const headingMatch = line.match(/^# (.+)/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      currentBulletGroup = null;

      if (currentSection === "Explore Features") {
        featuresGroup = { title: "Features", children: [] };
        nav.push(featuresGroup);
      }
      continue;
    }

    // Skip ### headings
    if (line.match(/^#{2,}/)) {
      continue;
    }

    // Detect "Further Reading" marker in the preamble
    if (line.match(/^\*\*Further Reading\*\*/)) {
      currentSection = "Further Reading";
      continue;
    }

    // Indented bullet with link → child of current group
    const indentedMatch = line.match(
      /^\s{2,}\*\s+\[\*?\*?([^\]]*?)\*?\*?\]\(([^)]+\.md)\)/,
    );
    if (indentedMatch && currentBulletGroup) {
      const href = indentedMatch[2];
      if (!href.startsWith("#")) {
        const slug = mdPathToSlug(href);
        const title =
          getTitleFromFile(docsDir, href) ||
          indentedMatch[1].replace(/\*\*/g, "").trim();
        currentBulletGroup.children.push({ title, slug });
      }
      continue;
    }

    // Bold text without link → group header (e.g. "Bug Reporting")
    const groupMatch = line.match(/^\*\s+\*\*([^*]+)\*\*/);
    if (groupMatch && !line.includes("](")) {
      if (currentSection === "Explore Features" && featuresGroup) {
        currentBulletGroup = { title: groupMatch[1].trim(), children: [] };
        featuresGroup.children.push(currentBulletGroup);
      }
      continue;
    }

    // Bullet with link
    const bulletMatch = line.match(
      /^\*\s+\[\*?\*?([^\]]*?)\*?\*?\]\(([^)]+\.md)\)/,
    );
    if (bulletMatch) {
      const href = bulletMatch[2];
      if (href.startsWith("#")) {
        continue;
      }

      currentBulletGroup = null;
      const isDirectory = href.endsWith("README.md");

      if (currentSection === "Explore Features" && featuresGroup) {
        const slug = mdPathToSlug(href);
        const title =
          getTitleFromFile(docsDir, href) ||
          bulletMatch[1].replace(/\*\*/g, "").trim();
        featuresGroup.children.push({ title, slug });
      } else if (
        currentSection === "Documentation" ||
        currentSection === "Further Reading"
      ) {
        // Preamble/further reading links → collect for appending after body sections
        if (isDirectory) {
          const slug = mdPathToSlug(href);
          const subDir = href
            .replace(/\/?README\.md$/, "")
            .replace(/^\.\//, "");
          const children = parseDirectoryNav(docsDir, subDir);
          const title =
            getTitleFromFile(docsDir, href) ||
            bulletMatch[1].replace(/\*\*/g, "").trim();

          if (children.length > 0) {
            preambleLinks.push({
              title,
              children: [{ title: "Overview", slug }, ...children],
            });
          } else {
            preambleLinks.push({ title, slug });
          }
        } else {
          const slug = mdPathToSlug(href);
          const title =
            getTitleFromFile(docsDir, href) ||
            bulletMatch[1].replace(/\*\*/g, "").trim();
          preambleLinks.push({ title, slug });
        }
      }
      continue;
    }

    // Inline link in paragraph text (for sections like "Configuration Options")
    if (
      currentSection &&
      !["Explore Features", "Further Reading", "Documentation"].includes(
        currentSection,
      )
    ) {
      const inlineMatch = line.match(/\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/);
      if (
        inlineMatch &&
        !inlineMatch[2].startsWith("#") &&
        !processedSections.has(currentSection)
      ) {
        processedSections.add(currentSection);
        const href = inlineMatch[2];
        const slug = mdPathToSlug(href);
        const title = getTitleFromFile(docsDir, href) || currentSection;
        nav.push({ title, slug });
      }
    }
  }

  // Append preamble/further reading items after body sections
  nav.push(...preambleLinks);

  return nav;
}

// Exports for testing
module.exports = {
  stripHtmlComments,
  stripFrontmatter,
  extractTitle,
  mdPathToSlug,
  getTitleFromFile,
  parseDirectoryNav,
  generateDocsNav,
  generateSearchIndex,
};

// Main — only runs when executed directly, not when required by tests
if (require.main === module) {
  // Prefer the canonical monorepo docs source. Only fall back to the
  // existing content/docs/ when the monorepo root isn't available (Docker
  // builds, where the dashboard image is built with content/docs/
  // pre-populated and the repo root is not mounted).
  if (fs.existsSync(docsSource)) {
    console.log("Copying docs to content/docs/...");
    if (fs.existsSync(contentDest)) {
      fs.rmSync(contentDest, { recursive: true });
    }
    copyDirRecursive(docsSource, contentDest);
  } else if (fs.existsSync(contentDest)) {
    console.log("Using existing content/docs/ (Docker build)");
  } else {
    console.error("Error: docs directory not found at", docsSource);
    process.exit(1);
  }

  const effectiveDocsDir = contentDest;

  // Copy assets to public/docs/assets/
  console.log("Copying assets to public/docs/assets/...");
  const assetsSource = path.join(effectiveDocsDir, "assets");
  if (fs.existsSync(assetsSource)) {
    if (fs.existsSync(assetsDest)) {
      fs.rmSync(assetsDest, { recursive: true });
    }
    copyDirRecursive(assetsSource, assetsDest);
  }

  // Generate search index
  console.log("Generating search index...");
  fs.mkdirSync(path.dirname(searchIndexDest), { recursive: true });
  const searchIndex = generateSearchIndex(effectiveDocsDir);
  fs.writeFileSync(searchIndexDest, JSON.stringify(searchIndex));
  console.log(`Search index generated with ${searchIndex.length} entries.`);

  // Generate sidebar nav
  console.log("Generating sidebar nav...");
  const docsNavData = generateDocsNav(effectiveDocsDir);
  fs.mkdirSync(path.dirname(navDest), { recursive: true });
  fs.writeFileSync(navDest, JSON.stringify(docsNavData, null, 2));
  console.log(
    `Sidebar nav generated with ${docsNavData.length} top-level items.`,
  );

  console.log("Done!");
}
