"use client";

import { emptySpansResponse } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar, {
  type FilterState,
  type ReadyFilterState,
  filterExprUrlKey,
} from "@/app/components/filter_bar/filter_bar";
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
import {
  paginationOffsetUrlKey,
  useSpanMetricsPlotQuery,
  useSpansQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import Link from "next/link";
import {
  type ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { use, useState } from "react";

const PAGINATION_LIMIT = 5;

const {
  appId: appIdUrlKey,
  dateRange: dateRangeUrlKey,
  startDate: startDateUrlKey,
  endDate: endDateUrlKey,
  rootSpanName: rootSpanNameUrlKey,
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
    rootSpanName: searchParams.get(rootSpanNameUrlKey),
  };
}

function buildFilterUrl(filter: ReadyFilterState, paginationOffset: number) {
  const urlParams = new URLSearchParams();
  urlParams.set(paginationOffsetUrlKey, String(paginationOffset));
  urlParams.set(appIdUrlKey, filter.app.id);
  urlParams.set(dateRangeUrlKey, filter.date.dateRange);
  urlParams.set(startDateUrlKey, filter.date.startDate);
  urlParams.set(endDateUrlKey, filter.date.endDate);
  if (filter.rootSpanName !== null) {
    urlParams.set(rootSpanNameUrlKey, filter.rootSpanName);
  }
  if (filter.filterExpr) {
    urlParams.set(filterExprUrlKey, filter.filterExpr);
  }
  return `?${urlParams.toString()}`;
}

export default function TracesOverview(props: {
  params: Promise<{ teamId: string }>;
}) {
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

  // The queries read the filter, the span name and the pagination offset
  // from the URL, so each fetch uses one searchParams snapshot. The filter
  // is null until the URL matches the bar's report. A span name or filter the
  // bar discarded is never fetched.
  const filterParams =
    filterState.status === "ready" &&
    requestedFilters.app === filterState.app.id &&
    requestedFilters.dateRange.startDate === filterState.date.startDate &&
    requestedFilters.dateRange.endDate === filterState.date.endDate &&
    requestedFilters.filterExpr === filterState.filterExpr &&
    requestedFilters.rootSpanName === filterState.rootSpanName
      ? {
          appId: requestedFilters.app,
          startDate: requestedFilters.dateRange.startDate,
          endDate: requestedFilters.dateRange.endDate,
          filterExpr: requestedFilters.filterExpr,
        }
      : null;
  const rootSpanName = requestedFilters.rootSpanName;

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

  const nextPage = () => navigateToOffset(paginationOffset + PAGINATION_LIMIT);
  const prevPage = () =>
    navigateToOffset(Math.max(0, paginationOffset - PAGINATION_LIMIT));

  const { data: spans = emptySpansResponse, status, isFetching } = spansQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        teamId={params.teamId}
        entity="spans"
        placeholder="Filter traces…"
        requestedAppId={requestedFilters.app}
        requestedDateRange={requestedFilters.dateRange}
        requestedFilterExpr={requestedFilters.filterExpr}
        filterExprIssues={filterExprIssues}
        showRootSpanSelector
        requestedRootSpanName={requestedFilters.rootSpanName}
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
