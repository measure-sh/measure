import {
  getAllBlogTags,
  getPostsByTag,
  toPostSummary,
} from "@/app/utils/blog_source";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "../../components/post_card";

interface PageParams {
  params: Promise<{ tag: string }>;
}

// Tag URLs are fixed at build time: the collection schema restricts tags
// to kebab-case slugs, and with dynamicParams off any other path 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogTags().map(({ tag }) => ({ tag }));
}

export default async function Page(props: PageParams) {
  const params = await props.params;
  const posts = getPostsByTag(params.tag).map(toPostSummary);
  if (posts.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <Link
        href="/blog"
        className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
      >
        &larr; All posts
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">
        Posts tagged &ldquo;{params.tag}&rdquo;
      </h1>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </main>
  );
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const title = `Blog posts tagged ${params.tag}`;
  const description = `Measure blog posts tagged ${params.tag}.`;

  return pageMetadata(
    { title, description, path: `/blog/tags/${params.tag}` },
    { addMeasureSuffixToTitle: false },
  );
}
