import type { App } from "../../api/api_calls";
import type { FilterKey, FilterKeysResponse } from "../../api/filter_types";
import { buildConditionGroup, buildExprTree } from "./conditions";
import {
  isValidDateRange,
  pickDateRange,
  type UncheckedDateRange,
} from "./date_range_select";
import { formatFilterExpr, parseFilterExpr } from "./parse";
import { findUnusableConditions, validateLimits } from "./validate";

export type UrlFilters = {
  appId: string | null;
  dateRange: UncheckedDateRange;
  filterExpr: string | null;
  rootSpanName: string | null;
};

export type AppsQueryState = {
  status: "pending" | "error" | "success";
  data: App[] | undefined;
};

export type KeysQueryState = {
  isPending: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
  data: FilterKeysResponse | undefined;
};

export type SpanNamesQueryState = {
  isError: boolean;
  isSuccess: boolean;
  data: string[] | null | undefined;
};

export type RememberedFilters = {
  appId: string | undefined;
  dateRange: UncheckedDateRange;
};

export type FilterStatus =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export type ResolvedFilters = {
  app: App;
  filterExpr: string | null;
  rootSpanName: string | null;
};

export type FilterResolution = {
  status: FilterStatus;
  date: UncheckedDateRange;
  filters: ResolvedFilters | null;
  discarded: boolean;
};

const appsErrorMessage =
  "Error fetching apps, please refresh page to try again";
const noAppsMessage =
  "Looks like you don't have any apps yet. Get started by creating your first app!";
const keysErrorMessage =
  "Error fetching filters, please refresh page to try again";
const spanNamesErrorMessage =
  "Error fetching traces list, please refresh page or select a different app to try again";

export function resolveApp(
  urlAppId: string | null,
  apps: App[] | undefined,
  rememberedAppId: string | undefined,
): App | null {
  const loaded = apps ?? [];
  return (
    loaded.find((app) => app.id === urlAppId) ??
    loaded.find((app) => app.id === rememberedAppId) ??
    loaded[0] ??
    null
  );
}

function resolveFilterExpr(
  text: string | null,
  keys: FilterKey[],
): { filterExpr: string | null; discarded: boolean } {
  if (!text) {
    return { filterExpr: null, discarded: false };
  }
  const parsed = parseFilterExpr(text, { draft: true });
  if (!parsed.ok || findUnusableConditions(parsed.tokens, keys).length > 0) {
    return { filterExpr: null, discarded: true };
  }
  const conditions = buildConditionGroup(parsed.tree, keys);
  if (validateLimits(conditions) !== null) {
    return { filterExpr: null, discarded: true };
  }
  const tree = buildExprTree(conditions);
  return {
    filterExpr: tree ? formatFilterExpr(tree) : null,
    discarded: false,
  };
}

export function resolveFilters({
  url,
  apps,
  keys,
  spanNames,
  remembered,
}: {
  url: UrlFilters;
  apps: AppsQueryState;
  keys: KeysQueryState;
  spanNames: SpanNamesQueryState | null;
  remembered: RememberedFilters;
}): FilterResolution {
  const app = resolveApp(url.appId, apps.data, remembered.appId);
  const date = pickDateRange(url.dateRange, remembered.dateRange);

  const appDiscarded =
    url.appId !== null &&
    apps.status === "success" &&
    !(apps.data ?? []).some((loaded) => loaded.id === url.appId);
  const dateDiscarded =
    url.dateRange.dateRange !== null && !isValidDateRange(url.dateRange);

  // Placeholder keys are the previous app's and must not judge the filter.
  const keysSettled = !keys.isPending && !keys.isPlaceholderData;
  const filter =
    keysSettled && !keys.isError
      ? resolveFilterExpr(url.filterExpr, keys.data?.keys ?? [])
      : { filterExpr: null, discarded: false };

  const urlAppSelected = app !== null && url.appId === app.id;
  const names = spanNames?.isSuccess ? (spanNames.data ?? []) : null;
  const urlNameKnown =
    urlAppSelected &&
    url.rootSpanName !== null &&
    names !== null &&
    names.includes(url.rootSpanName);
  const rootSpanName =
    names === null || names.length === 0
      ? null
      : urlNameKnown
        ? url.rootSpanName
        : names[0];
  const rootSpanNameDiscarded =
    spanNames !== null &&
    spanNames.isSuccess &&
    urlAppSelected &&
    url.rootSpanName !== null &&
    !urlNameKnown;

  const discarded =
    appDiscarded || dateDiscarded || rootSpanNameDiscarded || filter.discarded;

  const resolution = (
    status: FilterStatus,
    filters: ResolvedFilters | null,
  ): FilterResolution => ({ status, date, filters, discarded });

  if (apps.status === "error") {
    return resolution({ kind: "error", message: appsErrorMessage }, null);
  }
  if (apps.status === "success" && (apps.data ?? []).length === 0) {
    return resolution({ kind: "error", message: noAppsMessage }, null);
  }
  if (app === null) {
    return resolution({ kind: "loading" }, null);
  }
  if (keys.isError) {
    return resolution(
      { kind: "error", message: keysErrorMessage },
      { app, filterExpr: null, rootSpanName },
    );
  }
  if (url.filterExpr !== null && !keysSettled) {
    return resolution({ kind: "loading" }, null);
  }

  const filters = { app, filterExpr: filter.filterExpr, rootSpanName };
  if (spanNames === null) {
    return resolution({ kind: "ready" }, filters);
  }
  if (spanNames.isError) {
    return resolution(
      { kind: "error", message: spanNamesErrorMessage },
      filters,
    );
  }
  if (!spanNames.isSuccess) {
    return resolution({ kind: "loading" }, filters);
  }
  return resolution({ kind: "ready" }, filters);
}
