import type { ElementContent, Root, RootContent } from "hast";

// Docs markdown expresses per-platform code variants as sibling
// <details><summary>Android</summary> ```kotlin ...``` </details> blocks so
// they stay readable on GitHub. On the site, a run of those renders as one
// tabbed code block instead of a stack of accordions each framing a code
// block. This plugin replaces each run of MIN_RUN+ consecutive details
// blocks that hold exactly one fenced code block (and nothing else) with a
// <code-tabs> element carrying the tab data; md_components maps that tag to
// the CodeTabs component. Details blocks with prose or several fences are
// real accordions and stay untouched.
const MIN_RUN = 2;

interface CodeTab {
  label: string;
  code: string;
  className: string;
}

function isWhitespace(node: RootContent | ElementContent): boolean {
  return node.type === "text" && node.value.trim() === "";
}

function textOf(node: RootContent | ElementContent): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "element") {
    return node.children.map(textOf).join("");
  }
  return "";
}

// A details element groupable into tabs: children are exactly a <summary>
// and a <pre><code> block.
function asCodeTab(node: RootContent | ElementContent): CodeTab | null {
  if (node.type !== "element" || node.tagName !== "details") {
    return null;
  }
  const kids = node.children.filter((child) => !isWhitespace(child));
  if (kids.length !== 2) {
    return null;
  }
  const [summary, pre] = kids;
  if (summary.type !== "element" || summary.tagName !== "summary") {
    return null;
  }
  if (pre.type !== "element" || pre.tagName !== "pre") {
    return null;
  }
  const preKids = pre.children.filter((child) => !isWhitespace(child));
  const code = preKids[0];
  if (
    preKids.length !== 1 ||
    code.type !== "element" ||
    code.tagName !== "code"
  ) {
    return null;
  }
  const className = Array.isArray(code.properties?.className)
    ? code.properties.className.join(" ")
    : "";
  const label = textOf(summary).trim();
  if (label === "") {
    return null;
  }
  return { label, code: textOf(code).replace(/\n$/, ""), className };
}

function transformChildren(
  children: (RootContent | ElementContent)[],
): (RootContent | ElementContent)[] {
  const out: (RootContent | ElementContent)[] = [];
  let i = 0;

  while (i < children.length) {
    const run: CodeTab[] = [];
    let j = i;
    // Collect a run of groupable details, allowing whitespace text between
    // them. `j` only advances past whitespace that precedes another match,
    // so trailing whitespace after the run is kept.
    while (j < children.length) {
      let k = j;
      while (k < children.length && isWhitespace(children[k])) {
        k++;
      }
      if (k >= children.length) {
        break;
      }
      const tab = asCodeTab(children[k]);
      if (tab === null) {
        break;
      }
      run.push(tab);
      j = k + 1;
    }

    if (run.length >= MIN_RUN) {
      out.push({
        type: "element",
        tagName: "code-tabs",
        properties: { tabs: JSON.stringify(run) },
        children: [],
      });
      i = j;
      continue;
    }

    const node = children[i];
    if (node.type === "element") {
      node.children = transformChildren(node.children) as ElementContent[];
    }
    out.push(node);
    i++;
  }

  return out;
}

export default function rehypeCodeTabs() {
  return (tree: Root) => {
    tree.children = transformChildren(tree.children) as RootContent[];
  };
}
