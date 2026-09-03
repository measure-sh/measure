"use client";

import { emptySpansResponse } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import Pill, { PillType } from "@/app/components/pill";
import { SkeletonListPage } from "@/app/components/skeleton";
import SpanMetricsPlot from "@/app/components/span_metrics_plot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { useSpanMetricsPlotQuery, useSpansQuery } from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

const PAGINATION_LIMIT = 5;

export default function TracesOverview(props: {
  params: Promise<{ teamId: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();

  const {
    requestedFilters,
    paginationOffset,
    filterState,
    filterParams,
    onRequestChange,
    onFilterChange,
    nextPage,
    prevPage,
  } = useExprFilterPage({
    paginationLimit: PAGINATION_LIMIT,
    extraUrlKeys: { rootSpanName: urlFiltersKeyMap.rootSpanName },
  });
  const readyFilter = filterState.status === "ready" ? filterState : null;
  const rootSpanName = readyFilter?.rootSpanName ?? null;

  const spansQuery = useSpansQuery(
    filterParams,
    rootSpanName,
    paginationOffset,
  );
  const spanMetricsPlotQuery = useSpanMetricsPlotQuery(
    filterParams,
    rootSpanName,
  );

  const filterExprIssues =
    filterExprIssuesIn(spansQuery.error) ??
    filterExprIssuesIn(spanMetricsPlotQuery.error);

  const { data: spans = emptySpansResponse, status, isFetching } = spansQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        teamId={params.teamId}
        entity="spans"
        placeholder="Filter traces…"
        requestedAppId={requestedFilters.appId}
        requestedDateRange={requestedFilters.dateRange}
        requestedFilterExpr={requestedFilters.filterExpr}
        filterExprIssues={filterExprIssues}
        showRootSpanSelector
        requestedRootSpanName={requestedFilters.rootSpanName}
        onRequestChange={onRequestChange}
        onFilterChange={onFilterChange}
      />
      <div className="py-4" />

      {filterState.status === "error" && (
        <p className="text-lg font-display">{filterState.message}</p>
      )}

      {filterState.status === "pending" && <SkeletonListPage />}

      {readyFilter !== null &&
        status === "error" &&
        filterExprIssues === null && (
          <p className="text-lg font-display">
            Error fetching list of traces, please change filters, refresh page
            or select a different app to try again
          </p>
        )}

      {readyFilter !== null &&
        (status === "success" || status === "pending") && (
          <div className="flex flex-col items-center w-full">
            <SpanMetricsPlot
              startDate={readyFilter.date.startDate}
              endDate={readyFilter.date.endDate}
              query={spanMetricsPlotQuery}
            />
            <div className="self-end">
              <Paginator
                prevEnabled={isFetching ? false : spans.meta.previous}
                nextEnabled={isFetching ? false : spans.meta.next}
                displayText=""
                onNext={nextPage}
                onPrev={prevPage}
              />
            </div>

            <div
              className={`py-4 w-full ${isFetching ? "visible" : "invisible"}`}
            >
              <LoadingBar />
            </div>
            <Table className="font-display select-none">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">Trace</TableHead>
                  <TableHead className="w-[20%] text-center">
                    Start Time
                  </TableHead>
                  <TableHead className="w-[10%] text-center">
                    Duration
                  </TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-body">
                {spans.results?.map(
                  (
                    {
                      app_id,
                      span_name,
                      span_id,
                      trace_id,
                      status,
                      start_time,
                      duration,
                      app_version,
                      app_build,
                      os_name,
                      os_version,
                      device_manufacturer,
                      device_model,
                    }: any,
                    idx: number,
                  ) => {
                    const traceHref = `/${params.teamId}/traces/${app_id}/${trace_id}`;
                    return (
                      <TableRow
                        key={`${idx}-${span_id}`}
                        className="font-body select-none"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(traceHref);
                          }
                        }}
                      >
                        <TableCell className="w-[60%] relative p-0">
                          <Link
                            href={traceHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-label={`ID: ${trace_id}`}
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="text-xs truncate text-muted-foreground select-none">
                              ID: {trace_id}
                            </p>
                            <div className="py-1" />
                            <p className="truncate select-none">{span_name}</p>
                            <div className="py-1" />
                            <p className="text-xs truncate text-muted-foreground select-none">{`${app_version}(${app_build}), ${os_name === "android" ? "Android API Level" : os_name === "ios" ? "iOS" : os_name === "ipados" ? "iPadOS" : os_name} ${os_version}, ${device_manufacturer} ${device_model}`}</p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-center relative p-0">
                          <Link
                            href={traceHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate select-none">
                              {formatDateToHumanReadableDate(start_time)}
                            </p>
                            <div className="py-1" />
                            <p className="text-xs truncate select-none">
                              {formatDateToHumanReadableTime(start_time)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[10%] text-center truncate select-none relative p-0">
                          <Link
                            href={traceHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            {formatMillisToHumanReadable(duration)}
                          </div>
                        </TableCell>
                        <TableCell className="w-[10%] text-center truncate select-none relative p-0">
                          <Link
                            href={traceHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4 flex justify-center">
                            <Pill
                              type={
                                status === 1
                                  ? PillType.StatusOkay
                                  : status === 2
                                    ? PillType.StatusError
                                    : PillType.StatusUnset
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
