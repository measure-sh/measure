import { DateTime } from "luxon";

export interface Checkpoint {
  name: string;
  timestamp: string;
}

export interface PreparedCheckpoint extends Checkpoint {
  startMs: number;
}

export interface Span {
  span_name: string;
  span_id: string;
  parent_id: string;
  status: number;
  start_time: string;
  end_time: string;
  duration: number;
  thread_name: string;
  user_defined_attributes?: Record<string, unknown> | null;
  checkpoints: Checkpoint[] | null;
}

export interface Trace {
  app_id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  app_version: string;
  os_version: string;
  device_model: string;
  device_manufacturer: string;
  network_type: string;
  spans: Span[];
}

export interface PreparedSpan extends Omit<Span, "checkpoints"> {
  depth: number;
  ancestorIds: string[];
  ancestorColors: ThreadColor[];
  directChildCount: number;
  subtreeSize: number;
  // The id whose hash determines this span's colour. Root and depth-1
  // spans hash on themselves (so every subtree gets a unique colour);
  // anything deeper inherits the depth-1 ancestor's id, so a whole
  // subtree reads in one colour.
  colorKey: string;
  startMs: number;
  endMs: number;
  checkpoints: PreparedCheckpoint[] | null;
}

export type ChartColorName =
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "pink"
  | "teal"
  | "red"
  | "yellow";

export interface ThreadColor {
  name: ChartColorName;
  bg: string;
  border: string;
}

const THREAD_COLORS: ThreadColor[] = [
  { name: "green", bg: "bg-chart-green", border: "border-chart-green" },
  { name: "violet", bg: "bg-chart-violet", border: "border-chart-violet" },
  { name: "amber", bg: "bg-chart-amber", border: "border-chart-amber" },
  { name: "pink", bg: "bg-chart-pink", border: "border-chart-pink" },
  { name: "blue", bg: "bg-chart-blue", border: "border-chart-blue" },
  { name: "yellow", bg: "bg-chart-yellow", border: "border-chart-yellow" },
  { name: "teal", bg: "bg-chart-teal", border: "border-chart-teal" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const ERROR_PALETTE: ThreadColor = {
  name: "red",
  bg: "bg-chart-red",
  border: "border-chart-red",
};

export function getSpanColor(spanName: string): ThreadColor {
  return THREAD_COLORS[hashString(spanName || "") % THREAD_COLORS.length];
}

export function resolveSpanColor(
  span: Pick<PreparedSpan, "status" | "colorKey">,
  showErrorAsRed: boolean,
): ThreadColor {
  if (span.status === 2 && showErrorAsRed) {
    return ERROR_PALETTE;
  }
  return getSpanColor(span.colorKey);
}

export function statusLabel(status: number): "Unset" | "Okay" | "Error" {
  if (status === 1) {
    return "Okay";
  }
  if (status === 2) {
    return "Error";
  }
  return "Unset";
}

export interface PreparedTrace {
  spans: PreparedSpan[];
  byId: Map<string, PreparedSpan>;
  errorSpanIds: string[];
}

export function prepareTrace(trace: Trace): PreparedTrace {
  const traceStart = DateTime.fromISO(trace.start_time).toMillis();
  const byId = new Map<string, PreparedSpan>();

  const rawByParent = new Map<string, Span[]>();
  for (const span of trace.spans) {
    if (span.parent_id) {
      const arr = rawByParent.get(span.parent_id);
      if (arr) {
        arr.push(span);
      } else {
        rawByParent.set(span.parent_id, [span]);
      }
    }
  }
  const startMs = (s: Span) => DateTime.fromISO(s.start_time).toMillis();
  for (const arr of rawByParent.values()) {
    arr.sort((a, b) => startMs(a) - startMs(b));
  }

  const roots = trace.spans
    .filter((s) => !s.parent_id)
    .sort((a, b) => startMs(a) - startMs(b));

  const ordered: PreparedSpan[] = [];

  function visit(
    span: Span,
    depth: number,
    ancestorIds: string[],
    ancestorColors: ThreadColor[],
  ): number {
    const children = rawByParent.get(span.span_id) ?? [];
    const colorKey =
      depth <= 1 ? span.span_id : (ancestorIds[1] ?? span.span_id);
    const checkpoints: PreparedCheckpoint[] | null =
      span.checkpoints?.map((cp) => ({
        ...cp,
        startMs: DateTime.fromISO(cp.timestamp).toMillis() - traceStart,
      })) ?? null;
    const prepared: PreparedSpan = {
      ...span,
      checkpoints,
      depth,
      ancestorIds,
      ancestorColors,
      directChildCount: children.length,
      subtreeSize: 0,
      colorKey,
      startMs: startMs(span) - traceStart,
      endMs: DateTime.fromISO(span.end_time).toMillis() - traceStart,
    };
    byId.set(span.span_id, prepared);
    ordered.push(prepared);
    const childAncestors = [...ancestorIds, span.span_id];
    const childAncestorColors = [...ancestorColors, getSpanColor(colorKey)];
    let subtree = 0;
    for (const child of children) {
      subtree +=
        1 + visit(child, depth + 1, childAncestors, childAncestorColors);
    }
    prepared.subtreeSize = subtree;
    return subtree;
  }

  for (const root of roots) {
    visit(root, 0, [], []);
  }

  const errorSpanIds = ordered
    .filter((s) => s.status === 2)
    .map((s) => s.span_id);

  return { spans: ordered, byId, errorSpanIds };
}

export function matchesSearch(span: PreparedSpan, query: string): boolean {
  if (!query) {
    return false;
  }
  const q = query.toLowerCase();
  if (span.span_name.toLowerCase().includes(q)) {
    return true;
  }
  if (span.thread_name.toLowerCase().includes(q)) {
    return true;
  }
  const attrs = span.user_defined_attributes;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.toLowerCase().includes(q)) {
        return true;
      }
      if (v != null && String(v).toLowerCase().includes(q)) {
        return true;
      }
    }
  }
  if (span.checkpoints) {
    for (const cp of span.checkpoints) {
      if (cp.name.toLowerCase().includes(q)) {
        return true;
      }
    }
  }
  return false;
}
