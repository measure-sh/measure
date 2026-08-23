// Next.js excludes underscore-prefixed folders from routing. A rename of
// page-md to a name that starts with "_" makes this handler return 404
// with no build error.
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
 * The proxy rewrites "/" to "/page-md/index". The segment ["index"]
 * therefore maps to app/page.md.
 */
function resolvePageMd(segments: string[]): string | null {
  const rel =
    segments.length === 1 && segments[0] === "index"
      ? "page.md"
      : path.join(...segments, "page.md");

  const candidate = path.join(APP_DIR, rel);
  // path.join collapses ".." segments, so the startsWith check rejects
  // any path outside APP_DIR.
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

  // The path is computed at request time. The bundler cannot see which
  // files this call reads, so it would trace the entire repository into
  // the build output. That is slow and fails on hosts that check out the
  // whole monorepo. next.config.mjs lists the page.md files in
  // outputFileTracingIncludes, so they ship without the trace.
  const raw = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf-8");
  return markdownResponse(stripFrontmatter(raw));
}
