import { renderPageMarkdown } from "@/app/utils/llms/markdown_generator";
import { source } from "@/app/utils/docs_source";

// Serves each docs page as processed markdown. Public URLs are the page
// URL with a .md suffix (/docs/foo.md), rewritten here by next.config;
// the proxy also lands markdown-preferring requests for /docs/* here.
// Prerendered at build: the docs source is fixed at build, and with
// dynamicParams off unknown slugs 404 without running the handler.
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
