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
 */
export function useExprFilterPage<Extra extends ExtraFilterField = never>({
  paginationLimit,
  extraUrlKeys,
}: {
  paginationLimit: number;
  extraUrlKeys?: Record<Extra, string>;
}) {
  const extras = Object.entries(extraUrlKeys ?? {}) as [Extra, string][];

  const router = useRouter();
  const searchParams = useSearchParams();

  const paginationOffset =
    Number(searchParams.get(paginationOffsetUrlKey)) || 0;

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
    urlParams.set(paginationOffsetUrlKey, String(offset));
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

  const navigateToOffset = (offset: number) => {
    const urlParams = new URLSearchParams(searchParams);
    urlParams.set(paginationOffsetUrlKey, String(offset));
    router.replace(`?${urlParams.toString()}`, { scroll: false });
  };

  const nextPage = () => navigateToOffset(paginationOffset + paginationLimit);
  const prevPage = () =>
    navigateToOffset(Math.max(0, paginationOffset - paginationLimit));

  return {
    requestedFilters,
    requestedExtras,
    paginationOffset,
    filterState,
    filterParams,
    onFilterChange,
    nextPage,
    prevPage,
  };
}
