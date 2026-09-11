"use client";

import type { App } from "@/app/api/api_calls";
import type { FilterKey } from "@/app/api/filter_types";
import {
  DateRange,
  toDateSelection,
  type UncheckedDateRange,
} from "@/app/components/filter_bar/date_range_select";
import type {
  FilterChange,
  FilterSelection,
} from "@/app/components/filter_bar/filter_bar";
import {
  customKeyNamesIn,
  parseFilterExpr,
} from "@/app/components/filter_bar/parse";
import {
  resolveApp,
  resolveFilters,
  type FilterStatus,
} from "@/app/components/filter_bar/resolve_filters";
import { toastNegative } from "@/app/components/toast";
import {
  type FilterParams,
  paginationOffsetUrlKey,
  useAppsQuery,
  useFilterKeysQuery,
  useRootSpanNamesQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import { useFiltersStore } from "@/app/stores/provider";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

export type { FilterStatus };

export const filterExprUrlKey = "filter_expr";

const {
  appId: appIdUrlKey,
  dateRange: dateRangeUrlKey,
  startDate: startDateUrlKey,
  endDate: endDateUrlKey,
  rootSpanName: rootSpanNameUrlKey,
} = urlFiltersKeyMap;

const noApps: App[] = [];
const noKeys: FilterKey[] = [];
const noKeyGroups: string[] = [];

type UrlEntry = [key: string, value: string | null];

function dateUrlEntries(range: UncheckedDateRange): UrlEntry[] {
  const custom = range.dateRange === DateRange.Custom;
  return [
    [dateRangeUrlKey, range.dateRange],
    [startDateUrlKey, custom ? range.startDate : null],
    [endDateUrlKey, custom ? range.endDate : null],
  ];
}

function valueUrlEntries(
  value: FilterSelection,
  rootSpan: boolean,
): UrlEntry[] {
  const entries: UrlEntry[] = [
    [appIdUrlKey, value.app.id],
    ...dateUrlEntries(value.date),
    [filterExprUrlKey, value.filterExpr],
  ];
  if (rootSpan) {
    entries.push([rootSpanNameUrlKey, value.rootSpanName]);
  }
  return entries;
}

// Timestamps of a relative label are not compared.
function urlHolds(
  params: { get: (key: string) => string | null },
  value: FilterSelection,
  rootSpan: boolean,
): boolean {
  const custom = value.date.dateRange === DateRange.Custom;
  return valueUrlEntries(value, rootSpan).every(
    ([key, expected]) =>
      (!custom && (key === startDateUrlKey || key === endDateUrlKey)) ||
      params.get(key) === expected,
  );
}

function applyEntries(params: URLSearchParams, entries: UrlEntry[]) {
  for (const [key, value] of entries) {
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
}

// Starts from the live URL, since the rendered searchParams lag one
// transition behind. The state must be a fresh object: Next passes through a
// state carrying its own markers without updating searchParams.
function writeUrl(edit: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search);
  edit(params);
  window.history.replaceState({}, "", `?${params}`);
}

export function useExprFilterPage({
  teamId,
  entity,
  paginationLimit,
  rootSpan = false,
  appId: fixedAppId,
  onboarding = true,
}: {
  teamId: string;
  entity: string;
  paginationLimit?: number;
  rootSpan?: boolean;
  // Fixes the app. The URL app id is overwritten with it.
  appId?: string;
  // Whether the page offers the integration wizard to a team with no apps and
  // to an app that has not reported an event yet.
  onboarding?: boolean;
}) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const rememberedAppId = useFiltersStore((s) => s.selectedApp?.id);
  const rememberedDateRange = useFiltersStore((s) => s.selectedDateRange);
  const rememberedStartDate = useFiltersStore((s) => s.selectedStartDate);
  const rememberedEndDate = useFiltersStore((s) => s.selectedEndDate);
  const setSelectedApp = useFiltersStore((s) => s.setSelectedApp);
  const setSelectedDateRange = useFiltersStore((s) => s.setSelectedDateRange);
  const setSelectedStartDate = useFiltersStore((s) => s.setSelectedStartDate);
  const setSelectedEndDate = useFiltersStore((s) => s.setSelectedEndDate);
  const setApps = useFiltersStore((s) => s.setApps);

  const url = useMemo(
    () => ({
      appId: fixedAppId ?? searchParams.get(appIdUrlKey),
      dateRange: {
        dateRange: searchParams.get(dateRangeUrlKey),
        startDate: searchParams.get(startDateUrlKey),
        endDate: searchParams.get(endDateUrlKey),
      },
      filterExpr: searchParams.get(filterExprUrlKey),
      rootSpanName: rootSpan ? searchParams.get(rootSpanNameUrlKey) : null,
    }),
    [search, rootSpan, fixedAppId],
  );

  const appsQuery = useAppsQuery(teamId);
  const app = resolveApp(url.appId, appsQuery.data, rememberedAppId);

  const urlCustomKeyNames = useMemo(
    () =>
      url.filterExpr
        ? customKeyNamesIn(
            parseFilterExpr(url.filterExpr, { draft: true }).tokens,
          )
        : [],
    [url.filterExpr],
  );
  // An app that has not reported yet gets the wizard, so its keys are not read.
  const keysQuery = useFilterKeysQuery(
    onboarding && app !== null && !app.onboarded ? undefined : app?.id,
    entity,
    urlCustomKeyNames,
  );
  const spanNamesQuery = useRootSpanNamesQuery(rootSpan ? app : null);

  const {
    status,
    date: dateRange,
    filters,
    discarded,
  } = resolveFilters({
    url,
    apps: appsQuery,
    keys: keysQuery,
    spanNames: rootSpan ? spanNamesQuery : null,
    remembered: {
      appId: rememberedAppId,
      dateRange: {
        dateRange: rememberedDateRange,
        startDate: rememberedStartDate,
        endDate: rememberedEndDate,
      },
    },
    onboarding,
  });

  const customDate = dateRange.dateRange === DateRange.Custom;
  const date = useMemo(
    () => toDateSelection(dateRange)!,
    [
      dateRange.dateRange,
      customDate ? dateRange.startDate : null,
      customDate ? dateRange.endDate : null,
    ],
  );

  const value = useMemo<FilterSelection | null>(
    () =>
      filters === null
        ? null
        : {
            app: filters.app,
            date,
            filterExpr: filters.filterExpr,
            rootSpanName: filters.rootSpanName,
            discarded,
          },
    [filters?.app, date, filters?.filterExpr, filters?.rootSpanName, discarded],
  );

  useEffect(() => {
    if (app !== null && app.id !== rememberedAppId) {
      setSelectedApp(app);
    }
  }, [app?.id]);

  useEffect(() => {
    setSelectedDateRange(date.dateRange);
    setSelectedStartDate(date.startDate);
    setSelectedEndDate(date.endDate);
  }, [date]);

  useEffect(() => {
    if (appsQuery.status === "pending") {
      setApps([], "pending");
      return;
    }
    if (appsQuery.status === "error") {
      setApps([], "error");
      return;
    }
    const loaded = appsQuery.data;
    setApps(loaded, loaded.length === 0 ? "no-apps" : "loaded");
  }, [appsQuery.status, appsQuery.data]);

  // Writes only while the rendered URL is still the live one, so a
  // navigation the router has not rendered yet is not overwritten.
  useEffect(() => {
    if (status.kind !== "ready" || value === null) {
      return;
    }
    const live = new URLSearchParams(window.location.search);
    if (live.toString() !== search || urlHolds(live, value, rootSpan)) {
      return;
    }
    if (discarded) {
      toastNegative("Some filters were invalid, page reset to defaults");
    }
    writeUrl((params) => {
      applyEntries(params, valueUrlEntries(value, rootSpan));
      if (discarded && paginationLimit !== undefined) {
        params.set(paginationOffsetUrlKey, "0");
      }
    });
  });

  const filterParams: FilterParams | null =
    status.kind === "ready" &&
    value !== null &&
    urlHolds(searchParams, value, rootSpan)
      ? {
          appId: value.app.id,
          startDate: value.date.startDate,
          endDate: value.date.endDate,
          filterExpr: value.filterExpr,
        }
      : null;

  const paginationOffset =
    paginationLimit === undefined
      ? 0
      : Math.max(0, Number(searchParams.get(paginationOffsetUrlKey)) || 0);

  const onChange = (change: FilterChange) => {
    writeUrl((params) => {
      const entries: UrlEntry[] = [];
      if (change.appId !== undefined) {
        entries.push([appIdUrlKey, change.appId]);
      }
      if (change.dateRange !== undefined) {
        entries.push(...dateUrlEntries(change.dateRange));
      }
      if (change.filterExpr !== undefined) {
        entries.push([filterExprUrlKey, change.filterExpr]);
      }
      if (change.rootSpanName !== undefined) {
        entries.push([rootSpanNameUrlKey, change.rootSpanName]);
      }
      if (paginationLimit !== undefined) {
        entries.push([paginationOffsetUrlKey, "0"]);
      }
      applyEntries(params, entries);
    });
  };

  const setPageUrlKey = (key: string, pageValue: string) => {
    writeUrl((params) => params.set(key, pageValue));
  };

  const movePage = (by: number) => {
    if (paginationLimit === undefined) {
      return;
    }
    writeUrl((params) => {
      const offset = Number(params.get(paginationOffsetUrlKey)) || 0;
      params.set(paginationOffsetUrlKey, String(Math.max(0, offset + by)));
    });
  };

  return {
    value,
    apps: appsQuery.data ?? noApps,
    keys:
      keysQuery.isPending || keysQuery.isPlaceholderData
        ? null
        : (keysQuery.data?.keys ?? noKeys),
    keyGroups: keysQuery.data?.key_groups ?? noKeyGroups,
    keysUnavailable: keysQuery.isError,
    spanNames:
      rootSpan && (spanNamesQuery.isSuccess || spanNamesQuery.isError)
        ? (spanNamesQuery.data ?? [])
        : null,
    status,
    filterParams,
    paginationOffset,
    onChange,
    setPageUrlKey,
    nextPage: () => movePage(paginationLimit ?? 0),
    prevPage: () => movePage(-(paginationLimit ?? 0)),
  };
}
