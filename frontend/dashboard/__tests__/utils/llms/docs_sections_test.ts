import { docsSectionLines } from "@/app/utils/llms/docs_sections";
import type * as PageTree from "fumadocs-core/page-tree";

const SITE = "https://measure.sh";

function page(name: string, url: string): PageTree.Node {
  return { type: "page", name, url };
}

function folder(
  name: string,
  index: { name: string; url: string } | undefined,
  children: PageTree.Node[],
): PageTree.Node {
  return {
    type: "folder",
    name,
    index: index ? { type: "page", ...index } : undefined,
    children,
  };
}

function separator(name?: string): PageTree.Node {
  return { type: "separator", name };
}

// The shape of content/docs/meta.json in miniature: an index page and a
// folder before any separator, named separator groups holding loose pages
// and folders (one nested two levels deep, like the API reference), then
// an unnamed "---" separator followed by a loose page and a folder.
const tree: PageTree.Node[] = [
  page("Measure", "/docs"),
  folder("Getting Started", undefined, [
    page("Android", "/docs/getting-started/android"),
  ]),
  separator("Features"),
  page("Session Replay", "/docs/session-replay"),
  folder(
    "Error Monitoring",
    { name: "Error Monitoring", url: "/docs/error-monitoring" },
    [page("Grouping", "/docs/error-monitoring/grouping")],
  ),
  separator("AI"),
  page("Agent", "/docs/agent"),
  separator("Reference"),
  folder("REST API", { name: "Overview", url: "/docs/api" }, [
    folder("SDK", undefined, [
      page("Upload builds", "/docs/api/sdk/builds/putBuilds"),
    ]),
  ]),
  separator(),
  page("Integrations", "/docs/integrations"),
  folder("Self Hosting", { name: "Self Host", url: "/docs/hosting" }, [
    page("Slack", "/docs/hosting/slack"),
  ]),
];

describe("docsSectionLines", () => {
  const lines = docsSectionLines(tree, new Map(), SITE);

  it("mirrors the sidebar structure", () => {
    expect(lines).toEqual([
      "- [Measure](https://measure.sh/docs)",
      "",
      "### Getting Started",
      "",
      "- [Android](https://measure.sh/docs/getting-started/android)",
      "",
      "### Features",
      "",
      "- [Session Replay](https://measure.sh/docs/session-replay)",
      "- [Error Monitoring](https://measure.sh/docs/error-monitoring)",
      "  - [Grouping](https://measure.sh/docs/error-monitoring/grouping)",
      "",
      "### AI",
      "",
      "- [Agent](https://measure.sh/docs/agent)",
      "",
      "### Reference",
      "",
      "- [Overview](https://measure.sh/docs/api)",
      "  - SDK",
      "    - [Upload builds](https://measure.sh/docs/api/sdk/builds/putBuilds)",
      "",
      "### Other",
      "",
      "- [Integrations](https://measure.sh/docs/integrations)",
      "",
      "### Self Hosting",
      "",
      "- [Self Host](https://measure.sh/docs/hosting)",
      "- [Slack](https://measure.sh/docs/hosting/slack)",
      "",
    ]);
  });

  it("prefers frontmatter titles over tree names", () => {
    const titles = new Map([["/docs/agent", "Measure Agent"]]);
    const withTitles = docsSectionLines(tree, titles, SITE);
    expect(withTitles).toContain(
      "- [Measure Agent](https://measure.sh/docs/agent)",
    );
  });

  it("drops the heading of a group with no pages", () => {
    const empty = docsSectionLines(
      [separator("Features"), separator("AI"), page("Agent", "/docs/agent")],
      new Map(),
      SITE,
    );
    expect(empty).toEqual([
      "### AI",
      "",
      "- [Agent](https://measure.sh/docs/agent)",
      "",
    ]);
  });
});
