"use client";

import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import { filterExprIssuesIn } from "@/app/api/api_error";
import { useBuildsQuery } from "@/app/query/hooks";
import { use } from "react";
import BuildsResults from "./builds_results";

const PAGINATION_LIMIT = 10;

export default function Builds(props: { params: Promise<{ teamId: string }> }) {
  const params = use(props.params);

  const {
    requestedFilters,
    paginationOffset,
    filterState,
    filterParams,
    onRequestChange,
    onFilterChange,
    nextPage,
    prevPage,
  } = useExprFilterPage({ paginationLimit: PAGINATION_LIMIT });

  const buildsQuery = useBuildsQuery(filterParams, paginationOffset);

  const filterExprIssues = filterExprIssuesIn(buildsQuery.error);

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        teamId={params.teamId}
        entity="builds"
        placeholder="Filter builds…"
        requestedAppId={requestedFilters.appId}
        requestedDateRange={requestedFilters.dateRange}
        requestedFilterExpr={requestedFilters.filterExpr}
        filterExprIssues={filterExprIssues}
        onRequestChange={onRequestChange}
        onFilterChange={onFilterChange}
      />
      <div className="py-4" />

      <BuildsResults
        filterState={filterState}
        query={buildsQuery}
        filterExprHasIssues={filterExprIssues !== null}
        onNextPage={nextPage}
        onPrevPage={prevPage}
      />
    </div>
  );
}
