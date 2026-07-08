import rehypeCodeTabs from "@/app/docs/rehype_code_tabs";
import { describe, expect, it } from "@jest/globals";
import type {
  Element,
  ElementContent,
  Properties,
  Root,
  RootContent,
} from "hast";

function text(value: string): ElementContent {
  return { type: "text", value };
}

function el(
  tagName: string,
  children: ElementContent[],
  properties: Properties = {},
): Element {
  return { type: "element", tagName, properties, children };
}

function codeDetails(label: string, code: string, lang?: string): Element {
  return el("details", [
    text("\n"),
    el("summary", [text(label)]),
    text("\n"),
    el("pre", [
      el("code", [text(code)], lang ? { className: [`language-${lang}`] } : {}),
    ]),
    text("\n"),
  ]);
}

function proseDetails(label: string): Element {
  return el("details", [
    el("summary", [text(label)]),
    el("p", [text("Some prose.")]),
    el("pre", [el("code", [text("x")])]),
  ]);
}

function run(tree: Root): Root {
  rehypeCodeTabs()(tree);
  return tree;
}

function tags(children: RootContent[]): string[] {
  return children
    .filter((c): c is Element => c.type === "element")
    .map((c) => c.tagName);
}

describe("rehypeCodeTabs", () => {
  it("merges a run of single-fence details into one code-tabs element", () => {
    const tree: Root = {
      type: "root",
      children: [
        codeDetails("Android", "kotlin code\n", "kotlin"),
        text("\n"),
        codeDetails("iOS", "swift code", "swift"),
        text("\n"),
        codeDetails("Flutter", "dart code", "dart"),
      ],
    };
    run(tree);

    expect(tags(tree.children)).toEqual(["code-tabs"]);
    const tabs = JSON.parse(
      (tree.children[0] as Element).properties?.tabs as string,
    );
    expect(tabs).toEqual([
      { label: "Android", code: "kotlin code", className: "language-kotlin" },
      { label: "iOS", code: "swift code", className: "language-swift" },
      { label: "Flutter", code: "dart code", className: "language-dart" },
    ]);
  });

  it("leaves a single code details block as an accordion", () => {
    const tree: Root = {
      type: "root",
      children: [
        codeDetails("Using ObjC", "objc code", "objc"),
        el("p", [text("After")]),
      ],
    };
    run(tree);
    expect(tags(tree.children)).toEqual(["details", "p"]);
  });

  it("does not group details containing prose", () => {
    const tree: Root = {
      type: "root",
      children: [proseDetails("Android"), proseDetails("iOS")],
    };
    run(tree);
    expect(tags(tree.children)).toEqual(["details", "details"]);
  });

  it("a prose details block splits two runs", () => {
    const tree: Root = {
      type: "root",
      children: [
        codeDetails("Android", "a", "kotlin"),
        codeDetails("iOS", "b", "swift"),
        proseDetails("Minimum Requirements"),
        codeDetails("Flutter", "c", "dart"),
        codeDetails("React Native", "d", "typescript"),
      ],
    };
    run(tree);
    expect(tags(tree.children)).toEqual(["code-tabs", "details", "code-tabs"]);
  });

  it("keeps content after the run and recurses into wrappers", () => {
    const wrapper = el("div", [
      codeDetails("Android", "a", "kotlin") as ElementContent,
      codeDetails("iOS", "b", "swift") as ElementContent,
    ]);
    const tree: Root = {
      type: "root",
      children: [wrapper, el("p", [text("tail")])],
    };
    run(tree);
    expect(tags(tree.children)).toEqual(["div", "p"]);
    expect(tags(wrapper.children as RootContent[])).toEqual(["code-tabs"]);
  });
});
