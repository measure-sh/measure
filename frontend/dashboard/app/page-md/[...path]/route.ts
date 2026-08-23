// Folder is named `page-md`, not `_md`: Next.js App Router treats
// underscore-prefixed folders as private and excludes them from routing.
// Don't rename to anything starting with `_` or this handler silently 404s.
import { stripFrontmatter } from "@/app/utils/frontmatter";
import fs from "fs";
import { type NextRequest, NextResponse } from "next/server";
import path from "path";

const APP_DIR = path.join(process.cwd(), "app");

function notAcceptable() {
  return new NextResponse(
    "No markdown representation available for this resource.\n",
    {
      status: 406,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "Accept",
      },
    },
  );
}

function markdownResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

/**
 * Resolve URL segments to a colocated `page.md` next to the route's
 * `page.tsx`. The proxy rewrites `/` to `/page-md/index` so the homepage
 * lands here as ["index"] — translate that back to `app/page.md`.
 */
function resolvePageMd(segments: string[]): string | null {
  const rel =
    segments.length === 1 && segments[0] === "index"
      ? "page.md"
      : path.join(...segments, "page.md");

  const candidate = path.join(APP_DIR, rel);
  // path.join collapses any "..", and the startsWith guard catches escapes
  if (!candidate.startsWith(`${APP_DIR}${path.sep}`)) {
    return null;
  }
  return fs.existsSync(candidate) ? candidate : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return notAcceptable();
  }

  const file = resolvePageMd(segments);
  if (!file) {
    return notAcceptable();
  }

  // The path is built at request time, so the bundler can't tell which files
  // this reads and falls back to tracing the entire repository into the build
  // output, which is slow here and fails outright on hosts that check out the
  // whole monorepo. The page.md files are already listed in
  // outputFileTracingIncludes in next.config.mjs, so they ship regardless and
  // the tracer can skip this call.
  const raw = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf-8");
  return markdownResponse(stripFrontmatter(raw));
}
