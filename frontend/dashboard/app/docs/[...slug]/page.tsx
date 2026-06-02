import {
  extractTocEntries,
  getAllDocSlugs,
  getDocBySlug,
} from "@/app/docs/docs";
import { sharedOpenGraph } from "@/app/utils/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import DocsNavLinks from "../components/docs_nav_links";
import DocsToc from "../components/docs_toc";
import { createMarkdownComponents } from "../components/md_components";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    return {};
  }

  const path = `/docs/${slug.join("/")}`;

  return {
    title: doc.title,
    ...(doc.description && { description: doc.description }),
    alternates: { canonical: path },
    openGraph: {
      ...sharedOpenGraph,
      title: doc.title,
      ...(doc.description && { description: doc.description }),
      url: path,
    },
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const tocEntries = extractTocEntries(doc.content);

  return (
    <>
      <article className="min-w-0 flex-1">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSlug]}
          components={createMarkdownComponents(slug, doc.isIndex)}
        >
          {doc.content}
        </Markdown>
        <DocsNavLinks currentSlug={`/docs/${slug.join("/")}`} />
      </article>
      <DocsToc entries={tocEntries} />
    </>
  );
}
