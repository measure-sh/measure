import type { Journey, JourneyNode } from "@/app/api/api_calls";

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 44;
const COLUMN_PITCH = NODE_WIDTH + 112;
const ROW_PITCH = NODE_HEIGHT + 28;
const PADDING = 48;
const MAX_COLUMNS = 6;
const ORDERING_PASSES = 4;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

type Box = { node: JourneyNode; column: number; x: number; y: number };

type Layout = { boxes: Map<string, Box>; width: number; height: number };

// A pan and zoom: the graph's origin moves to (x, y) and the graph scales by k.
export type View = { x: number; y: number; k: number };

type Point = [number, number];

// The layout puts the nodes in columns from left to right by their step.
// One column for each step makes a long, flat graph when sessions have many
// steps. Thus, while there are more than MAX_COLUMNS columns, the layout
// merges the two adjacent columns with the fewest nodes in total. This keeps
// busy steps in their own columns.
// In a column, each pass moves each node towards the average row of the
// nodes it links to, weighted by users. This keeps most links short and
// reduces crossings.
// The fatal error node ends sessions, so it goes in the last column.
export function layOut(journey: Journey): Layout {
  const stepOf = (n: JourneyNode) => (n.kind === "fatal" ? Infinity : n.step);
  const ordered = [...journey.nodes].sort(
    (a, b) => stepOf(a) - stepOf(b) || b.users - a.users,
  );
  const columns = [...new Set(ordered.map(stepOf))].map((step) =>
    ordered.filter((n) => stepOf(n) === step),
  );
  while (columns.length > MAX_COLUMNS) {
    const pairSize = (c: number) => columns[c].length + columns[c + 1].length;
    let merge = 0;
    for (let c = 1; c < columns.length - 1; c++) {
      if (pairSize(c) < pairSize(merge)) {
        merge = c;
      }
    }
    columns.splice(merge, 2, [...columns[merge], ...columns[merge + 1]]);
  }
  const columnOf = new Map(
    columns.flatMap((nodes, c) => nodes.map((n) => [n.id, c] as const)),
  );

  const rowOf = new Map<string, number>();
  const placeRows = () =>
    columns.forEach((nodes) => nodes.forEach((n, r) => rowOf.set(n.id, r)));
  placeRows();

  const reorder = (column: number, towards: (c: number) => boolean) => {
    const pull = new Map<string, { sum: number; weight: number }>();
    for (const link of journey.links) {
      for (const [self, other] of [
        [link.source, link.target],
        [link.target, link.source],
      ]) {
        if (
          columnOf.get(self) !== column ||
          !towards(columnOf.get(other) ?? column)
        ) {
          continue;
        }
        const p = pull.get(self) ?? { sum: 0, weight: 0 };
        p.sum += (rowOf.get(other) ?? 0) * link.users;
        p.weight += link.users;
        pull.set(self, p);
      }
    }
    const position = (n: JourneyNode) => {
      const p = pull.get(n.id);
      return p && p.weight > 0 ? p.sum / p.weight : (rowOf.get(n.id) ?? 0);
    };
    columns[column].sort((a, b) => position(a) - position(b));
    placeRows();
  };
  for (let pass = 0; pass < ORDERING_PASSES; pass++) {
    for (let c = 1; c < columns.length; c++) {
      reorder(c, (other) => other < c);
    }
    for (let c = columns.length - 2; c >= 0; c--) {
      reorder(c, (other) => other > c);
    }
  }

  const tallest = Math.max(0, ...columns.map((nodes) => nodes.length));
  const boxes = new Map<string, Box>();
  columns.forEach((nodes, c) => {
    const offset = ((tallest - nodes.length) * ROW_PITCH) / 2;
    nodes.forEach((node, r) =>
      boxes.set(node.id, {
        node,
        column: c,
        x: c * COLUMN_PITCH,
        y: offset + r * ROW_PITCH,
      }),
    );
  });

  // Links that bow out past the nodes count towards the size, so the graph
  // gets the same padding on every side once it's fitted to the container.
  // A link's curve stays inside the box around its control points.
  const points: Point[] = [...boxes.values()].flatMap((b): Point[] => [
    [b.x, b.y],
    [b.x + NODE_WIDTH, b.y + NODE_HEIGHT],
  ]);
  for (const link of journey.links) {
    const source = boxes.get(link.source);
    const target = boxes.get(link.target);
    if (source && target) {
      points.push(...linkCurve(source, target));
    }
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(0, ...xs);
  const minY = Math.min(0, ...ys);
  for (const box of boxes.values()) {
    box.x += PADDING - minX;
    box.y += PADDING - minY;
  }
  return {
    boxes,
    width: Math.max(0, ...xs) - minX + PADDING * 2,
    height: Math.max(0, ...ys) - minY + PADDING * 2,
  };
}

// The start, the two control points and the end of a link's cubic curve.
// Forward links run from the right edge of the source to the left edge of the
// target. Links back to an earlier column run from the left edge of the source
// to the right edge of the target and bow downwards, and links within one
// column bow out to the right, so they don't run on top of forward links.
function linkCurve(source: Box, target: Box): Point[] {
  const sy = source.y + NODE_HEIGHT / 2;
  const ty = target.y + NODE_HEIGHT / 2;
  if (target.column > source.column) {
    const sx = source.x + NODE_WIDTH;
    const tx = target.x;
    const mid = (sx + tx) / 2;
    return [
      [sx, sy],
      [mid, sy],
      [mid, ty],
      [tx, ty],
    ];
  }
  if (target.column < source.column) {
    const sx = source.x;
    const tx = target.x + NODE_WIDTH;
    const bow = 40 + (sx - tx) * 0.15;
    return [
      [sx, sy],
      [sx - 60, sy + bow],
      [tx + 60, ty + bow],
      [tx, ty],
    ];
  }
  const x = source.x + NODE_WIDTH;
  const bow = 60 + Math.abs(ty - sy) * 0.3;
  return [
    [x, sy],
    [x + bow, sy],
    [x + bow, ty],
    [x, ty],
  ];
}

export function linkPath(source: Box, target: Box): string {
  const [start, c1, c2, end] = linkCurve(source, target);
  return `M${start} C${c1} ${c2} ${end}`;
}

// Fits the whole graph in the container, clear of `top` and `bottom`, centred
// and without enlarging it.
export function fit(
  layout: Layout,
  width: number,
  height: number,
  { top, bottom }: { top: number; bottom: number },
): View {
  const available = Math.max(0, height - top - bottom);
  const k = Math.min(
    1,
    Math.max(
      MIN_ZOOM,
      Math.min(width / layout.width, available / layout.height),
    ),
  );
  return {
    x: (width - layout.width * k) / 2,
    y: top + (available - layout.height * k) / 2,
    k,
  };
}

// Zooms by `factor` around the point (px, py) of the container, so that point
// stays where it is.
export function zoomAround(
  view: View,
  px: number,
  py: number,
  factor: number,
): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  return {
    k,
    x: px - ((px - view.x) * k) / view.k,
    y: py - ((py - view.y) * k) / view.k,
  };
}
