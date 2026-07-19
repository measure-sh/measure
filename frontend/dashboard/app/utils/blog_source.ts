/**
 * Typed access to the content/blog collection: the fumadocs loader plus
 * the query helpers every blog surface shares (publish dates, sorting,
 * tags, client-facing post summaries). Kept in app/utils rather than
 * app/blog because surfaces outside the blog routes read it too: the
 * llms.txt/llms-full.txt handlers, the /llms.blog per-post markdown
 * route and the proxy-negotiated markdown responses.
 */
import type { BlogPostSummary } from "@/app/blog/components/post_card";
import { blogPosts } from "collections/server";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

// The blog has no meta.json tree, so the collection is wrapped with an
// empty meta list.
export const blogSource = loader({
  baseUrl: "/blog",
  source: toFumadocsSource(blogPosts, []),
});

export type BlogPost = ReturnType<typeof blogSource.getPages>[number];

export const blogDescription =
  "Engineering deep dives, decisions and trade-offs from the team building Measure.";

/** Publish date as a Date; frontmatter dates arrive as ISO strings or Dates. */
export function postDate(post: BlogPost): Date {
  const { date } = post.data;
  return typeof date === "string" ? new Date(date) : date;
}

/** ISO yyyy-mm-dd form of the publish date, for time elements and metadata. */
export function postDateISO(post: BlogPost): string {
  return postDate(post).toISOString().slice(0, 10);
}

// Date-only frontmatter values parse as UTC midnight, so format in UTC to
// keep the rendered calendar date independent of the server timezone.
export function formatPostDate(post: BlogPost): string {
  return postDate(post).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** All posts, newest first. */
export function getSortedBlogPosts(): BlogPost[] {
  return [...blogSource.getPages()].sort(
    (a, b) => postDate(b).getTime() - postDate(a).getTime(),
  );
}

/** Posts carrying a tag, newest first. */
export function getPostsByTag(tag: string): BlogPost[] {
  return getSortedBlogPosts().filter((post) => post.data.tags.includes(tag));
}

/** Distinct tags across all posts with post counts, most used first. */
export function getAllBlogTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of blogSource.getPages()) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The plain-object shape of a post passed to client components. */
export function toPostSummary(post: BlogPost): BlogPostSummary {
  return {
    url: post.url,
    slug: post.slugs[0] ?? "",
    title: post.data.title,
    description: post.data.description,
    image: post.data.image,
    authorName: post.data.author.name,
    dateISO: postDateISO(post),
    dateFormatted: formatPostDate(post),
    tags: post.data.tags,
  };
}
