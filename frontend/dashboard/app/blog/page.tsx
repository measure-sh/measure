import {
  blogDescription,
  getAllBlogTags,
  getSortedBlogPosts,
  toPostSummary,
} from "@/app/utils/blog_source";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import PostsList from "./components/posts_list";

const title = "Blog";

const base = pageMetadata(
  { title, description: blogDescription, path: "/blog" },
  { addMeasureSuffixToTitle: false },
);

export const metadata: Metadata = {
  ...base,
  // The feed link belongs to this page alone, so it is added on top of
  // the canonical link the shared helper produces.
  alternates: {
    ...base.alternates,
    types: { "application/rss+xml": "/blog/rss.xml" },
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
