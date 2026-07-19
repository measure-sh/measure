import {
  blogDescription,
  getSortedBlogPosts,
  postDate,
} from "@/app/utils/blog_source";
import { Feed } from "feed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

// Prerendered at build time: the post list is fixed at build.
export const dynamic = "force-static";

export function GET() {
  const posts = getSortedBlogPosts();

  const feed = new Feed({
    title: "Measure Blog",
    id: `${SITE_URL}/blog`,
    link: `${SITE_URL}/blog`,
    description: blogDescription,
    language: "en",
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: "measure.sh",
    updated: posts.length > 0 ? postDate(posts[0]) : undefined,
    feedLinks: { rss: `${SITE_URL}/blog/rss.xml` },
  });

  for (const post of posts) {
    feed.addItem({
      title: post.data.title,
      id: `${SITE_URL}${post.url}`,
      link: `${SITE_URL}${post.url}`,
      description: post.data.description,
      date: postDate(post),
      author: [{ name: post.data.author.name }],
      category: post.data.tags.map((tag) => ({ name: tag })),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
