import { extractTocEntries, getDocIndex } from "@/app/docs/docs";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import DocsNavLinks from "./components/docs_nav_links";
import DocsToc from "./components/docs_toc";
import { createMarkdownComponents } from "./components/md_components";

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
