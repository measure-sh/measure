import { getDocIndex } from "@/app/docs/docs";
import { sharedOpenGraph } from "@/app/utils/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import DocsNavLinks from "./components/docs_nav_links";
import DocsPageHeader from "./components/docs_page_header";
import DocsToc from "./components/docs_toc";
import { createMarkdownComponents } from "./components/md_components";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getDocIndex();
  if (!doc) {
    return {};
  }
  return {
    title: doc.title,
    ...(doc.description && { description: doc.description }),
    alternates: { canonical: "/docs" },
    openGraph: {
      ...sharedOpenGraph,
      title: doc.title,
      ...(doc.description && { description: doc.description }),
      url: "/docs",
    },
  };
}

export default function DocsIndexPage() {
  const doc = getDocIndex();

  if (!doc) {
    notFound();
  }

  return (
    <>
      <article className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[43.5rem]">
          <DocsPageHeader
            eyebrow={null}
            heading={doc.heading}
            description={doc.description}
          />
          <div className="mt-8 font-body text-gray-700 dark:text-gray-400 [&>:first-child]:mt-0 [&>h1+*]:mt-0 [&>h2+*]:mt-0 [&>h3+*]:mt-0 [&>h4+*]:mt-0 [&>hr+*]:mt-0">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={createMarkdownComponents([], true)}
            >
              {doc.content}
            </Markdown>
          </div>
          <DocsNavLinks currentSlug="/docs" />
        </div>
      </article>
      <DocsToc />
    </>
  );
}
