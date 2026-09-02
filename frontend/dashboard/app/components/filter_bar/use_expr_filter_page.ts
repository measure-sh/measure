"use client";

import {
  type FilterState,
  type ReadyFilterState,
  filterExprUrlKey,
} from "@/app/components/filter_bar/filter_bar";
import { type FilterParams, paginationOffsetUrlKey } from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const {
  appId: appIdUrlKey,
  dateRange: dateRangeUrlKey,
  startDate: startDateUrlKey,
  endDate: endDateUrlKey,
} = urlFiltersKeyMap;

/**
 * Fields of the bar's ready report that a page may carry in the URL beyond
 * the app, date range and filter expression: the nullable string fields,
 * minus the filter expression the hook already owns.
 */
type ExtraFilterField = Exclude<
  {
    [P in keyof ReadyFilterState]: ReadyFilterState[P] extends string | null
      ? null extends ReadyFilterState[P]
        ? P
        : never
      : never;
  }[keyof ReadyFilterState],
  "filterExpr"
>;

/**
 * The URL-driven filter mechanics shared by the pages that pair a FilterBar
 * with paginated queries. The URL is the single source of truth: the bar's
 * report is written into the URL, and the queries read the filter and the
 * pagination offset back from it, so each fetch uses one searchParams
 * snapshot.
 *
 * A page with a selection of its own carried in the URL, such as a root span
 * name, declares it in `extraUrlKeys` as a map from the field of the bar's
 * ready report to the URL key that carries it. The hook then reads the
 * requested value, includes the field in the URL-vs-report equality gate, and
 * writes it into the URL with the rest of the filter.
 *
 * A page that queries without pagination leaves `paginationLimit` out: the
 * URL then never carries the offset and `paginationOffset` stays zero.
 *
 * A page with URL state the bar knows nothing about, such as which plot is
 * shown, lists those keys in `pageUrlKeys` and writes them through
 * `setPageUrlKey`. When the bar's report is written into the URL, the values
 * those keys currently hold are carried over, so a filter change does not
 * reset them.
 */
export function useExprFilterPage<Extra extends ExtraFilterField = never>({
  paginationLimit,
  extraUrlKeys,
  pageUrlKeys = [],
}: {
  paginationLimit?: number;
  extraUrlKeys?: Record<Extra, string>;
  pageUrlKeys?: string[];
}) {
  const extras = Object.entries(extraUrlKeys ?? {}) as [Extra, string][];

  const router = useRouter();
  const searchParams = useSearchParams();

  const paginationOffset =
    paginationLimit === undefined
      ? 0
      : Number(searchParams.get(paginationOffsetUrlKey)) || 0;

  const requestedFilters = {
    app: searchParams.get(appIdUrlKey),
    dateRange: {
      dateRange: searchParams.get(dateRangeUrlKey),
      startDate: searchParams.get(startDateUrlKey),
      endDate: searchParams.get(endDateUrlKey),
    },
    filterExpr: searchParams.get(filterExprUrlKey),
  };
  const requestedExtras = Object.fromEntries(
    extras.map(([field, urlKey]) => [field, searchParams.get(urlKey)]),
  ) as Record<Extra, string | null>;

  const [filterState, setFilterState] = useState<FilterState>({
    status: "pending",
  });

  // The filter is null until the URL matches the bar's report, extras
  // included, so a value the bar discarded is never fetched.
  const filterParams: FilterParams | null =
    filterState.status === "ready" &&
    requestedFilters.app === filterState.app.id &&
    requestedFilters.dateRange.startDate === filterState.date.startDate &&
    requestedFilters.dateRange.endDate === filterState.date.endDate &&
    requestedFilters.filterExpr === filterState.filterExpr &&
    extras.every(([field]) => requestedExtras[field] === filterState[field])
      ? {
          appId: requestedFilters.app,
          startDate: requestedFilters.dateRange.startDate,
          endDate: requestedFilters.dateRange.endDate,
          filterExpr: requestedFilters.filterExpr,
        }
      : null;

  const buildFilterUrl = (filter: ReadyFilterState, offset: number) => {
    const urlParams = new URLSearchParams();
    if (paginationLimit !== undefined) {
      urlParams.set(paginationOffsetUrlKey, String(offset));
    }
    urlParams.set(appIdUrlKey, filter.app.id);
    urlParams.set(dateRangeUrlKey, filter.date.dateRange);
    urlParams.set(startDateUrlKey, filter.date.startDate);
    urlParams.set(endDateUrlKey, filter.date.endDate);
    for (const [field, urlKey] of extras) {
      const value: string | null = filter[field];
      if (value !== null) {
        urlParams.set(urlKey, value);
      }
    }
    if (filter.filterExpr) {
      urlParams.set(filterExprUrlKey, filter.filterExpr);
    }
    for (const key of pageUrlKeys) {
      const value = searchParams.get(key);
      if (value !== null) {
        urlParams.set(key, value);
      }
    }
    return `?${urlParams.toString()}`;
  };

  const onFilterChange = (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    if (newFilterState.status !== "ready") {
      return;
    }
    // The URL's pagination offset is kept only when the bar applied the URL's
    // request unchanged. Any edit or substitution starts back at page one.
    const offset = newFilterState.appliedAsRequested ? paginationOffset : 0;
    router.replace(buildFilterUrl(newFilterState, offset), { scroll: false });
  };

  // Replaces one key in the URL and leaves everything else the URL carries
  // as it is.
  const setPageUrlKey = (key: string, value: string) => {
    const urlParams = new URLSearchParams(searchParams);
    urlParams.set(key, value);
    router.replace(`?${urlParams.toString()}`, { scroll: false });
  };

  const navigateToOffset = (offset: number) =>
    setPageUrlKey(paginationOffsetUrlKey, String(offset));

  const nextPage = () => {
    if (paginationLimit === undefined) {
      return;
    }
    navigateToOffset(paginationOffset + paginationLimit);
  };
  const prevPage = () => {
    if (paginationLimit === undefined) {
      return;
    }
    navigateToOffset(Math.max(0, paginationOffset - paginationLimit));
  };

  return {
    requestedFilters,
    requestedExtras,
    paginationOffset,
    filterState,
    filterParams,
    onFilterChange,
    setPageUrlKey,
    nextPage,
    prevPage,
  };
}
