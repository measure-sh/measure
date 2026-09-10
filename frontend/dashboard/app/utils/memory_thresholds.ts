import type { ExprTree } from "../api/filter_types";
import { parseFilterExpr } from "../components/filter_bar/parse";

// Google Play Console's own "excessive memory usage" ceilings: the 90th
// percentile of Anon RSS + Swap an app is allowed to reach, by device RAM
// tier and process state (Foreground / User-perceived service / Background).
// Values are in MiB (matching the /1024 convention the rest of this feature
// already uses for KB→MB display).
// https://support.google.com/googleplay/android-developer/answer/17492799
//
// Cached has no published ceiling — the OS can evict it at will, so Play
// treats it as debug-only. The 0-4gb and 16gb+ tiers fall outside Play's
// published table (which starts at 4gb and stops at 16gb) and also have no
// ceiling here; don't extrapolate one.
export const PLAY_MEMORY_THRESHOLDS_MB: Record<
  string,
  Partial<
    Record<"foreground" | "user_perceived_service" | "background", number>
  >
> = {
  "4gb": { foreground: 2048, user_perceived_service: 1024, background: 1024 },
  "6gb": { foreground: 2304, user_perceived_service: 1280, background: 1280 },
  "8gb": { foreground: 2304, user_perceived_service: 1536, background: 1536 },
  "12gb": {
    foreground: 3328,
    user_perceived_service: 1792,
    background: 1792,
  },
  "16gb": {
    foreground: 4352,
    user_perceived_service: 2048,
    background: 2048,
  },
};

// Matches memory_sessions_table.tsx's ramTierLabel() display strings.
export const RAM_TIER_DISPLAY_LABEL: Record<string, string> = {
  "0-4gb": "0–4 GB",
  "4gb": "4 GB",
  "6gb": "6 GB",
  "8gb": "8 GB",
  "12gb": "12 GB",
  "16gb": "16 GB",
  "16gb+": "16 GB+",
};

function collectConditionsForKey(
  tree: ExprTree,
  keyName: string,
  results: ExprTree["condition"][],
) {
  if (tree.condition && tree.condition.key_name === keyName) {
    results.push(tree.condition);
  }
  tree.children?.forEach((child) =>
    collectConditionsForKey(child, keyName, results),
  );
}

// Reads the *already-committed* filter expression (value.filterExpr from
// useExprFilterPage, not draft text) for a single `session_ram_tier in
// [<tier>]` clause. Returns null on anything ambiguous — no clause, more
// than one clause (e.g. inside an OR), not_in, or more than one value — since
// guessing a tier to show a threshold against would be misleading.
export function singleSelectedRamTier(
  filterExpr: string | null,
): string | null {
  if (!filterExpr) return null;

  const outcome = parseFilterExpr(filterExpr, { draft: true });
  if (!outcome.ok) return null;

  const conditions: ExprTree["condition"][] = [];
  collectConditionsForKey(outcome.tree, "session_ram_tier", conditions);

  if (conditions.length !== 1) return null;
  const condition = conditions[0];
  if (!condition || condition.operator !== "in") return null;
  if (!condition.values || condition.values.length !== 1) return null;

  return condition.values[0].text;
}

export type MemoryProcessState =
  | "foreground"
  | "user_perceived_service"
  | "background";

export function isThresholdableProcessState(
  scope: string,
): scope is MemoryProcessState {
  return (
    scope === "foreground" ||
    scope === "user_perceived_service" ||
    scope === "background"
  );
}
