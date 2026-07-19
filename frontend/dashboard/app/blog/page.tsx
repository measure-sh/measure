import {
  blogDescription,
  getAllBlogTags,
  getSortedBlogPosts,
  toPostSummary,
} from "@/app/utils/blog_source";
import { sharedOpenGraph } from "@/app/utils/metadata";
import type { Metadata } from "next";
import PostsList from "./components/posts_list";

const title = "Blog";

export const metadata: Metadata = {
  title,
  description: blogDescription,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
  openGraph: {
    ...sharedOpenGraph,
    title,
    description: blogDescription,
    url: "/blog",
  },
  // Set per-page so X shows this page's card instead of the root
  // layout's twitter tags (Next merges metadata shallowly).
  twitter: {
    card: "summary_large_image",
    title,
    description: blogDescription,
    images: sharedOpenGraph.images,
  },
};

export default function Page() {
  const posts = getSortedBlogPosts().map(toPostSummary);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Blog</h1>
        <p className="text-fd-muted-foreground">{blogDescription}</p>
      </div>
      <PostsList posts={posts} tags={getAllBlogTags()} />
    </main>
  );
}
