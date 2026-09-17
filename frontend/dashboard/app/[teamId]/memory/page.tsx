"use client";

import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import HighMemoryUsageSessions from "@/app/components/high_memory_usage_sessions";
import MemoryUsageBreakdown from "@/app/components/memory_usage_breakdown";
import MemoryUsagePlot from "@/app/components/memory_usage_plot";
import type { MemoryAppImportance } from "@/app/api/api_calls";
import {
  HIGH_MEMORY_USAGE_SESSIONS_LIMIT,
  paginationOffsetUrlKey,
  useHighMemoryUsageSessionsQuery,
  useMemoryUsageBreakdownQuery,
  useMemoryUsagePlotQuery,
} from "@/app/query/hooks";
import { use, useState } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

const APP_IMPORTANCE_OPTIONS: {
  label: string;
  value: MemoryAppImportance;
}[] = [
  { label: "Foreground", value: "foreground" },
  { label: "User service", value: "user_service" },
  { label: "Background", value: "background" },
];
const APP_IMPORTANCE_LABELS = Object.fromEntries(
  APP_IMPORTANCE_OPTIONS.map(({ label, value }) => [value, label]),
) as Record<MemoryAppImportance, string>;
const APP_IMPORTANCE_VALUES = Object.fromEntries(
  APP_IMPORTANCE_OPTIONS.map(({ label, value }) => [label, value]),
) as Record<string, MemoryAppImportance>;

export default function MemoryPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({
    teamId,
    entity: "sessions",
    paginationLimit: HIGH_MEMORY_USAGE_SESSIONS_LIMIT,
  });
  const readyValue = filter.status.kind === "ready" ? filter.value : null;
  const [importanceSelection, setImportanceSelection] = useState<{
    appId: string | null;
    value: MemoryAppImportance;
  }>({ appId: null, value: "foreground" });
  const isAndroidApp =
    readyValue?.app.os_names?.some(
      (name) => name.toLowerCase() === "android",
    ) ?? false;
  const appImportance =
    importanceSelection.appId === readyValue?.app.id
      ? importanceSelection.value
      : "foreground";
  const memoryPlotQuery = useMemoryUsagePlotQuery(
    filter.filterParams,
    isAndroidApp ? appImportance : undefined,
  );
  const memoryBreakdownQuery = useMemoryUsageBreakdownQuery(
    filter.filterParams,
    isAndroidApp ? appImportance : undefined,
  );
  const highMemorySessionsQuery = useHighMemoryUsageSessionsQuery(
    filter.filterParams,
    isAndroidApp ? appImportance : undefined,
    filter.paginationOffset,
  );

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
      {isAndroidApp && (
        <div className="py-4">
          <DropdownSelect
            type={DropdownSelectType.SingleString}
            title="App importance"
            items={APP_IMPORTANCE_OPTIONS.map(({ label }) => label)}
            initialSelected={APP_IMPORTANCE_LABELS[appImportance]}
            onChangeSelected={(item) => {
              if (typeof item === "string") {
                filter.setPageUrlKey(paginationOffsetUrlKey, "0");
                setImportanceSelection({
                  appId: readyValue?.app.id ?? null,
                  value: APP_IMPORTANCE_VALUES[item],
                });
              }
            }}
          />
        </div>
      )}
      <div className="py-4" />
      {readyValue !== null && (
        <div className="flex w-full flex-col gap-16">
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
