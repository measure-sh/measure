import type { Journey, JourneyNode } from "@/app/api/api_calls";
import {
  extendSelection,
  highlightOf,
  sameLink,
  selectionKey,
} from "@/app/components/journey/highlight";
import { describe, expect, it } from "@jest/globals";

function node(id: string, step: number): JourneyNode {
  return {
    id,
    name: id,
    kind: "screen",
    step,
    users: 100,
    continuing: 100,
    median_ms_from_previous: null,
  };
}

// Home leads to List, List to Detail and Detail back to List. Settings is
// reached only from Home. Some sessions crash on List.
const journey: Journey = {
  sample_percent: 100,
  nodes: [
    node("Home", 0),
    node("List", 1),
    node("Settings", 1),
    node("Detail", 2),
    { ...node("Fatal error", 3), kind: "fatal" },
  ],
  links: [
    { source: "Home", target: "List", users: 50 },
    { source: "Home", target: "Settings", users: 10 },
    { source: "List", target: "Detail", users: 40 },
    { source: "Detail", target: "List", users: 20 },
    { source: "List", target: "Fatal error", users: 5 },
  ],
};

const litNodes = (selection: Parameters<typeof highlightOf>[1]) => {
  const highlight = highlightOf(journey, selection);
  return journey.nodes.map((n) => n.id).filter(highlight.isLitNode);
};

const litLinks = (selection: Parameters<typeof highlightOf>[1]) => {
  const highlight = highlightOf(journey, selection);
  return journey.links
    .filter(highlight.isLitLink)
    .map((l) => `${l.source}>${l.target}`);
};

describe("highlightOf", () => {
  it("lights nothing without a selection", () => {
    expect(highlightOf(journey, null).active).toBe(false);
    expect(litNodes(null)).toEqual([]);
    expect(litLinks(null)).toEqual([]);
  });

  it("lights a selected node, its links in and out and the nodes at their other ends", () => {
    const selection = { node: "List" };

    expect(highlightOf(journey, selection).active).toBe(true);
    expect(litNodes(selection)).toEqual([
      "Home",
      "List",
      "Detail",
      "Fatal error",
    ]);
    expect(litLinks(selection)).toEqual([
      "Home>List",
      "List>Detail",
      "Detail>List",
      "List>Fatal error",
    ]);
  });

  it("lights only the direct neighbours of a selected node", () => {
    expect(litNodes({ node: "Settings" })).toEqual(["Home", "Settings"]);
    expect(litLinks({ node: "Settings" })).toEqual(["Home>Settings"]);
  });

  it("lights a selected link, its two nodes and the links out of its target", () => {
    const selection = { source: "Home", target: "List" };

    expect(highlightOf(journey, selection).active).toBe(true);
    expect(litNodes(selection)).toEqual([
      "Home",
      "List",
      "Detail",
      "Fatal error",
    ]);
    expect(litLinks(selection)).toEqual([
      "Home>List",
      "List>Detail",
      "List>Fatal error",
    ]);
  });

  it("lights a path's nodes and links and the links out of its last node", () => {
    const selection = { path: ["Home", "List", "Detail"] };
    const highlight = highlightOf(journey, selection);

    expect(highlight.active).toBe(true);
    expect(litNodes(selection)).toEqual(["Home", "List", "Detail"]);
    expect(litLinks(selection)).toEqual([
      "Home>List",
      "List>Detail",
      "Detail>List",
    ]);
    expect(highlight.isSelectedNode("Detail")).toBe(true);
    expect(highlight.isSelectedNode("Settings")).toBe(false);
    expect(highlight.isSelectedLink({ source: "Home", target: "List" })).toBe(
      true,
    );
    expect(highlight.isSelectedLink({ source: "Detail", target: "List" })).toBe(
      false,
    );
  });

  it("marks the nodes the links out of the last node of the selection lead to as next", () => {
    const next = (selection: Parameters<typeof highlightOf>[1]) => {
      const highlight = highlightOf(journey, selection);
      return journey.nodes.map((n) => n.id).filter(highlight.isNextNode);
    };

    expect(next(null)).toEqual([]);
    expect(next({ node: "Home" })).toEqual(["List", "Settings"]);
    expect(next({ node: "Settings" })).toEqual([]);
    expect(next({ source: "List", target: "Detail" })).toEqual(["List"]);
    expect(next({ path: ["Home", "List"] })).toEqual(["Detail", "Fatal error"]);
  });

  it("selects only the selected node, link or path", () => {
    const node = highlightOf(journey, { node: "List" });
    expect(node.isSelectedNode("List")).toBe(true);
    expect(node.isSelectedNode("Home")).toBe(false);
    expect(node.isSelectedLink({ source: "Home", target: "List" })).toBe(false);

    const link = highlightOf(journey, { source: "Home", target: "List" });
    expect(link.isSelectedNode("Home")).toBe(false);
    expect(link.isSelectedLink({ source: "Home", target: "List" })).toBe(true);
    expect(link.isSelectedLink({ source: "List", target: "Detail" })).toBe(
      false,
    );
  });
});

describe("extendSelection", () => {
  const extend = (
    selection: Parameters<typeof extendSelection>[1],
    id: string,
  ) =>
    extendSelection(
      journey,
      selection,
      journey.nodes.find((n) => n.id === id)!,
    );

  it("selects the node when nothing is selected", () => {
    expect(extend(null, "List")).toEqual({ node: "List" });
  });

  it("starts a path from a selected node or link along a link out of its last node", () => {
    expect(extend({ node: "Home" }, "List")).toEqual({
      path: ["Home", "List"],
    });
    expect(extend({ source: "Home", target: "List" }, "Detail")).toEqual({
      path: ["Home", "List", "Detail"],
    });
  });

  it("adds a linked node to the end of a path, also when the path has it already", () => {
    expect(extend({ path: ["Home", "List", "Detail"] }, "List")).toEqual({
      path: ["Home", "List", "Detail", "List"],
    });
  });

  it("leaves the selection as it is for a node without a link from the last node", () => {
    const node = { node: "Home" };
    const path = { path: ["Home", "List"] };

    expect(extend(node, "Detail")).toBe(node);
    expect(extend(path, "Home")).toBe(path);
    expect(extend(path, "Settings")).toBe(path);
  });

  it("removes the last node of the selection when it is shift-clicked again", () => {
    expect(extend({ path: ["Home", "List", "Detail"] }, "Detail")).toEqual({
      path: ["Home", "List"],
    });
    expect(extend({ path: ["Home", "List"] }, "List")).toEqual({
      node: "Home",
    });
    expect(extend({ source: "Home", target: "List" }, "List")).toEqual({
      node: "Home",
    });
    expect(extend({ node: "Home" }, "Home")).toBeNull();
  });

  it("goes on to the fatal error node but not past it, since no links leave it", () => {
    const toFatal = extend({ path: ["Home", "List"] }, "Fatal error");
    expect(toFatal).toEqual({ path: ["Home", "List", "Fatal error"] });
    expect(extend(toFatal, "Detail")).toBe(toFatal);
  });
});

describe("selectionKey", () => {
  it("keeps a link and a path over the same nodes apart", () => {
    const keys = [
      { node: "Home" },
      { source: "Home", target: "List" },
      { path: ["Home", "List"] },
    ].map(selectionKey);

    expect(new Set(keys).size).toBe(3);
  });
});

describe("sameLink", () => {
  it("matches links by source and target, in that direction", () => {
    const link = { source: "List", target: "Detail" };

    expect(sameLink(link, { source: "List", target: "Detail" })).toBe(true);
    expect(sameLink(link, { source: "Detail", target: "List" })).toBe(false);
  });
});
