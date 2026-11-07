"use client";

import type {
  DeviceDurationRow,
  DeviceErrorsRow,
  DeviceMemoryRow,
  DeviceRowBase,
  DeviceSessionsRow,
  LaunchType,
} from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import type { ExprTree } from "@/app/api/filter_types";
import DevicesTable, {
  type DevicesTableColumn,
} from "@/app/components/devices/table";
import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { formatFilterExpr } from "@/app/components/filter_bar/parse";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import { useDateRangeParams } from "@/app/components/funnel/step_list";
import { SkeletonListPage } from "@/app/components/skeleton";
import TabSelect from "@/app/components/tab_select";
import DevicesSessionsPlot from "@/app/components/devices/sessions_plot";
import {
  useDevicesSessionsPlotQuery,
  useRootSpanNamesQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import { formatMemoryKilobytes, numberToKMB } from "@/app/utils/number_utils";
import { formatMillisToHumanReadable } from "@/app/utils/time_utils";
import { use, useState } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

const LAUNCH_TYPES: { label: string; value: LaunchType }[] = [
  { label: "Cold", value: "cold_launch" },
  { label: "Warm", value: "warm_launch" },
  { label: "Hot", value: "hot_launch" },
];

// This filter narrows another page to one device. Since pages accept different
// filter keys, the devices-page filter is not carried over.
function deviceConditions(row: DeviceRowBase): ExprTree[] {
  return [
    {
      condition: {
        key_name: "device_manufacturer",
        operator: "in",
        values: [{ text: row.device_manufacturer }],
      },
    },
    {
      condition: {
        key_name: "device_model",
        operator: "in",
        values: [{ text: row.device_model }],
      },
    },
  ];
}

function formatDuration(millis: number | null): string {
  return millis === null
    ? "-"
    : formatMillisToHumanReadable(Math.round(millis));
}

function count(value: number): string {
  return numberToKMB(value);
}

const durationColumns: DevicesTableColumn<DeviceDurationRow>[] = [
  {
    header: "p50",
    percentile: "p50",
    cell: (row) => formatDuration(row.p50),
  },
  {
    header: "p90",
    percentile: "p90",
    cell: (row) => formatDuration(row.p90),
  },
  {
    header: "p95",
    percentile: "p95",
    cell: (row) => formatDuration(row.p95),
  },
];

export default function DevicesPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({ teamId, entity: "devices" });
  const readyValue = filter.status.kind === "ready" ? filter.value : null;
  const app = readyValue?.app ?? null;
  const isAndroid = app?.os_names?.[0] === "android";
  const dateRangeParams = useDateRangeParams();

  const [launchType, setLaunchType] = useState<LaunchType>("cold_launch");
  const [pickedSpanName, setPickedSpanName] = useState<string | null>(null);
  const spanNamesQuery = useRootSpanNamesQuery(app);
  const spanNames = spanNamesQuery.data ?? [];
  const spanName =
    pickedSpanName !== null && spanNames.includes(pickedSpanName)
      ? pickedSpanName
      : (spanNames[0] ?? null);

  const sessionsPlotQuery = useDevicesSessionsPlotQuery(filter.filterParams);
  const filterExprIssues = filterExprIssuesIn(sessionsPlotQuery.error);

  const linkTo = (
    path: string,
    conditions: ExprTree[],
    extra: Record<string, string> = {},
  ) => {
    if (!app) {
      return undefined;
    }
    const search = new URLSearchParams(dateRangeParams);
    search.set(urlFiltersKeyMap.appId, app.id);
    for (const [key, value] of Object.entries(extra)) {
      search.set(key, value);
    }
    search.set(
      "filter_expr",
      formatFilterExpr({ logical_operator: "and", children: conditions }),
    );
    return `/${teamId}/${path}?${search}`;
  };

  const sessionsColumns: DevicesTableColumn<DeviceSessionsRow>[] = [
    { header: "Sessions", cell: (row) => count(row.session_count) },
    {
      header: "Share of sessions",
      cell: (row) => `${row.percent_of_sessions.toFixed(1)}%`,
    },
  ];

  const errorsColumns: DevicesTableColumn<DeviceErrorsRow>[] = [
    { header: "Errors", cell: (row) => count(row.error_count) },
    { header: "Crashes", cell: (row) => count(row.crash_count) },
    isAndroid
      ? { header: "ANRs", cell: (row) => count(row.anr_count) }
      : { header: "App hangs", cell: (row) => count(row.app_hang_count) },
    { header: "Non-fatal", cell: (row) => count(row.non_fatal_count) },
    { header: "Sessions", cell: (row) => count(row.session_count) },
  ];

  const memoryColumns: DevicesTableColumn<DeviceMemoryRow>[] = [
    {
      header: "p50",
      percentile: "p50",
      cell: (row) => formatMemoryKilobytes(row.p50),
    },
    {
      header: "p90",
      percentile: "p90",
      cell: (row) => formatMemoryKilobytes(row.p90),
    },
    {
      header: "p95",
      percentile: "p95",
      cell: (row) => formatMemoryKilobytes(row.p95),
    },
    { header: "Sessions", cell: (row) => count(row.session_count) },
  ];

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        teamId={teamId}
        status={filter.status}
        entity="devices"
        placeholder="Filter by app version, OS or device…"
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
          <DevicesSessionsPlot
            startDate={readyValue.date.startDate}
            endDate={readyValue.date.endDate}
            query={sessionsPlotQuery}
          />
          <DevicesTable
            list="sessions"
            filterParams={filter.filterParams}
            testId="devices-sessions"
            title="Sessions"
            description="Sessions by device"
            columns={sessionsColumns}
          />
          <DevicesTable
            list="errors"
            filterParams={filter.filterParams}
            testId="devices-errors"
            title="Errors"
            description="Crashes, ANRs, app hangs and non-fatal errors by device"
            columns={errorsColumns}
            hrefOf={(row) => linkTo("errors", deviceConditions(row))}
          />
          <DevicesTable
            list="launches"
            rankByPercentile
            filterParams={filter.filterParams}
            extra={{ launch_type: launchType }}
            testId="devices-launches"
            title="Launch Time"
            description="App launch time by device"
            controls={
              <TabSelect
                items={LAUNCH_TYPES.map((t) => t.label)}
                selected={
                  LAUNCH_TYPES.find((t) => t.value === launchType)!.label
                }
                onChangeSelected={(label) =>
                  setLaunchType(
                    LAUNCH_TYPES.find((t) => t.label === label)!.value,
                  )
                }
              />
            }
            columns={[
              ...durationColumns,
              { header: "Launches", cell: (row) => count(row.count) },
            ]}
            hrefOf={
              isAndroid
                ? (row) => linkTo("profiles", deviceConditions(row))
                : undefined
            }
          />
          {spanNamesQuery.status === "error" && (
            <p className="text-sm text-muted-foreground">
              Unable to load traces.
            </p>
          )}
          {spanNamesQuery.status === "success" && (
            <DevicesTable
              list="spans"
              rankByPercentile
              filterParams={filter.filterParams}
              extra={{ span_name: spanName ?? "" }}
              enabled={spanName !== null}
              testId="devices-spans"
              title="Traces"
              description={
                spanName === null
                  ? "No traces received for this app yet"
                  : "Duration of the selected trace by device"
              }
              controls={
                spanName !== null && (
                  <DropdownSelect
                    key={spanName}
                    type={DropdownSelectType.SingleString}
                    title="Trace"
                    items={spanNames}
                    initialSelected={spanName}
                    onChangeSelected={(item) =>
                      setPickedSpanName(item as string)
                    }
                  />
                )
              }
              columns={[
                ...durationColumns,
                { header: "Spans", cell: (row) => count(row.count) },
              ]}
              hrefOf={(row) =>
                spanName === null
                  ? undefined
                  : linkTo("traces", deviceConditions(row), {
                      [urlFiltersKeyMap.rootSpanName]: spanName,
                    })
              }
            />
          )}
          <DevicesTable
            list="memory"
            rankByPercentile
            filterParams={filter.filterParams}
            testId="devices-memory"
            title="Memory"
            description="Memory usage by device"
            columns={memoryColumns}
            hrefOf={(row) => linkTo("memory", deviceConditions(row))}
          />
        </div>
      )}
    </div>
  );
}
