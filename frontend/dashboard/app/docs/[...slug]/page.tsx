import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { notFound } from "next/navigation";
import { getDocBySlug, getAllDocSlugs, extractTocEntries } from "@/app/docs/docs";
import { createMarkdownComponents } from "../components/md_components";
import DocsToc from "../components/docs_toc";
import DocsNavLinks from "../components/docs_nav_links";
import type { Metadata } from "next";

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

  return {
    title: doc.title,
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
            rehypePlugins={[rehypeSlug]}
            components={createMarkdownComponents(params.slug)}
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
