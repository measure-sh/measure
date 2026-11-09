import fs from "fs";
import path from "path";

const APP_DIR = path.join(process.cwd(), "app");

// Page paths come from the request URL, so the bundler cannot tell which
// files the fs calls below touch and would trace the entire repository into
// the build output. The turbopackIgnore comments stop that, and
// next.config.mjs lists the page.md files in outputFileTracingIncludes so
// they still ship.

function twinFile(pagePath: string): string | null {
  const file = path.join(APP_DIR, pagePath, "page.md");
  // path.join collapses ".." segments, so this check rejects any path
  // outside APP_DIR.
  return file.startsWith(`${APP_DIR}${path.sep}`) ? file : null;
}

export function hasMarkdownTwin(pagePath: string): boolean {
  const file = twinFile(pagePath);
  return file !== null && fs.existsSync(/*turbopackIgnore: true*/ file);
}

export function readMarkdownTwin(pagePath: string): string | null {
  const file = twinFile(pagePath);
  if (file === null || !fs.existsSync(/*turbopackIgnore: true*/ file)) {
    return null;
  }
  return fs.readFileSync(/*turbopackIgnore: true*/ file, "utf-8");
}
