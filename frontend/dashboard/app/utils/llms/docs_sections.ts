import type { ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";

function nodeName(node: { name?: ReactNode }): string {
  return typeof node.name === "string" ? node.name : String(node.name ?? "");
}

/**
 * Link label for a page node. Prefers the frontmatter title from the
 * source: tree names can be ReactNodes (the OpenAPI plugin wraps API page
 * names in a method badge element), which don't stringify.
 */
function pageLabel(
  node: { name?: ReactNode; url: string },
  titles: Map<string, string | undefined>,
): string {
  return titles.get(node.url) ?? nodeName(node);
}

function pageLink(
  node: { name?: ReactNode; url: string },
  titles: Map<string, string | undefined>,
  siteUrl: string,
  depth: number,
): string {
  return `${"  ".repeat(depth)}- [${pageLabel(node, titles)}](${siteUrl}${node.url})`;
}

/**
 * Page links of a tree branch as a nested bullet list: a folder becomes a
 * bullet (its index link, or its plain name when it has no index page) with
 * its children indented one level below.
 */
function collectPageLinks(
  nodes: PageTree.Node[],
  titles: Map<string, string | undefined>,
  siteUrl: string,
  depth: number,
): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "page") {
      lines.push(pageLink(node, titles, siteUrl, depth));
    } else if (node.type === "folder") {
      if (node.index) {
        lines.push(pageLink(node.index, titles, siteUrl, depth));
      } else {
        lines.push(`${"  ".repeat(depth)}- ${nodeName(node)}`);
      }
      lines.push(
        ...collectPageLinks(node.children, titles, siteUrl, depth + 1),
      );
    }
  }
  return lines;
}

/**
 * The docs section of llms.txt, following the sidebar structure: a named
 * separator in content/docs/meta.json ("---Features---") opens an
 * "### <name>" subsection and the pages after it go inside, with folders
 * as nested bullet lists. A folder that is not inside a named
 * group (Getting Started, Self Hosting) becomes its own subsection. Loose
 * pages before the first subsection (the docs index) are listed directly;
 * loose pages after an unnamed "---" separator go under "### Other", since
 * without a heading they would read as part of the previous subsection.
 */
export function docsSectionLines(
  nodes: PageTree.Node[],
  titles: Map<string, string | undefined>,
  siteUrl: string,
): string[] {
  const lines: string[] = [];
  let groupName: string | null = null;
  let groupLines: string[] = [];
  let emittedSubsection = false;

  function flush() {
    if (groupLines.length === 0) {
      return;
    }
    const heading = groupName ?? (emittedSubsection ? "Other" : null);
    if (heading !== null) {
      lines.push(`### ${heading}`, "");
      emittedSubsection = true;
    }
    lines.push(...groupLines, "");
    groupLines = [];
  }

  for (const node of nodes) {
    if (node.type === "separator") {
      flush();
      const name = nodeName(node);
      groupName = name === "" ? null : name;
    } else if (node.type === "page") {
      groupLines.push(pageLink(node, titles, siteUrl, 0));
    } else if (node.type === "folder") {
      if (groupName !== null) {
        groupLines.push(...collectPageLinks([node], titles, siteUrl, 0));
      } else {
        // The folder itself is the subsection heading, so its index page
        // and children start at the top indent level rather than nesting
        // under a folder bullet.
        flush();
        lines.push(`### ${nodeName(node)}`, "");
        emittedSubsection = true;
        if (node.index) {
          lines.push(pageLink(node.index, titles, siteUrl, 0));
        }
        lines.push(...collectPageLinks(node.children, titles, siteUrl, 0), "");
      }
    }
  }
  flush();
  return lines;
}
