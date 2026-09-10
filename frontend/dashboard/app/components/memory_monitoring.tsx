"use client";

import { useMemo, useState } from "react";
import type { MemoryPlatform } from "../api/api_calls";
import { emptyHighestMemorySessionsResponse } from "../api/api_calls";
import {
  useHighestMemorySessionsQuery,
  useMemoryUsagePlotQuery,
} from "../query/hooks";
import FilterBar from "./filter_bar/filter_bar";
import { useExprFilterPage } from "./filter_bar/use_expr_filter_page";
import LoadingBar from "./loading_bar";
import MemorySessionsTable from "./memory_sessions_table";
import MemoryUsagePlot from "./memory_usage_plot";
import Paginator from "./paginator";
import { SkeletonListPage, SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";
import { getPlotTimeGroupForRange } from "../utils/time_utils";

const MEMORY_SESSIONS_LIMIT = 5;

function platformsForApp(osNames: string[] | null): MemoryPlatform[] {
  const normalized = (osNames ?? [])
    .map((name) => name.toLowerCase())
    .map((name) => (name === "ipados" ? "ios" : name))
    .filter(
      (name): name is MemoryPlatform => name === "android" || name === "ios",
    );
  const unique = Array.from(new Set(normalized));
  // Unknown/empty os_names: don't assume, offer both.
  return unique.length > 0 ? unique : ["android", "ios"];
}

export default function MemoryMonitoring({
  params,
}: {
  params: { teamId: string };
}) {
  const { teamId } = params;

  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    paginationOffset,
    onChange,
    nextPage,
    prevPage,
  } = useExprFilterPage({
    teamId,
    entity: "sessions",
    paginationLimit: MEMORY_SESSIONS_LIMIT,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const availablePlatforms = useMemo(
    () => platformsForApp(readyValue?.app.os_names ?? null),
    [readyValue?.app.id, readyValue?.app.os_names],
  );

  // Follows the selected app's platform(s) unless the user has explicitly
  // picked one; falls back to the first available platform otherwise.
  const [platformOverride, setPlatformOverride] =
    useState<MemoryPlatform | null>(null);
  const platform =
    platformOverride && availablePlatforms.includes(platformOverride)
      ? platformOverride
      : availablePlatforms[0];

  const plotTimeGroup = readyValue
    ? getPlotTimeGroupForRange(
        readyValue.date.startDate,
        readyValue.date.endDate,
      )
    : "days";

  const plotQuery = useMemoryUsagePlotQuery(filterParams, platform);
  const sessionsQuery = useHighestMemorySessionsQuery(
    filterParams,
    platform,
    paginationOffset,
  );

  const metricLabel =
    platform === "android" ? "Dynamic Memory Usage" : "Memory Footprint";
  const trend = plotQuery.data?.results ?? [];
  const percentiles = plotQuery.data?.percentiles ?? [];
  const thresholds = plotQuery.data?.thresholds ?? [];
  const sessionsOverview =
    sessionsQuery.data ?? emptyHighestMemorySessionsResponse;

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />

      <FilterBar
        entity="sessions"
        placeholder="Filter sessions…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && <SkeletonListPage />}

      {readyValue !== null && (
        <>
          {availablePlatforms.length > 1 && (
            <TabSelect
              items={["Android", "iOS"]}
              selected={platform === "android" ? "Android" : "iOS"}
              onChangeSelected={(item) =>
                setPlatformOverride(item === "Android" ? "android" : "ios")
              }
            />
          )}

          <div className="py-8" />

          <div className="w-full" data-testid="memory-trend-section">
            <p className="font-display text-xl">{metricLabel} Trend</p>
            <div className="py-2" />
            {plotQuery.status === "pending" && (
              <div className="w-full h-144">
                <SkeletonPlot />
              </div>
            )}
            {plotQuery.status === "error" && (
              <p className="font-body text-sm">
                Error fetching memory usage, please change filters & try again
              </p>
            )}
            {plotQuery.status === "success" && (
              <MemoryUsagePlot
                data={trend}
                plotTimeGroup={plotTimeGroup}
                metricLabel={metricLabel}
                percentiles={percentiles}
                thresholds={thresholds}
              />
            )}
          </div>

          <div className="py-10" />

          <div className="w-full" data-testid="memory-sessions-section">
            <p className="font-display text-xl">Highest Memory Sessions</p>
            <div className="py-2" />
            {sessionsQuery.status === "pending" && <SkeletonListPage />}
            {sessionsQuery.status === "error" && (
              <p className="font-body text-sm">
                Error fetching sessions, please change filters & try again
              </p>
            )}
            {sessionsQuery.status === "success" && (
              <div className="flex flex-col w-full">
                <div className="self-end">
                  <Paginator
                    prevEnabled={
                      sessionsQuery.isFetching
                        ? false
                        : sessionsOverview.meta.previous
                    }
                    nextEnabled={
                      sessionsQuery.isFetching
                        ? false
                        : sessionsOverview.meta.next
                    }
                    displayText=""
                    onNext={nextPage}
                    onPrev={prevPage}
                  />
                </div>
                <div
                  className={`py-1 w-full ${sessionsQuery.isFetching ? "visible" : "invisible"}`}
                >
                  <LoadingBar />
                </div>
                <div className="py-2" />
                <MemorySessionsTable
                  teamId={teamId}
                  appId={readyValue.app.id}
                  sessions={sessionsOverview.results}
                />
              </div>
            )}
          </div>

          <div className="py-8" />
        </>
      )}
    </div>
  );
}
