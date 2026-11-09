import type { Journey, JourneyNode } from "@/app/api/api_calls";
import {
  selectableNodes,
  showNodes,
} from "@/app/components/journey/node_picker";
import { describe, expect, it } from "@jest/globals";

function node(
  id: string,
  users: number,
  kind: JourneyNode["kind"] = "screen",
): JourneyNode {
  return {
    id,
    name: id,
    kind,
    step: 0,
    users,
    continuing: 0,
    median_ms_from_previous: null,
  };
}

const journey: Journey = {
  sample_percent: 100,
  nodes: [
    node("Home", 10),
    node("Cart", 30),
    node("checkout", 20, "event"),
    node("fatal", 5, "fatal"),
  ],
  links: [
    { source: "Home", target: "Cart", users: 8 },
    { source: "Cart", target: "checkout", users: 6 },
    { source: "checkout", target: "fatal", users: 2 },
  ],
};

describe("selectableNodes", () => {
  it("gives the screens and custom events, the most users first", () => {
    expect(selectableNodes(journey).map((n) => n.id)).toEqual([
      "Cart",
      "checkout",
      "Home",
    ]);
  });
});

describe("showNodes", () => {
  it("keeps the shown nodes and the links between them", () => {
    const shown = showNodes(journey, ["Home", "Cart"]);

    expect(shown.nodes.map((n) => n.id)).toEqual(["Home", "Cart"]);
    expect(shown.links).toEqual([{ source: "Home", target: "Cart", users: 8 }]);
  });

  it("shows the fatal error node when a shown node links to it", () => {
    const shown = showNodes(journey, ["checkout"]);

    expect(shown.nodes.map((n) => n.id)).toEqual(["checkout", "fatal"]);
    expect(shown.links).toEqual([
      { source: "checkout", target: "fatal", users: 2 },
    ]);
  });

  it("keeps the 200 links with the most users and every link to the fatal error node", () => {
    const nodes = Array.from({ length: 30 }, (_, i) => node(`S${i}`, 1));
    const links = nodes.flatMap((source, i) =>
      nodes
        .filter((_, j) => j !== i)
        .map((target) => ({ source: source.id, target: target.id, users: i })),
    );
    links.push({ source: "S0", target: "fatal", users: 0 });
    const shown = showNodes(
      {
        sample_percent: 100,
        nodes: [...nodes, node("fatal", 1, "fatal")],
        links,
      },
      nodes.map((n) => n.id),
    );

    expect(shown.links).toHaveLength(201);
    expect(shown.links.filter((l) => l.target === "fatal")).toHaveLength(1);
    expect(Math.min(...shown.links.map((l) => l.users))).toBe(0);
    expect(
      shown.links
        .filter((l) => l.target !== "fatal")
        .every((l) => l.users >= 22),
    ).toBe(true);
  });
});
