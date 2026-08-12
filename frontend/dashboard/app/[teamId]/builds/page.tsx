"use client";

import FilterBar, {
  type FilterState,
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

type ReadyFilter = Extract<FilterState, { status: "ready" }>;

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

function buildFilterUrl(filter: ReadyFilter, paginationOffset: number) {
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
  const readyFilter = filterState.status === "ready" ? filterState : null;

  const buildsQuery = useBuildsQuery(readyFilter, paginationOffset);

  const filterExprIssues = filterExprIssuesIn(buildsQuery.error);

  const onFilterChange = (newFilterState: FilterState) => {
    const hasInitializedFilters = readyFilter !== null;
    setFilterState(newFilterState);

    if (newFilterState.status !== "ready") {
      return;
    }
    // The first ready state is the one the page opened on, so it keeps the
    // page the link asked for. Every change after that starts at page one.
    const offset = hasInitializedFilters ? 0 : paginationOffset;
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
