import { getSortedBlogPosts } from "@/app/utils/blog_source";
import { docsSectionLines } from "@/app/utils/llms/docs_sections";
import { source } from "@/app/utils/docs_source";
import { walkPagesWithMd } from "@/app/utils/llms/marketing_pages";

// Jest cannot import this module: docs_source loads the compiled fumadocs
// content, which uses top-level await.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

export function generateLlmsTxt(): string {
  const tree = source.getPageTree();
  const titles = new Map(
    source.getPages().map((page) => [page.url, page.data.title]),
  );
  const lines: string[] = [];
  lines.push("# measure.sh");
  lines.push("");
  lines.push(
    "> Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and performance issues. The open source alternative to Firebase Crashlytics.",
  );
  lines.push("");

  lines.push("## Docs");
  lines.push("");
  lines.push(...docsSectionLines(tree.children, titles, SITE_URL));

  const posts = getSortedBlogPosts();
  if (posts.length > 0) {
    lines.push("## Blog");
    lines.push("");
    for (const post of posts) {
      lines.push(`- [${post.data.title}](${SITE_URL}${post.url})`);
    }
    lines.push("");
  }

  const pages = walkPagesWithMd();
  if (pages.length > 0) {
    lines.push("## Pages");
    lines.push("");
    for (const p of pages) {
      const url = p.slug === "/" ? SITE_URL : `${SITE_URL}${p.slug}`;
      lines.push(`- [${p.title}](${url})`);
    }
    lines.push("");
  }

  lines.push("## Optional");
  lines.push("");
  lines.push(
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): Complete documentation in a single file`,
  );
  lines.push("");

  return lines.join("\n");
}
