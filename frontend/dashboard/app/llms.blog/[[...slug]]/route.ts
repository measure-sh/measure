import { blogSource, getSortedBlogPosts } from "@/app/utils/blog_source";
import { renderPageMarkdown } from "@/app/utils/llms/markdown_generator";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

// Serves each blog post as processed markdown, the same contract as the
// docs /llms.docs route: public URLs are the post URL with a .md suffix
// (/blog/foo.md), rewritten here by next.config, and the proxy lands
// markdown-preferring requests for /blog/* here. The bare /llms.blog URL
// (public /blog.md) returns a markdown index of all posts, since the blog
// index is not itself a collection page. Prerendered at build: the post
// list is fixed at build, and with dynamicParams off unknown slugs 404
// without running the handler.
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
