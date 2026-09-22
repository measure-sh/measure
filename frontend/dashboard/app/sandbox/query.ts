import { DateTime } from "luxon";
import { PlotTimeGroup } from "../utils/time_utils";

export type SandboxRouteContext = {
  params: Record<string, string>;
  url: URL;
  body: unknown;
};

export type SandboxRoute = {
  method: string;
  path: string;
  handle: (ctx: SandboxRouteContext) => Response | Promise<Response>;
};

export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export type SandboxRange = {
  from: DateTime;
  to: DateTime;
  group: PlotTimeGroup;
  timezone: string;
};

export function parseRange(url: URL): SandboxRange {
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const timezone = url.searchParams.get("timezone") ?? "UTC";
  const to = (toParam ? DateTime.fromISO(toParam) : DateTime.now()).setZone(
    timezone,
  );
  const from = (
    fromParam ? DateTime.fromISO(fromParam) : to.minus({ days: 7 })
  ).setZone(timezone);
  const group = (url.searchParams.get("plot_time_group") ??
    "days") as PlotTimeGroup;
  return { from, to, group, timezone };
}

// The backend formats a bucket as a zone-less local string, and the charts
// parse only these two patterns.
export function formatBucket(bucket: DateTime, group: PlotTimeGroup): string {
  if (group === "days" || group === "months") {
    return bucket.toFormat("yyyy-MM-dd");
  }
  return bucket.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}

export function bucketsForRange(range: SandboxRange): DateTime[] {
  const unit =
    range.group === "minutes"
      ? "minute"
      : range.group === "hours"
        ? "hour"
        : range.group === "months"
          ? "month"
          : "day";
  const buckets: DateTime[] = [];
  let cursor = range.from.startOf(unit);
  const end = range.to.startOf(unit);
  while (cursor <= end && buckets.length < 2000) {
    buckets.push(cursor);
    cursor = cursor.plus({ [unit]: 1 });
  }
  return buckets;
}

export function isWithinRange(iso: string, range: SandboxRange): boolean {
  const t = DateTime.fromISO(iso);
  return t >= range.from && t <= range.to;
}

export function noise(seed: number): number {
  const hash = Math.sin(seed * 9301 + 49297) * 233280;
  const jitter = hash - Math.floor(hash) - 0.5;
  const value =
    0.5 +
    0.22 * Math.sin(seed * 0.11) +
    0.15 * Math.sin(seed * 0.037 + 1.3) +
    0.08 * Math.sin(seed * 0.0071 + 2.1) +
    0.1 * jitter;
  return Math.min(Math.max(value, 0), 0.999);
}

export function scaledCount(
  base: number,
  group: PlotTimeGroup,
  seed: number,
): number {
  const perBucket =
    group === "hours"
      ? base / 24
      : group === "minutes"
        ? base / 1440
        : group === "months"
          ? base * 30
          : base;
  return Math.round(perBucket * (0.7 + noise(seed) * 0.6));
}

export function paginate<T>(
  items: T[],
  url: URL,
): { items: T[]; hasNext: boolean; hasPrev: boolean } {
  const limit = Number(url.searchParams.get("limit") ?? items.length);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const page = items.slice(offset, offset + limit);
  return {
    items: page,
    hasNext: offset + limit < items.length,
    hasPrev: offset > 0,
  };
}

function seedState(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

function nextState(state: number): number {
  let x = state;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function stableHex(seed: string, length: number): string {
  let state = seedState(seed);
  let out = "";
  while (out.length < length) {
    state = nextState(state);
    out += state.toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export function stableUuid(seed: string): string {
  const hex = stableHex(seed, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    (((parseInt(hex[16], 16) & 0x3) | 0x8) as number).toString(16) +
      hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function unitInterval(seed: string): number {
  return parseInt(stableHex(seed, 8), 16) / 0xffffffff;
}

export function randomStream(seed: string): () => number {
  let state = seedState(seed);
  return () => {
    state = nextState(state);
    return state / 0x100000000;
  };
}

export function stableInt(seed: string, min: number, max: number): number {
  return Math.floor(min + unitInterval(seed) * (max - min + 1));
}

export function weightedPick<T extends { weight: number }>(
  items: T[],
  seed: string,
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const fraction = parseInt(stableHex(seed, 8), 16) / 0xffffffff;
  let threshold = fraction * total;
  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}
