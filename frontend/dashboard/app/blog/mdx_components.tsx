import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { TrackedCodeBlock } from "./components/tracked_code_block";

/**
 * Component map for blog post bodies. The fumadocs defaults cover
 * headings, links, images, tables, Callout and code blocks. The docs map
 * is not reused because its code blocks and cards emit docs analytics
 * events; pre shadows the default code block to emit the blog ones.
 */
export function getBlogMDXComponents(
  components?: MDXComponents,
): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: (props) => <TrackedCodeBlock {...props} />,
    ...components,
  };
}
