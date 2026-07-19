"use client";

import {
  CodeBlock,
  type CodeBlockProps,
  Pre,
} from "fumadocs-ui/components/codeblock";
import { usePathname } from "next/navigation";
import { track } from "@/app/utils/analytics/track";
import { deriveBlogSection } from "./blog_tracking";

/**
 * The blog pre mapping: fumadocs' CodeBlock wrapping Pre, in the same
 * shape as the fumadocs default, plus an analytics event when the copy
 * control is clicked. The copy button offers no callback, but it is the
 * only button CodeBlock renders inside its figure, so a delegated click
 * on the figure that lands within a button is a copy.
 *
 * __tests__/blog/tracked_code_block_test.tsx pins these assumptions about
 * the CodeBlock internals and fails if a fumadocs upgrade breaks them.
 */
export function TrackedCodeBlock({ onClick, ...props }: CodeBlockProps) {
  const blogSection = deriveBlogSection(usePathname());
  return (
    <CodeBlock
      {...props}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          track("blog_action_click", {
            action: "copy_code",
            blog_section: blogSection,
          });
        }
        onClick?.(event);
      }}
    >
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}
