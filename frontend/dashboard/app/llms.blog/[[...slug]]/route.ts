import { blogSource, getSortedBlogPosts } from "@/app/utils/blog_source";
import { renderPageMarkdown } from "@/app/utils/llms/page_markdown";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

// Public URLs are the post URL with a .md suffix (/blog/foo.md).
// next.config rewrites them to this route. The proxy also sends
// markdown-preferring requests for /blog/* here. The bare URL (public
// /blog.md) returns a markdown index, because the blog index page has no
// markdown source of its own. The post list is fixed at build time. With
// dynamicParams off, an unknown slug returns 404 without running the
// handler.
export const dynamic = "force-static";
export const dynamicParams = false;

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
  "Cache-Control": "public, max-age=300, s-maxage=600",
};

function blogIndexMarkdown(): string {
  const lines: string[] = ["# Measure Blog", ""];
  for (const post of getSortedBlogPosts()) {
    const suffix = post.data.description ? `: ${post.data.description}` : "";
    lines.push(`- [${post.data.title}](${SITE_URL}${post.url})${suffix}`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return new Response(blogIndexMarkdown(), { headers: MARKDOWN_HEADERS });
  }

  const page = blogSource.getPage(slug);
  if (!page) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(await renderPageMarkdown(page), {
    headers: MARKDOWN_HEADERS,
  });
}

export function generateStaticParams() {
  return [{ slug: [] }, ...blogSource.generateParams()];
}
