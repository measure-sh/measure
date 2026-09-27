import type { JourneyMap, JourneyMapScreen } from "@/app/api/api_calls";

export const cardWidth = 176;
const cardPadding = 8;
export const thumbWidth = cardWidth - 2 * cardPadding;
export const cardHeaderHeight = 40;

const gapX = 140;
const gapY = 40;
const wrappedColumnGapX = 28;
const maxRowsPerColumn = 4;
const maxThumbAspect = 2.3;
const defaultThumbAspect = 2;

type NodePlacement = { x: number; y: number; layer: number };

export type EdgePlacement = {
  from: string;
  to: string;
  // Cubic bezier: start, first control, second control, end.
  points: [number, number, number, number, number, number, number, number];
  labelX: number;
  labelY: number;
  strokeWidth: number;
  label: string;
};

export type MapLayout = {
  width: number;
  height: number;
  cardHeight: number;
  thumbHeight: number;
  nodes: Record<string, NodePlacement>;
  edges: EdgePlacement[];
};

// Every thumbnail shares the tallest snapshot's aspect ratio, capped so a
// long scrolling screen does not stretch the map.
function thumbHeightFor(screens: JourneyMapScreen[]): number {
  let aspect = 0;
  for (const s of screens) {
    const wireframe = s.variants[0]?.wireframe;
    if (wireframe && wireframe.width > 0) {
      aspect = Math.max(aspect, wireframe.height / wireframe.width);
    }
  }
  return Math.round(
    thumbWidth * Math.min(aspect || defaultThumbAspect, maxThumbAspect),
  );
}

// Screens where a session starts at least 5% as often as on the most common
// start screen. A few sessions start elsewhere, for example when the app is
// relaunched into a dialog, and those screens are not where users enter.
export function entryScreens(screens: JourneyMapScreen[]): Set<string> {
  const topEntries = Math.max(0, ...screens.map((s) => s.entries));
  return new Set(
    screens
      .filter((s) => s.entries >= Math.max(1, topEntries * 0.05))
      .map((s) => s.key),
  );
}

// Assigns each screen a layer: entry screens are layer 0, and every other
// screen sits one layer after the first screen that leads to it. Screens in a
// layer are then ordered to keep edges short.
function layers(map: JourneyMap) {
  const screens = Object.fromEntries(map.screens.map((s) => [s.key, s]));
  const keys = map.screens
    .map((s) => s.key)
    .sort((a, b) => {
      const sa = screens[a];
      const sb = screens[b];
      if (sa.entries !== sb.entries) return sb.entries - sa.entries;
      if (sa.visits !== sb.visits) return sb.visits - sa.visits;
      return a < b ? -1 : a > b ? 1 : 0;
    });

  const outEdges: Record<string, [string, number][]> = {};
  const inEdges: Record<string, [string, number][]> = {};
  for (const key of keys) {
    outEdges[key] = [];
    inEdges[key] = [];
  }
  for (const t of map.transitions) {
    outEdges[t.from]?.push([t.to, t.count]);
    inEdges[t.to]?.push([t.from, t.count]);
  }

  const layer: Record<string, number> = {};
  const entries = entryScreens(map.screens);
  let roots = keys.filter((k) => entries.has(k));
  if (roots.length === 0) {
    roots = keys.slice(0, 1);
  }
  let frontier = [...roots];
  for (const k of roots) {
    layer[k] = 0;
  }
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const k of frontier) {
      const edges = [...outEdges[k]].sort((a, b) => b[1] - a[1]);
      for (const [b] of edges) {
        if (layer[b] === undefined) {
          layer[b] = layer[k] + 1;
          next.push(b);
        }
      }
    }
    frontier = next;
  }
  const depth = Math.max(0, ...Object.values(layer));
  for (const k of keys) {
    if (layer[k] === undefined) {
      layer[k] = depth + 1;
    }
  }

  const columns: Record<number, string[]> = {};
  for (const k of keys) {
    (columns[layer[k]] ??= []).push(k);
  }
  const order: Record<string, number> = {};
  for (const column of Object.values(columns)) {
    column.forEach((k, i) => (order[k] = i));
  }

  // Barycenter ordering: each screen moves towards the average position of
  // the screens it connects to in other layers, weighted by traffic.
  const sweep = (cols: number[], edges: Record<string, [string, number][]>) => {
    for (const col of cols) {
      const scored = columns[col].map((k) => {
        const neighbours = edges[k].filter(([n]) => layer[n] !== layer[k]);
        const total = neighbours.reduce((sum, [, w]) => sum + w, 0);
        const barycenter = total
          ? neighbours.reduce((sum, [n, w]) => sum + order[n] * w, 0) / total
          : order[k];
        return { barycenter, previous: order[k], key: k };
      });
      scored.sort(
        (a, b) =>
          a.barycenter - b.barycenter ||
          a.previous - b.previous ||
          (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
      );
      columns[col] = scored.map((s) => s.key);
      columns[col].forEach((k, i) => (order[k] = i));
    }
  };
  const cols = Object.keys(columns)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 0; i < 4; i++) {
    sweep(cols.slice(1), inEdges);
    sweep([...cols.slice(0, -1)].reverse(), outEdges);
  }

  return { layer, columns, cols };
}

function bezierAt(p: EdgePlacement["points"], t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * p[0] +
      3 * u * u * t * p[2] +
      3 * u * t * t * p[4] +
      t * t * t * p[6],
    u * u * u * p[1] +
      3 * u * u * t * p[3] +
      3 * u * t * t * p[5] +
      t * t * t * p[7],
  ];
}

// Places each layer left to right. A layer with many screens wraps into
// adjacent columns so the map stays roughly landscape.
export function layoutJourneyMap(map: JourneyMap): MapLayout {
  const thumbHeight = thumbHeightFor(map.screens);
  const cardHeight = cardHeaderHeight + thumbHeight + cardPadding;
  const { columns, cols } = layers(map);

  const nodes: Record<string, NodePlacement> = {};
  const rows = Math.max(
    1,
    ...cols.map((c) => Math.min(columns[c].length, maxRowsPerColumn)),
  );
  const tallest = rows * (cardHeight + gapY) - gapY;
  let x = 0;
  for (const col of cols) {
    const keys = columns[col];
    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += maxRowsPerColumn) {
      chunks.push(keys.slice(i, i + maxRowsPerColumn));
    }
    chunks.forEach((chunk, index) => {
      const height = chunk.length * (cardHeight + gapY) - gapY;
      const y0 = (tallest - height) / 2;
      chunk.forEach((k, i) => {
        nodes[k] = { x, y: y0 + i * (cardHeight + gapY), layer: col };
      });
      x += cardWidth + (index < chunks.length - 1 ? wrappedColumnGapX : gapX);
    });
  }

  const edges: EdgePlacement[] = [];
  for (const t of map.transitions) {
    const a = nodes[t.from];
    const b = nodes[t.to];
    if (!a || !b) continue;
    const middle = cardHeight / 2;
    let points: EdgePlacement["points"];
    const forward = b.layer > a.layer;
    if (forward) {
      const x1 = a.x + cardWidth;
      const y1 = a.y + middle;
      const x2 = b.x;
      const y2 = b.y + middle;
      const dx = Math.max(40, (x2 - x1) / 2);
      points = [x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2];
    } else if (b.layer === a.layer) {
      const x1 = a.x + cardWidth;
      const y1 = a.y + middle + 12;
      const x2 = b.x + cardWidth;
      const y2 = b.y + middle - 12;
      points = [x1, y1, x1 + 60, y1, x2 + 60, y2, x2, y2];
    } else {
      const x1 = a.x;
      const y1 = a.y + middle + 12;
      const x2 = b.x + cardWidth;
      const y2 = b.y + middle - 12;
      const dx = Math.max(40, (x1 - x2) / 2);
      points = [x1, y1, x1 - dx, y1 + 40, x2 + dx, y2 + 40, x2, y2];
    }
    const [labelX, labelY] = bezierAt(points, 0.5);
    const trigger = t.triggers[0]?.label;
    edges.push({
      from: t.from,
      to: t.to,
      points,
      labelX,
      labelY,
      strokeWidth: 1 + Math.min(4, Math.sqrt(t.count)),
      label: trigger ? `${trigger} ×${t.count}` : `×${t.count}`,
    });
  }

  const placed = Object.values(nodes);
  return {
    width: Math.max(0, ...placed.map((p) => p.x)) + cardWidth,
    height: Math.max(0, ...placed.map((p) => p.y)) + cardHeight,
    cardHeight,
    thumbHeight,
    nodes,
    edges,
  };
}
