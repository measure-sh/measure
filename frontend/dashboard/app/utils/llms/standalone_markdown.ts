import type { Root } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";

// Fumadocs' processed markdown is GFM plus MDX syntax: component tags
// such as <Callout> and {...} expressions. A parser without the same
// grammar breaks those constructs in the re-serialize step.
const processor = remark().use(remarkGfm).use(remarkMdx);

/** A JSX comment expression renders nothing, so the output can drop it. */
function isJsxComment(node: { type: string; value?: string }): boolean {
  if (node.type !== "mdxFlowExpression" && node.type !== "mdxTextExpression") {
    return false;
  }
  const value = (node.value ?? "").trim();
  return value.startsWith("/*") && value.endsWith("*/");
}

/** A "//host" url is protocol-relative and external, not root-relative. */
function isRootRelative(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/**
 * The output is read outside the site. Root-relative urls therefore
 * become absolute on siteUrl, and JSX comments (such as the Fumadocs
 * banner on API reference pages) are removed. The transform walks the
 * syntax tree, so url-like text in code blocks and inline code does not
 * change.
 *
 * Throws when the text does not parse as MDX. The llms routes are static,
 * so an invalid page fails the build.
 */
export function toStandaloneMarkdown(
  markdown: string,
  siteUrl: string,
): string {
  const tree = processor.parse(markdown) as Root;

  visit(tree, (node, index, parent) => {
    if (parent && typeof index === "number" && isJsxComment(node)) {
      parent.children.splice(index, 1);
      // After the splice, this index holds the next sibling. Return the
      // index so the visitor does not skip that node.
      return index;
    }
    if (
      (node.type === "link" ||
        node.type === "image" ||
        node.type === "definition") &&
      isRootRelative(node.url)
    ) {
      node.url = `${siteUrl}${node.url}`;
    }
  });

  return processor.stringify(tree).trim();
}
