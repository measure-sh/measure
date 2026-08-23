import fs from "fs";
import path from "path";

// Fumadocs only includes pages listed in a folder's meta.json "pages" array.
// // An unlisted .mdx file is silently omitted from the sidebar, sitemap, and
// // llms.txt. This test keeps the filesystem and metadata in sync in both
// // directions: every page on disk must be listed, and every listed page must
// // still exist.

const docsDir = path.join(process.cwd(), "content", "docs");

// These API reference pages are generated from OpenAPI specs at build time.
// Their generated pages are not present in the working tree, so only the
// committed meta.json files can be checked here.
const generatedDirs = [
  path.join(docsDir, "api", "sdk"),
  path.join(docsDir, "api", "dashboard"),
];

interface FolderProblems {
  dir: string;
  missingFromMeta: string[];
  missingOnDisk: string[];
}

// Only folders containing docs need to participate in the docs tree.
// Empty directories are just scaffolding and do not need a meta.json entry.
function containsDocs(dir: string): boolean {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.some((entry) => {
    if (entry.isFile()) {
      return entry.name.endsWith(".mdx") || entry.name === "meta.json";
    }
    if (entry.isDirectory()) {
      return containsDocs(path.join(dir, entry.name));
    }
    return false;
  });
}

function checkFolder(dir: string, problems: FolderProblems[]): void {
  if (generatedDirs.includes(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const pageNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""));
  const childDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => containsDocs(path.join(dir, name)));

  for (const name of childDirs) {
    checkFolder(path.join(dir, name), problems);
  }

  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return;
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (!Array.isArray(meta.pages)) {
    return;
  }

  // Ignore meta.json entries that are not page references:
  // - "---Label---" and "---" are sidebar separators.
  // - "[Text](url)" is an external link.
  // - "..." includes all otherwise-unlisted pages.
  // - "!" marks a page as intentionally excluded from the docs tree.
  const listed = new Set<string>();
  let hasRest = false;
  for (const entry of meta.pages) {
    if (typeof entry !== "string") {
      continue;
    }
    if (entry === "...") {
      hasRest = true;
      continue;
    }
    if (/^---.*---$/.test(entry) || entry === "---" || entry.startsWith("[")) {
      continue;
    }
    listed.add(entry.startsWith("!") ? entry.slice(1) : entry);
  }

  // index.mdx is the folder's own page and does not need to be listed.
  // Every other page and every non-empty child folder must be listed unless
  // "..." is present, which implicitly includes all unlisted pages.
  const required = [
    ...pageNames.filter((name) => name !== "index"),
    ...childDirs,
  ];
  const missingFromMeta = hasRest
    ? []
    : required.filter((name) => !listed.has(name));
  const missingOnDisk = [...listed].filter(
    (name) =>
      name !== "index" &&
      !pageNames.includes(name) &&
      !childDirs.includes(name),
  );

  if (missingFromMeta.length > 0 || missingOnDisk.length > 0) {
    problems.push({
      dir: path.relative(docsDir, dir) || ".",
      missingFromMeta,
      missingOnDisk,
    });
  }
}

describe("docs meta.json coverage", () => {
  it("lists every docs page and folder in its meta.json", () => {
    const problems: FolderProblems[] = [];
    checkFolder(docsDir, problems);

    const report = problems
      .flatMap((p) => [
        ...p.missingFromMeta.map(
          (name) =>
            `content/docs/${p.dir}/${name} exists but is not in ${p.dir}/meta.json "pages" — the page is invisible in the sidebar, sitemap and llms.txt. Add it to the list (or add "..." to include all unlisted pages).`,
        ),
        ...p.missingOnDisk.map(
          (name) =>
            `${p.dir}/meta.json lists "${name}" but content/docs/${p.dir}/${name} does not exist — remove the entry or restore the page.`,
        ),
      ])
      .join("\n");

    expect(report).toBe("");
  });
});
