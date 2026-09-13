"use client";

import FilterBar from "@/app/components/filter_bar/filter_bar";
import MemoryUsagePlot from "@/app/components/memory_usage_plot";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import { useMemoryUsagePlotQuery } from "@/app/query/hooks";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function MemoryPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({ teamId, entity: "sessions" });
  const readyValue = filter.status.kind === "ready" ? filter.value : null;
  const memoryPlotQuery = useMemoryUsagePlotQuery(filter.filterParams);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        teamId={teamId}
        status={filter.status}
        entity="sessions"
        placeholder="Filter sessions…"
        value={filter.value}
        apps={filter.apps}
        keys={filter.keys}
        keyGroups={filter.keyGroups}
        keysUnavailable={filter.keysUnavailable}
        onChange={filter.onChange}
      />
      <div className="py-4" />
      {readyValue !== null && (
        <MemoryUsagePlot
          startDate={readyValue.date.startDate}
          endDate={readyValue.date.endDate}
          query={memoryPlotQuery}
        />
      )}
    </div>
  );
}
