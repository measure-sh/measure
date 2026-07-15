const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const PUBLIC_DIR = path.join(ROOT, "public");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) files.push(...walk(full));
    else if (name.isFile() && name.name === "page.tsx") files.push(full);
  }
  return files;
}

/**
 * The /docs route of a content/docs .mdx file: index.mdx maps to its
 * directory, parenthesized folder-group segments don't affect the route.
 */
function docsRouteFromFile(contentDir, file) {
  const rel = path.relative(contentDir, file).split(path.sep).join("/");
  const segments = rel
    .replace(/\.mdx$/, "")
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment));
  if (segments[segments.length - 1] === "index") {
    segments.pop();
  }
  return segments.length === 0 ? "/docs" : `/docs/${segments.join("/")}`;
}

/** Docs routes from the content/docs .mdx sources. */
function getDocsRoutes() {
  const contentDir = path.join(ROOT, "content", "docs");
  const routes = [];

  function walkDocs(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDocs(full);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        routes.push(docsRouteFromFile(contentDir, full));
      }
    }
  }

  walkDocs(contentDir);
  return routes;
}

function routeFromFile(file) {
  const rel = path.relative(APP_DIR, path.dirname(file));
  let route = "/" + rel.replace(/\\/g, "/");
  if (route === "/.") route = "/";
  // normalize root
  route = route.replace(/\/\/$/, "");
  if (route === "/.") route = "/";
  return route === "/" ? "/" : route;
}

function isDynamic(route) {
  return /\[.+?\]/.test(route);
}

const EXCLUDED_PREFIXES = ["/auth/"];

function isExcluded(route) {
  return EXCLUDED_PREFIXES.some((prefix) => route.startsWith(prefix));
}

function ensurePublicDir() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function buildSitemap(urls) {
  const now = new Date().toISOString();
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const u of urls) {
    parts.push("  <url>");
    parts.push(`    <loc>${u}</loc>`);
    parts.push(`    <lastmod>${now}</lastmod>`);
    parts.push("  </url>");
  }
  parts.push("</urlset>");
  return parts.join("\n");
}

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error("app directory not found:", APP_DIR);
    process.exit(1);
  }

  const files = walk(APP_DIR);

  const routes = new Set();

  for (const f of files) {
    const route = routeFromFile(f);
    if (isDynamic(route) || isExcluded(route)) {
      continue;
    }
    routes.add(route === "/" ? "/" : route.replace(/\\/g, "/"));
  }

  for (const route of getDocsRoutes()) {
    routes.add(route);
  }

  const urls = Array.from(routes)
    .sort()
    .map((r) => (r === "/" ? SITE_URL : `${SITE_URL}${r}`));

  ensurePublicDir();
  const xml = buildSitemap(urls);
  const out = path.join(PUBLIC_DIR, "sitemap.xml");
  fs.writeFileSync(out, xml, "utf8");
  console.log("Wrote sitemap with", urls.length, "entries to", out);
}

if (require.main === module) main();

module.exports = {
  walk,
  routeFromFile,
  docsRouteFromFile,
  isDynamic,
  isExcluded,
  getDocsRoutes,
  buildSitemap,
  ensurePublicDir,
  main,
  APP_DIR,
  PUBLIC_DIR,
  ROOT,
  SITE_URL,
};
