"use client";

import {
  type FilterRequest,
  type FilterState,
  type ReadyFilterState,
  filterExprUrlKey,
} from "@/app/components/filter_bar/filter_bar";
import { DateRange } from "@/app/components/filter_bar/date_range_select";
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

function sameRequest(a: FilterRequest, b: FilterRequest): boolean {
  return (
    a.appId === b.appId &&
    a.filterExpr === b.filterExpr &&
    a.rootSpanName === b.rootSpanName &&
    a.dateRange.dateRange === b.dateRange.dateRange &&
    a.dateRange.startDate === b.dateRange.startDate &&
    a.dateRange.endDate === b.dateRange.endDate
  );
}

/**
 * The URL-driven filter mechanics shared by the pages that pair a FilterBar
 * with paginated queries. The URL is the source of truth: the bar shows what
 * it is handed, its resolved report is written into the URL, and the queries
 * read the filter and the pagination offset back from it.
 *
 * A user's pick is held here as the request the bar shows until the URL
 * carries it. The page tells its own write from a navigation by the search
 * string it was on when the request was stored and the one it wrote; any
 * other search string is a navigation and the URL wins. The request is kept
 * after the write, because a condition with no value yet is not written into
 * the URL.
 *
 * A page with a root span selection in the URL declares its key in
 * `extraUrlKeys`. A page without pagination leaves `paginationLimit` out.
 * URL state the bar knows nothing about, such as which plot is shown, is
 * listed in `pageUrlKeys` and written through `setPageUrlKey`; a filter
 * write carries those values over.
 */
export function useExprFilterPage({
  paginationLimit,
  extraUrlKeys,
  pageUrlKeys = [],
}: {
  paginationLimit?: number;
  extraUrlKeys?: { rootSpanName: string };
  pageUrlKeys?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [request, setRequest] = useState<{
    filters: FilterRequest;
    urlBefore: string | null;
    urlWritten: string | null;
    awaitingWrite: boolean;
  } | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    status: "pending",
  });

  // The search string from before the write is only the page's own until
  // the written one is seen. After that it can only come from a navigation,
  // such as the same sidebar link clicked again, so it is forgotten.
  if (
    request !== null &&
    request.urlBefore !== null &&
    search === request.urlWritten
  ) {
    setRequest({ ...request, urlBefore: null });
  }

  const writeInFlight =
    request !== null &&
    request.urlBefore !== null &&
    search === request.urlBefore;

  // Until the router reports the written search string, the page reads back
  // the one it wrote, not the one from before.
  const knownParams =
    writeInFlight && request.urlWritten !== null
      ? new URLSearchParams(request.urlWritten)
      : searchParams;

  const paginationOffset =
    paginationLimit === undefined
      ? 0
      : Number(knownParams.get(paginationOffsetUrlKey)) || 0;

  const fromUrl: FilterRequest = {
    appId: searchParams.get(appIdUrlKey),
    dateRange: {
      dateRange: searchParams.get(dateRangeUrlKey),
      startDate: searchParams.get(startDateUrlKey),
      endDate: searchParams.get(endDateUrlKey),
    },
    filterExpr: searchParams.get(filterExprUrlKey),
    rootSpanName:
      extraUrlKeys === undefined
        ? null
        : searchParams.get(extraUrlKeys.rootSpanName),
  };

  const fromReadyState = (state: ReadyFilterState): FilterRequest => ({
    appId: state.app.id,
    dateRange: state.date,
    filterExpr: state.filterExpr,
    rootSpanName: state.rootSpanName,
  });

  const requestedFilters =
    request !== null && (writeInFlight || search === request.urlWritten)
      ? request.filters
      : fromUrl;

  // A relative label is counted back from now, so its timestamps are not
  // written and any the URL holds are ignored.
  const filterUrlEntries = (filter: ReadyFilterState) => {
    const entries: [string, string | null][] = [
      [appIdUrlKey, filter.app.id],
      [dateRangeUrlKey, filter.date.dateRange],
    ];
    if (filter.date.dateRange === DateRange.Custom) {
      entries.push(
        [startDateUrlKey, filter.date.startDate],
        [endDateUrlKey, filter.date.endDate],
      );
    }
    if (extraUrlKeys !== undefined) {
      entries.push([extraUrlKeys.rootSpanName, filter.rootSpanName]);
    }
    entries.push([filterExprUrlKey, filter.filterExpr]);
    return entries;
  };

  // The filter is null until the URL matches the bar's report, root span
  // included, so a value the bar discarded is never fetched.
  const filterParams: FilterParams | null =
    filterState.status === "ready" &&
    filterUrlEntries(filterState).every(
      ([key, value]) => searchParams.get(key) === value,
    )
      ? {
          appId: filterState.app.id,
          startDate: filterState.date.startDate,
          endDate: filterState.date.endDate,
          filterExpr: filterState.filterExpr,
        }
      : null;

  const buildFilterUrl = (filter: ReadyFilterState, offset: number) => {
    const urlParams = new URLSearchParams();
    if (paginationLimit !== undefined) {
      urlParams.set(paginationOffsetUrlKey, String(offset));
    }
    for (const [key, value] of filterUrlEntries(filter)) {
      if (value !== null) {
        urlParams.set(key, value);
      }
    }
    for (const key of pageUrlKeys) {
      const value = knownParams.get(key);
      if (value !== null) {
        urlParams.set(key, value);
      }
    }
    return urlParams.toString();
  };

  // A pick keeps the last written URL, since a write of it can still be on
  // its way and must be read as the page's own when it is applied.
  const onRequestChange = (change: Partial<FilterRequest>) => {
    const filters = { ...requestedFilters, ...change };
    if (sameRequest(filters, requestedFilters)) {
      return;
    }
    setRequest({
      filters,
      urlBefore: search,
      urlWritten: request?.urlWritten ?? null,
      awaitingWrite: true,
    });
  };

  const onFilterChange = (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    if (newFilterState.status !== "ready") {
      return;
    }
    // The URL's pagination offset is kept only when the bar applied the
    // request unchanged and that request is already in the URL. A new pick,
    // or a substitution, starts back at page one.
    const pickAwaitingWrite = request !== null && request.awaitingWrite;
    const offset =
      newFilterState.appliedAsRequested && !pickAwaitingWrite
        ? paginationOffset
        : 0;
    const params = buildFilterUrl(newFilterState, offset);
    // Stored as resolved, so a navigation back to the search string it came
    // from changes the bar's props and the bar reports again. The filter text
    // is kept as asked, since a condition with no value yet is not resolved.
    setRequest({
      filters: {
        ...fromReadyState(newFilterState),
        filterExpr: newFilterState.appliedAsRequested
          ? requestedFilters.filterExpr
          : newFilterState.filterExpr,
      },
      urlBefore: search,
      urlWritten: params,
      awaitingWrite: false,
    });
    // The bar reports again before the router applies a write; the same
    // write is not issued twice.
    if (
      params !== search &&
      !(writeInFlight && params === request.urlWritten)
    ) {
      router.replace(`?${params}`, { scroll: false });
    }
  };

  // Replaces one key in the URL and leaves everything else the URL carries
  // as it is. The write is recorded so the bar keeps showing the request.
  const setPageUrlKey = (key: string, value: string) => {
    const urlParams = new URLSearchParams(knownParams);
    urlParams.set(key, value);
    const params = urlParams.toString();
    setRequest({
      filters: requestedFilters,
      urlBefore: search,
      urlWritten: params,
      awaitingWrite: request !== null && request.awaitingWrite,
    });
    router.replace(`?${params}`, { scroll: false });
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
    paginationOffset,
    filterState,
    filterParams,
    onRequestChange,
    onFilterChange,
    setPageUrlKey,
    nextPage,
    prevPage,
  };
}
