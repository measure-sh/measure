// Next.js excludes underscore-prefixed folders from routing. A rename of
// page-md to a name that starts with "_" makes this handler return 404
// with no build error.
import { stripFrontmatter } from "@/app/utils/frontmatter";
import { readMarkdownTwin } from "@/app/utils/llms/markdown_twins";
import { type NextRequest, NextResponse } from "next/server";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return notAcceptable();
  }

  // The proxy rewrites "/" to "/page-md/index", so the segment ["index"]
  // maps to app/page.md.
  const pagePath =
    segments.length === 1 && segments[0] === "index"
      ? "/"
      : `/${segments.join("/")}`;
  const markdown = readMarkdownTwin(pagePath);
  if (markdown === null) {
    return notAcceptable();
  }
  return markdownResponse(stripFrontmatter(markdown));
}
