import type { Journey, JourneyNode } from "@/app/api/api_calls";
import {
  fit,
  layOut,
  linkPath,
  NODE_HEIGHT,
  NODE_WIDTH,
  zoomAround,
} from "@/app/components/journey/graph_layout";
import { describe, expect, it } from "@jest/globals";

function node(
  id: string,
  step: number,
  kind: JourneyNode["kind"] = "screen",
  users = 100,
): JourneyNode {
  return {
    id,
    name: id,
    kind,
    step,
    users,
    continuing: users,
    median_ms_from_previous: null,
  };
}

function link(source: string, target: string, users = 10) {
  return { source, target, users };
}

const boxOf = (journey: Journey, id: string) => layOut(journey).boxes.get(id)!;

describe("layOut", () => {
  it("places nodes left to right by the step users first reach them at", () => {
    const journey: Journey = {
      sample_percent: 100,
      nodes: [node("Home", 0), node("List", 1), node("Detail", 2)],
      links: [link("Home", "List"), link("List", "Detail")],
    };
    const layout = layOut(journey);

    const xs = ["Home", "List", "Detail"].map((id) => layout.boxes.get(id)!.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it("stacks nodes of one step in one column without overlapping", () => {
    const journey: Journey = {
      sample_percent: 100,
      nodes: [node("Home", 0), node("Search", 1), node("List", 1)],
      links: [link("Home", "Search"), link("Home", "List")],
    };
    const layout = layOut(journey);
    const search = layout.boxes.get("Search")!;
    const list = layout.boxes.get("List")!;

    expect(search.column).toBe(list.column);
    expect(search.x).toBe(list.x);
    expect(Math.abs(search.y - list.y)).toBeGreaterThanOrEqual(NODE_HEIGHT);
  });

  it("gives each step its own column when there are no more steps than columns", () => {
    const children = Array.from({ length: 10 }, (_, i) => node(`C${i}`, 1));
    const layout = layOut({
      sample_percent: 100,
      nodes: [node("Home", 0), ...children, node("Detail", 2)],
      links: children.map((c) => link("Home", c.id)),
    });

    expect(layout.boxes.get("Home")!.column).toBe(0);
    for (const child of children) {
      expect(layout.boxes.get(child.id)!.column).toBe(1);
    }
    expect(layout.boxes.get("Detail")!.column).toBe(2);
  });

  it("uses at most six columns however many steps there are", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => node(`S${i}`, i));
    const links = nodes.slice(1).map((n, i) => link(nodes[i].id, n.id));
    const layout = layOut({ sample_percent: 100, nodes, links });

    const columns = new Set([...layout.boxes.values()].map((b) => b.column));
    expect(columns.size).toBe(6);
  });

  it("keeps a step with few nodes out of a busy next step's column when steps share columns", () => {
    const busy = Array.from({ length: 20 }, (_, i) => node(`B${i}`, 1));
    const rest = Array.from({ length: 6 }, (_, i) => node(`S${i}`, i + 2));
    const layout = layOut({
      sample_percent: 100,
      nodes: [node("Home", 0), ...busy, ...rest],
      links: [],
    });

    expect(layout.boxes.get("Home")!.column).toBe(0);
    expect(layout.boxes.get("B0")!.column).toBe(1);
    const columns = new Set([...layout.boxes.values()].map((b) => b.column));
    expect(columns.size).toBe(6);
  });

  it("puts the fatal error node in the last column", () => {
    const journey: Journey = {
      sample_percent: 100,
      nodes: [
        node("Fatal error", 1, "fatal"),
        node("Home", 0),
        node("List", 1),
        node("Detail", 2),
      ],
      links: [
        link("Home", "List"),
        link("List", "Detail"),
        link("Home", "Fatal error"),
      ],
    };
    const layout = layOut(journey);
    const lastColumn = Math.max(
      ...[...layout.boxes.values()].map((b) => b.column),
    );

    expect(layout.boxes.get("Fatal error")!.column).toBe(lastColumn);
    expect(layout.boxes.get("Detail")!.column).toBeLessThan(lastColumn);
  });

  it("keeps padding around the nodes and the links that bow out past them", () => {
    const journey: Journey = {
      sample_percent: 100,
      nodes: [node("Home", 0), node("List", 1), node("Detail", 2)],
      links: [
        link("Home", "List"),
        link("List", "Detail"),
        link("Detail", "Home"),
      ],
    };
    const layout = layOut(journey);

    for (const box of layout.boxes.values()) {
      expect(box.x).toBeGreaterThan(0);
      expect(box.y).toBeGreaterThan(0);
      expect(box.x + NODE_WIDTH).toBeLessThan(layout.width);
      expect(box.y + NODE_HEIGHT).toBeLessThan(layout.height);
    }
    const detail = layout.boxes.get("Detail")!;
    const home = layout.boxes.get("Home")!;
    const numbers = linkPath(detail, home)
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      expect(numbers[i]).toBeGreaterThanOrEqual(0);
      expect(numbers[i]).toBeLessThanOrEqual(layout.width);
      expect(numbers[i + 1]).toBeGreaterThanOrEqual(0);
      expect(numbers[i + 1]).toBeLessThanOrEqual(layout.height);
    }
  });

  it("lays out an empty journey with no boxes", () => {
    const layout = layOut({ sample_percent: 100, nodes: [], links: [] });

    expect(layout.boxes.size).toBe(0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("linkPath", () => {
  const journey: Journey = {
    sample_percent: 100,
    nodes: [
      node("Home", 0),
      node("Login", 0),
      node("List", 1),
      node("Search", 1),
    ],
    links: [link("Home", "List"), link("List", "Search")],
  };

  it("runs a forward link from the source's right edge to the target's left edge", () => {
    const home = boxOf(journey, "Home");
    const list = boxOf(journey, "List");

    expect(linkPath(home, list)).toMatch(
      new RegExp(
        `^M${home.x + NODE_WIDTH},${home.y + NODE_HEIGHT / 2} C.* ${list.x},${list.y + NODE_HEIGHT / 2}$`,
      ),
    );
  });

  it("runs a backward link from the source's left edge to the target's right edge", () => {
    const home = boxOf(journey, "Home");
    const list = boxOf(journey, "List");

    expect(linkPath(list, home)).toMatch(
      new RegExp(
        `^M${list.x},${list.y + NODE_HEIGHT / 2} C.* ${home.x + NODE_WIDTH},${home.y + NODE_HEIGHT / 2}$`,
      ),
    );
  });

  it("bows a link within one column out to the right", () => {
    const list = boxOf(journey, "List");
    const search = boxOf(journey, "Search");
    const [, c1x] = linkPath(list, search)
      .match(/C(-?[\d.]+),/)!
      .map(Number);

    expect(linkPath(list, search)).toMatch(
      new RegExp(`^M${list.x + NODE_WIDTH},`),
    );
    expect(c1x).toBeGreaterThan(list.x + NODE_WIDTH);
  });
});

describe("fit", () => {
  const layout = layOut({
    sample_percent: 100,
    nodes: [node("Home", 0), node("List", 1)],
    links: [link("Home", "List")],
  });
  const inset = { top: 50, bottom: 30 };

  it("centres the graph at full size when the container has room", () => {
    const view = fit(layout, layout.width + 200, layout.height + 280, inset);

    expect(view.k).toBe(1);
    expect(view.x).toBe(100);
    expect(view.y).toBe(inset.top + 100);
  });

  it("shrinks the graph to fit between the top and bottom insets", () => {
    const height = layout.height / 2 + inset.top + inset.bottom;
    const view = fit(layout, layout.width * 4, height, inset);

    expect(view.k).toBeCloseTo(0.5);
    expect(view.y).toBeCloseTo(inset.top);
  });

  it("stops shrinking at the minimum zoom", () => {
    expect(fit(layout, 1, 1, inset).k).toBe(0.2);
  });
});

describe("zoomAround", () => {
  it("keeps the point it zooms around in place", () => {
    const view = { x: 10, y: 20, k: 1 };
    const next = zoomAround(view, 100, 80, 2);
    const graphPoint = {
      x: (100 - view.x) / view.k,
      y: (80 - view.y) / view.k,
    };

    expect(next.k).toBe(2);
    expect(next.x + graphPoint.x * next.k).toBeCloseTo(100);
    expect(next.y + graphPoint.y * next.k).toBeCloseTo(80);
  });

  it("clamps the zoom between the minimum and maximum", () => {
    expect(zoomAround({ x: 0, y: 0, k: 2 }, 0, 0, 10).k).toBe(3);
    expect(zoomAround({ x: 0, y: 0, k: 0.5 }, 0, 0, 0.01).k).toBe(0.2);
  });
});
