import { renderPageMarkdown } from "@/app/utils/llms/page_markdown";
import { source } from "@/app/utils/docs_source";

// Public URLs are the page URL with a .md suffix (/docs/foo.md).
// next.config rewrites them to this route. The proxy also sends
// markdown-preferring requests for /docs/* here. The docs source is fixed
// at build time. With dynamicParams off, an unknown slug returns 404
// without running the handler.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(await renderPageMarkdown(page), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
