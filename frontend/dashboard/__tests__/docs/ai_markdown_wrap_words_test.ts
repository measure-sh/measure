/**
 * Pins the whitespace guard in the AI chat's rehypeWrapWords: the fade-in
 * effect wraps text in <span> word wrappers, and without the guard the
 * whitespace-only text nodes between a table's structural elements become
 * spans in positions HTML forbids (a <span> directly inside <table>),
 * which React rejects at hydration.
 */
import { describe, expect, it } from "@jest/globals";
import type { Element, Root } from "hast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";

import { rehypeWrapWords } from "@/app/docs/components/ai/markdown";

async function toHast(markdown: string): Promise<Root> {
  const processor = remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeWrapWords);
  return (await processor.run(processor.parse({ value: markdown }))) as Root;
}

/** Tag names of element children found directly under the given tags. */
function childTagsUnder(tree: Root, parents: Set<string>): string[] {
  const found: string[] = [];
  function walk(node: Root | Element, parentTag: string | null) {
    for (const child of node.children ?? []) {
      if (child.type !== "element") {
        continue;
      }
      if (parentTag !== null && parents.has(parentTag)) {
        found.push(child.tagName);
      }
      walk(child, child.tagName);
    }
  }
  walk(tree, null);
  return found;
}

describe("rehypeWrapWords", () => {
  it("puts no spans inside table structure", async () => {
    const tree = await toHast("| a | b |\n| - | - |\n| 1 | 2 |");

    const structural = new Set(["table", "thead", "tbody", "tr"]);
    const children = childTagsUnder(tree, structural);

    expect(children.length).toBeGreaterThan(0);
    expect(children).not.toContain("span");
  });

  it("still wraps visible text in fade-in spans", async () => {
    const tree = await toHast("Hello world");

    let spans = 0;
    const countSpans = (node: Root | Element) => {
      for (const child of node.children ?? []) {
        if (child.type === "element") {
          if (
            child.tagName === "span" &&
            String(child.properties?.class ?? "").includes("animate-fd-fade-in")
          ) {
            spans += 1;
          }
          countSpans(child);
        }
      }
    };
    countSpans(tree);

    expect(spans).toBeGreaterThan(1);
  });

  it("wraps text inside table cells", async () => {
    const tree = await toHast("| alpha | beta |\n| - | - |\n| one | two |");

    let cellSpans = 0;
    const walk = (node: Root | Element, inCell: boolean) => {
      for (const child of node.children ?? []) {
        if (child.type !== "element") {
          continue;
        }
        if (child.tagName === "span" && inCell) {
          cellSpans += 1;
        }
        walk(child, inCell || child.tagName === "td" || child.tagName === "th");
      }
    };
    walk(tree, false);

    expect(cellSpans).toBeGreaterThan(0);
  });
});
