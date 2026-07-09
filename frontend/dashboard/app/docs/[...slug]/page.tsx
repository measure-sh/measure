import { getAllDocSlugs, getDocBySlug } from "@/app/docs/docs";
import { findSectionTitle } from "@/app/docs/docs_nav";
import rehypeCodeTabs from "@/app/docs/rehype_code_tabs";
import { sharedOpenGraph } from "@/app/utils/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import DocsNavLinks from "../components/docs_nav_links";
import DocsPageHeader from "../components/docs_page_header";
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

  const currentSlug = `/docs/${slug.join("/")}`;

  return (
    <>
      <article className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[43.5rem]">
          <DocsPageHeader
            eyebrow={findSectionTitle(currentSlug)}
            heading={doc.heading}
            description={doc.description}
          />
          {/* Anything directly after a heading or rule hugs it: the heading's
              bottom margin alone sets that gap, like prose's h2+* rules. */}
          <div className="mt-8 font-body [&>:first-child]:mt-0 [&>h1+*]:mt-0 [&>h2+*]:mt-0 [&>h3+*]:mt-0 [&>h4+*]:mt-0 [&>hr+*]:mt-0">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeCodeTabs, rehypeSlug]}
              components={createMarkdownComponents(slug, doc.isIndex)}
            >
              {doc.content}
            </Markdown>
          </div>
          <DocsNavLinks currentSlug={currentSlug} />
        </div>
      </article>
      <DocsToc />
    </>
  );
}
