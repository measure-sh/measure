import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { getDocIndex, extractTocEntries } from "@/app/docs/docs";
import { createMarkdownComponents } from "./components/md_components";
import DocsToc from "./components/docs_toc";
import DocsNavLinks from "./components/docs_nav_links";
import { notFound } from "next/navigation";

export default function DocsIndexPage() {
  const doc = getDocIndex();

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
            components={createMarkdownComponents([])}
          >
            {doc.content}
          </Markdown>
        </div>
        <DocsNavLinks currentSlug="/docs" />
      </article>
      <DocsToc entries={tocEntries} />
    </>
  );
}
