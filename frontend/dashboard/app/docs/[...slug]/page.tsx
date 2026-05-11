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
  params: { slug: string[] };
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const doc = getDocBySlug(params.slug);

  if (!doc) {
    return {};
  }

  const path = `/docs/${params.slug.join("/")}`;

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

export default function DocPage({ params }: PageProps) {
  const doc = getDocBySlug(params.slug);

  if (!doc) {
    notFound();
  }

  const tocEntries = extractTocEntries(doc.content);

  return (
    <>
      <article className="min-w-0 flex-1">
        <div className="prose-custom">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug]}
            components={createMarkdownComponents(params.slug, doc.isIndex)}
          >
            {doc.content}
          </Markdown>
        </div>
        <DocsNavLinks currentSlug={`/docs/${params.slug.join("/")}`} />
      </article>
      <DocsToc entries={tocEntries} />
    </>
  );
}
