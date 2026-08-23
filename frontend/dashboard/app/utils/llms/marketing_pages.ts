import { splitFrontmatter } from "@/app/utils/frontmatter";
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

const APP_DIR = path.join(process.cwd(), "app");

export interface MarketingPage {
  slug: string;
  title: string;
  filePath: string;
}

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
 * A route folder is a marketing page when it has both page.tsx and
 * page.md. This pair is the only filter. There is no skip list.
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
  return pages.sort((a, b) => {
    if (a.slug === "/") return -1;
    if (b.slug === "/") return 1;
    return a.slug.localeCompare(b.slug);
  });
}
