"use client";

import FilterBar, {
  type FilterState,
  type ReadyFilterState,
  filterExprUrlKey,
} from "@/app/components/filter_bar/filter_bar";
import { filterExprIssuesIn } from "@/app/api/api_error";
import { paginationOffsetUrlKey, useBuildsQuery } from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import {
  type ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { use, useState } from "react";
import BuildsResults from "./builds_results";

const PAGINATION_LIMIT = 10;

const {
  appId: appIdUrlKey,
  dateRange: dateRangeUrlKey,
  startDate: startDateUrlKey,
  endDate: endDateUrlKey,
} = urlFiltersKeyMap;

function readRequestedFilters(searchParams: ReadonlyURLSearchParams) {
  return {
    app: searchParams.get(appIdUrlKey),
    dateRange: {
      dateRange: searchParams.get(dateRangeUrlKey),
      startDate: searchParams.get(startDateUrlKey),
      endDate: searchParams.get(endDateUrlKey),
    },
    filterExpr: searchParams.get(filterExprUrlKey),
  };
}

function buildFilterUrl(filter: ReadyFilterState, paginationOffset: number) {
  const urlParams = new URLSearchParams();
  urlParams.set(paginationOffsetUrlKey, String(paginationOffset));
  urlParams.set(appIdUrlKey, filter.app.id);
  urlParams.set(dateRangeUrlKey, filter.date.dateRange);
  urlParams.set(startDateUrlKey, filter.date.startDate);
  urlParams.set(endDateUrlKey, filter.date.endDate);
  if (filter.filterExpr) {
    urlParams.set(filterExprUrlKey, filter.filterExpr);
  }
  return `?${urlParams.toString()}`;
}

export default function Builds(props: { params: Promise<{ teamId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const paginationOffset =
    Number(searchParams.get(paginationOffsetUrlKey)) || 0;
  const requestedFilters = readRequestedFilters(searchParams);

  const [filterState, setFilterState] = useState<FilterState>({
    status: "pending",
  });

  // The query reads the filter and the pagination offset from the URL, so
  // each fetch uses one searchParams snapshot. The filter is null until the
  // URL matches the bar's report. A value the bar discarded is never fetched.
  const filterParams =
    filterState.status === "ready" &&
    requestedFilters.app === filterState.app.id &&
    requestedFilters.dateRange.startDate === filterState.date.startDate &&
    requestedFilters.dateRange.endDate === filterState.date.endDate &&
    requestedFilters.filterExpr === filterState.filterExpr
      ? {
          appId: requestedFilters.app,
          startDate: requestedFilters.dateRange.startDate,
          endDate: requestedFilters.dateRange.endDate,
          filterExpr: requestedFilters.filterExpr,
        }
      : null;

  const buildsQuery = useBuildsQuery(filterParams, paginationOffset);

  const filterExprIssues = filterExprIssuesIn(buildsQuery.error);

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

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        teamId={params.teamId}
        entity="builds"
        placeholder="Filter builds…"
        requestedAppId={requestedFilters.app}
        requestedDateRange={requestedFilters.dateRange}
        requestedFilterExpr={requestedFilters.filterExpr}
        filterExprIssues={filterExprIssues}
        onFilterChange={onFilterChange}
      />
      <div className="py-4" />

      <BuildsResults
        filterState={filterState}
        query={buildsQuery}
        filterExprHasIssues={filterExprIssues !== null}
        onNextPage={() => navigateToOffset(paginationOffset + PAGINATION_LIMIT)}
        onPrevPage={() =>
          navigateToOffset(Math.max(0, paginationOffset - PAGINATION_LIMIT))
        }
      />
    </div>
  );
}
