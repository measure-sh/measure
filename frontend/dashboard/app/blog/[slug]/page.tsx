import {
  blogSource,
  formatPostDate,
  postDate,
  postDateISO,
} from "@/app/utils/blog_source";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TagChip } from "../components/post_card";
import PostFooter from "../components/post_footer";
import { getBlogMDXComponents } from "../mdx_components";

interface PageParams {
  params: Promise<{ slug: string }>;
}

export default async function Page(props: PageParams) {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link
        href="/blog"
        className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
      >
        &larr; All posts
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{page.data.title}</h1>
      {page.data.description ? (
        <p className="mt-3 text-lg text-fd-muted-foreground">
          {page.data.description}
        </p>
      ) : null}
      <div className="mt-6 flex items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <Image
            src={page.data.author.avatar}
            alt={page.data.author.name}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="text-sm">
            <p className="font-medium">{page.data.author.name}</p>
            <time
              dateTime={postDateISO(page)}
              className="text-fd-muted-foreground"
            >
              {formatPostDate(page)}
            </time>
          </div>
        </div>
        {page.data.tags.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {page.data.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        ) : null}
      </div>
      {page.data.toc.length > 0 ? (
        <InlineTOC items={page.data.toc} className="mt-8" />
      ) : null}
      <div className="prose mt-8 min-w-0">
        <MDX components={getBlogMDXComponents()} />
      </div>
      <PostFooter title={page.data.title} />
    </main>
  );
}

export function generateStaticParams() {
  return blogSource.getPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) {
    notFound();
  }

  // The post's own card image when it declares one, the site-wide preview
  // (with its known dimensions) otherwise. The twitter block must be set
  // per-page: Next merges metadata shallowly, so without it the root
  // layout's twitter tags win and X shows the generic site card.
  const socialImages = page.data.image
    ? [{ url: page.data.image, alt: page.data.title }]
    : sharedOpenGraph.images;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      ...sharedOpenGraph,
      type: "article",
      publishedTime: postDate(page).toISOString(),
      authors: [page.data.author.name],
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: socialImages,
    },
  };
}
