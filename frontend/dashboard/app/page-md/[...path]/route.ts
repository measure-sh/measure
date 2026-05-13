// Folder is named `page-md`, not `_md`: Next.js App Router treats
// underscore-prefixed folders as private and excludes them from routing.
// Don't rename to anything starting with `_` or this handler silently 404s.
import { getDocBySlug, getDocIndex, parseFrontmatter } from "@/app/docs/docs";
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
 * `page.tsx`. The middleware rewrites `/` to `/_md/index` so the homepage
 * lands here as ["index"] — translate that back to `app/page.md`.
 */
function resolvePageMd(segments: string[]): string | null {
  const rel = segments.length === 1 && segments[0] === "index"
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
  { params }: { params: { path?: string[] } },
) {
  const segments = params.path ?? [];

  if (segments.length === 0) {
    return notAcceptable();
  }

  if (segments[0] === "docs") {
    const slug = segments.slice(1);
    const doc = slug.length === 0 ? getDocIndex() : getDocBySlug(slug);
    if (!doc) {
      return notAcceptable();
    }
    // getDocBySlug strips HTML comments from the body but leaves frontmatter
    // already removed; doc.content is the cleaned markdown body.
    return markdownResponse(doc.content);
  }

  const file = resolvePageMd(segments);
  if (!file) {
    return notAcceptable();
  }

  const raw = fs.readFileSync(file, "utf-8");
  const { body } = parseFrontmatter(raw);
  return markdownResponse(body);
}
