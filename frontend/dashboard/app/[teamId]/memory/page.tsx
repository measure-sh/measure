"use client";

import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import HighMemoryUsageSessions from "@/app/components/high_memory_usage_sessions";
import MemoryUsageBreakdown from "@/app/components/memory_usage_breakdown";
import MemoryUsagePlot from "@/app/components/memory_usage_plot";
import { SkeletonListPage } from "@/app/components/skeleton";
import {
  HIGH_MEMORY_USAGE_SESSIONS_LIMIT,
  useHighMemoryUsageSessionsQuery,
  useMemoryUsageBreakdownQuery,
  useMemoryUsagePlotQuery,
} from "@/app/query/hooks";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function MemoryPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({
    teamId,
    entity: "memory",
    paginationLimit: HIGH_MEMORY_USAGE_SESSIONS_LIMIT,
  });
  const readyValue = filter.status.kind === "ready" ? filter.value : null;
  const memoryPlotQuery = useMemoryUsagePlotQuery(filter.filterParams);
  const memoryBreakdownQuery = useMemoryUsageBreakdownQuery(
    filter.filterParams,
  );
  const highMemorySessionsQuery = useHighMemoryUsageSessionsQuery(
    filter.filterParams,
    filter.paginationOffset,
  );
  const filterExprIssues =
    filterExprIssuesIn(memoryPlotQuery.error) ??
    filterExprIssuesIn(memoryBreakdownQuery.error) ??
    filterExprIssuesIn(highMemorySessionsQuery.error);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        teamId={teamId}
        status={filter.status}
        entity="memory"
        placeholder="Filter by device memory or app state…"
        value={filter.value}
        apps={filter.apps}
        keys={filter.keys}
        keyGroups={filter.keyGroups}
        keysUnavailable={filter.keysUnavailable}
        filterExprIssues={filterExprIssues}
        onChange={filter.onChange}
      />
      <div className="py-4" />
      {filter.status.kind === "error" && (
        <p className="text-lg font-display">{filter.status.message}</p>
      )}
      {filter.status.kind === "loading" && <SkeletonListPage />}
      {readyValue !== null && (
        <div className="flex w-full flex-col gap-16 pt-8">
          <MemoryUsagePlot
            startDate={readyValue.date.startDate}
            endDate={readyValue.date.endDate}
            query={memoryPlotQuery}
          />
          <MemoryUsageBreakdown query={memoryBreakdownQuery} />
          <HighMemoryUsageSessions
            teamId={teamId}
            query={highMemorySessionsQuery}
            onNext={filter.nextPage}
            onPrev={filter.prevPage}
          />
        </div>
      )}
    </div>
  );
}
