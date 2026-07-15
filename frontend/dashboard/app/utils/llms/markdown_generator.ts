import {
  splitFrontmatter,
  stripFrontmatter,
} from "@/app/utils/llms/frontmatter";
import { source } from "@/app/utils/docs_source";
import { toStandaloneMarkdown } from "@/app/utils/llms/standalone_markdown";
import fs from "fs";
import path from "path";
import type * as PageTree from "fumadocs-core/page-tree";
import { parse as parseYaml } from "yaml";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";
const APP_DIR = path.join(process.cwd(), "app");

interface MarketingPage {
  slug: string;
  title: string;
  filePath: string;
}

/**
 * The frontmatter title of a marketing page.md twin. Docs pages don't
 * come through here; their titles come from the fumadocs source.
 */
function frontmatterTitle(markdown: string): string | null {
  const { frontmatter } = splitFrontmatter(markdown);
  if (frontmatter === null) {
    return null;
  }
  const data: unknown = parseYaml(frontmatter);
  if (data !== null && typeof data === "object" && "title" in data) {
    const { title } = data;
    if (typeof title === "string") {
      return title;
    }
  }
  return null;
}

/**
 * Walk app/ for route folders that have both page.tsx (a real route) and
 * page.md (a hand-authored markdown twin). The dual-file check is the
 * filter; no hardcoded skip list.
 */
export function walkPagesWithMd(): MarketingPage[] {
  const pages: MarketingPage[] = [];

  function walk(dir: string, prefix: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const hasPageMd = entries.some((e) => e.isFile() && e.name === "page.md");
    const hasPageTsx = entries.some((e) => e.isFile() && e.name === "page.tsx");

    if (hasPageMd && hasPageTsx) {
      const slug = prefix.length === 0 ? "/" : `/${prefix.join("/")}`;
      const filePath = path.join(dir, "page.md");
      const raw = fs.readFileSync(filePath, "utf-8");
      let title: string | null;
      try {
        title = frontmatterTitle(raw);
      } catch (error) {
        throw new Error(`Invalid frontmatter in ${filePath}`, {
          cause: error,
        });
      }
      pages.push({
        slug,
        title: title ?? prefix[prefix.length - 1] ?? "index",
        filePath,
      });
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      }
    }
  }

  walk(APP_DIR, []);
  // Homepage first, then alphabetical by slug
  return pages.sort((a, b) => {
    if (a.slug === "/") return -1;
    if (b.slug === "/") return 1;
    return a.slug.localeCompare(b.slug);
  });
}

function nodeName(node: { name?: React.ReactNode }): string {
  return typeof node.name === "string" ? node.name : String(node.name ?? "");
}

/**
 * Link label for a page node. Prefers the frontmatter title from the
 * source: tree names can be ReactNodes (the OpenAPI plugin wraps API page
 * names in a method badge element), which don't stringify.
 */
function pageLabel(
  node: { name?: React.ReactNode; url: string },
  titles: Map<string, string | undefined>,
): string {
  return titles.get(node.url) ?? nodeName(node);
}

/** Page links of a tree branch, flattening nested folders. */
function collectPageLinks(
  nodes: PageTree.Node[],
  titles: Map<string, string | undefined>,
): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "page") {
      lines.push(`- [${pageLabel(node, titles)}](${SITE_URL}${node.url})`);
    } else if (node.type === "folder") {
      if (node.index) {
        lines.push(
          `- [${pageLabel(node.index, titles)}](${SITE_URL}${node.index.url})`,
        );
      }
      lines.push(...collectPageLinks(node.children, titles));
    }
  }
  return lines;
}

/**
 * llms.txt: an H1 + blockquote description, one H2 section per sidebar
 * group, standalone pages under "## Docs", the marketing pages with
 * markdown twins under "## Pages", and an Optional section pointing at
 * llms-full.txt.
 */
export function generateLlmsTxt(): string {
  const tree = source.getPageTree();
  const titles = new Map(
    source.getPages().map((page) => [page.url, page.data.title]),
  );
  const lines: string[] = [];
  lines.push("# measure.sh");
  lines.push("");
  lines.push("> Open source tool to monitor mobile apps");
  lines.push("");

  const standalone: string[] = [];

  for (const node of tree.children) {
    if (node.type === "folder") {
      lines.push(`## ${nodeName(node)}`);
      lines.push("");
      if (node.index) {
        lines.push(
          `- [${pageLabel(node.index, titles)}](${SITE_URL}${node.index.url})`,
        );
      }
      lines.push(...collectPageLinks(node.children, titles));
      lines.push("");
    } else if (node.type === "page") {
      standalone.push(`- [${pageLabel(node, titles)}](${SITE_URL}${node.url})`);
    }
  }

  if (standalone.length > 0) {
    lines.push("## Docs");
    lines.push("");
    lines.push(...standalone);
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

/** Docs page urls in sidebar order. */
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

type DocsPage = ReturnType<typeof source.getPages>[number];

/**
 * One docs page as LLM-facing markdown: a Source header, the title and
 * description, then the processed markdown (MDX components resolved)
 * reworked to stand alone: absolute urls, no JSX comments. Serves as both
 * an llms-full.txt section and the per-page response of the /llms.mdx
 * route, so the two stay identical for a given page.
 */
export async function renderPageMarkdown(page: DocsPage): Promise<string> {
  const processed = await page.data.getText("processed");
  let text: string;
  try {
    text = toStandaloneMarkdown(processed, SITE_URL);
  } catch (error) {
    throw new Error(`Processed markdown of ${page.url} is not valid MDX`, {
      cause: error,
    });
  }

  // API reference pages render entirely through a JSX component, so their
  // processed markdown is empty once the generator banner comment is
  // dropped. The operation summary still exists in the page's structured
  // search data; serve that instead of a bare title.
  if (!text) {
    text = page.data.structuredData.contents
      .map((item) => item.content)
      .join("\n\n");
  }

  const header = `# ${page.data.title}\n\n${page.data.description ?? ""}`;
  return `---\nSource: ${SITE_URL}${page.url}\n---\n\n${header}\n\n${text}`;
}

/**
 * llms-full.txt: every docs page in sidebar order as processed markdown
 * (title, description, MDX-component placeholders resolved), then the
 * marketing page.md twins.
 */
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

  for (const p of walkPagesWithMd()) {
    const raw = fs.readFileSync(p.filePath, "utf-8");
    const cleaned = stripFrontmatter(raw);
    const sourceUrl = p.slug === "/" ? SITE_URL : `${SITE_URL}${p.slug}`;
    sections.push(`---\nSource: ${sourceUrl}\n---\n\n${cleaned}`);
  }

  return sections.join("\n\n");
}
