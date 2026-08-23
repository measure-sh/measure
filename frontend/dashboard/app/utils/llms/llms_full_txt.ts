import { getSortedBlogPosts } from "@/app/utils/blog_source";
import { source } from "@/app/utils/docs_source";
import { stripFrontmatter } from "@/app/utils/frontmatter";
import { walkPagesWithMd } from "@/app/utils/llms/marketing_pages";
import { renderPageMarkdown } from "@/app/utils/llms/page_markdown";
import fs from "fs";
import type * as PageTree from "fumadocs-core/page-tree";

// Jest cannot import this module: docs_source loads the compiled fumadocs
// content, which uses top-level await.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

function collectPageUrls(nodes: PageTree.Node[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.type === "page") {
      urls.push(node.url);
    } else if (node.type === "folder") {
      if (node.index) {
        urls.push(node.index.url);
      }
      urls.push(...collectPageUrls(node.children));
    }
  }
  return urls;
}

export async function generateLlmsFullTxt(): Promise<string> {
  const tree = source.getPageTree();
  const urls = ["/docs", ...collectPageUrls(tree.children)];
  const byUrl = new Map(source.getPages().map((page) => [page.url, page]));
  const seen = new Set<string>();
  const sections: string[] = [];

  for (const url of urls) {
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    const page = byUrl.get(url);
    if (!page) {
      continue;
    }
    sections.push(await renderPageMarkdown(page));
  }

  for (const post of getSortedBlogPosts()) {
    sections.push(await renderPageMarkdown(post));
  }

  for (const p of walkPagesWithMd()) {
    const raw = fs.readFileSync(p.filePath, "utf-8");
    const cleaned = stripFrontmatter(raw);
    const sourceUrl = p.slug === "/" ? SITE_URL : `${SITE_URL}${p.slug}`;
    sections.push(`---\nSource: ${sourceUrl}\n---\n\n${cleaned}`);
  }

  return sections.join("\n\n");
}
