"use client";

import { useMemo, useState } from "react";
import type { MemoryPlatform, MemoryScope } from "../api/api_calls";
import { emptyHighestMemorySessionsResponse } from "../api/api_calls";
import {
  useHighestMemorySessionsQuery,
  useMemoryUsagePlotQuery,
} from "../query/hooks";
import BetaBadge from "./beta_badge";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
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

// Mirrors the four process states Play Console's own Memory usage (Anon RSS
// + Swap) vital segments by.
const SCOPES: { label: string; value: MemoryScope }[] = [
  { label: "All", value: "" },
  { label: "Foreground", value: "foreground" },
  { label: "User-perceived service", value: "user_perceived_service" },
  { label: "Background", value: "background" },
  { label: "Cached", value: "cached" },
];

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

  // Process state (foreground / user_perceived_service / background /
  // cached — matching Play Console's own Memory usage vital) is a property
  // of each reading (memory_usage_dynamic.process_state), not a
  // session-level fact, so it's a plot-local control rather than a
  // FilterBar/exprfilter key — the shared filter already offers
  // session-level facts like RAM tier and "did this session run in the
  // background at all" (session_ram_tier, session_foreground_background)
  // generically.
  const [scope, setScope] = useState<MemoryScope>("");

  const plotTimeGroup = readyValue
    ? getPlotTimeGroupForRange(
        readyValue.date.startDate,
        readyValue.date.endDate,
      )
    : "days";

  const plotQuery = useMemoryUsagePlotQuery(
    filterParams,
    platform,
    platform === "android" ? scope : "",
  );
  const sessionsQuery = useHighestMemorySessionsQuery(
    filterParams,
    platform,
    paginationOffset,
  );

  const metricLabel =
    platform === "android" ? "Dynamic Memory Usage" : "Memory Footprint";
  const trend = plotQuery.data?.results ?? [];
  const sessionsOverview =
    sessionsQuery.data ?? emptyHighestMemorySessionsResponse;

  // Google Play's own "excessive memory usage" ceiling, computed
  // server-side (backend/libs/measure/memory_thresholds.go, which owns the
  // published table and decides when the current RAM tier + process state
  // is unambiguous enough to show one) — absent whenever it doesn't apply,
  // never guessed client-side.
  const thresholdMB = plotQuery.data?.threshold_mb;
  const thresholdLabel = plotQuery.data?.threshold_label;
  const showThresholdHint =
    platform === "android" &&
    scope !== "" &&
    scope !== "cached" &&
    thresholdMB == null;

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />

      <div className="flex items-center gap-2">
        <p className="font-display text-2xl">Memory Monitoring</p>
        <BetaBadge popup="Session-sampled memory vitals: Dynamic Memory Usage on Android, Memory Footprint on iOS." />
      </div>
      <div className="py-2" />
      <p className="font-body text-sm text-muted-foreground max-w-2xl">
        {platform === "android"
          ? "Dynamic Memory Usage (anon RSS + swap), sampled from a subset of sessions."
          : "Memory Footprint (used memory), sampled from a subset of sessions while the app is in the foreground."}
      </p>

      <div className="py-6" />

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
          <div className="flex flex-wrap items-center gap-3">
            {availablePlatforms.length > 1 && (
              <TabSelect
                items={["Android", "iOS"]}
                selected={platform === "android" ? "Android" : "iOS"}
                onChangeSelected={(item) =>
                  setPlatformOverride(item === "Android" ? "android" : "ios")
                }
              />
            )}
            {platform === "android" && (
              <DropdownSelect
                type={DropdownSelectType.SingleString}
                title="Process State"
                items={SCOPES.map((s) => s.label)}
                initialSelected={
                  SCOPES.find((s) => s.value === scope)?.label ?? "All"
                }
                onChangeSelected={(item) =>
                  setScope(
                    SCOPES.find((s) => s.label === (item as string))?.value ??
                      "",
                  )
                }
              />
            )}
          </div>

          <div className="py-8" />

          <div className="w-full" data-testid="memory-trend-section">
            <p className="font-display text-xl">{metricLabel} Trend</p>
            <div className="py-2" />
            {showThresholdHint && (
              <p className="font-body text-xs text-muted-foreground pb-2">
                Filter to a single RAM Tier to see Play Console&apos;s
                excessive-memory threshold line for the selected process state.
                Play doesn&apos;t publish a threshold for the 0–4 GB or 16 GB+
                tiers.
              </p>
            )}
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
                thresholdMB={thresholdMB}
                thresholdLabel={thresholdLabel}
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
