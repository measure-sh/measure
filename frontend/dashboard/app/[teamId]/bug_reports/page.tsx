"use client";

import { emptyBugReportsOverviewResponse } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import BugReportsOverviewPlot from "@/app/components/bug_reports_overview_plot";
import FilterBar, {
  type FilterState,
  type ReadyFilterState,
  filterExprUrlKey,
} from "@/app/components/filter_bar/filter_bar";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import Pill, { PillType } from "@/app/components/pill";
import { SkeletonListPage } from "@/app/components/skeleton";
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
  useBugReportsOverviewPlotQuery,
  useBugReportsOverviewQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
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
  };
}

function buildFilterUrl(filter: ReadyFilterState, paginationOffset: number) {
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

export default function BugReportsOverview(props: {
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

  // The queries read the filter and the pagination offset from the URL, so
  // each fetch uses one searchParams snapshot. The filter is null until the
  // URL matches the bar's report. A filter the bar discarded is never fetched.
  const filterParams =
    filterState.status === "ready" &&
    requestedFilters.app === filterState.app.id &&
    requestedFilters.dateRange.startDate === filterState.date.startDate &&
    requestedFilters.dateRange.endDate === filterState.date.endDate &&
    requestedFilters.filterExpr === filterState.filterExpr
      ? {
          appId: requestedFilters.app,
          startDate: requestedFilters.dateRange.startDate,
          endDate: requestedFilters.dateRange.endDate,
          filterExpr: requestedFilters.filterExpr,
        }
      : null;

  const bugReportsQuery = useBugReportsOverviewQuery(
    filterParams,
    paginationOffset,
  );
  const bugReportsPlotQuery = useBugReportsOverviewPlotQuery(filterParams);

  const filterExprIssues =
    filterExprIssuesIn(bugReportsQuery.error) ??
    filterExprIssuesIn(bugReportsPlotQuery.error);

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

  const {
    data: bugReportsOverview = emptyBugReportsOverviewResponse,
    status,
    isFetching,
  } = bugReportsQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        teamId={params.teamId}
        entity="bug_reports"
        placeholder="Filter bug reports…"
        requestedAppId={requestedFilters.app}
        requestedDateRange={requestedFilters.dateRange}
        requestedFilterExpr={requestedFilters.filterExpr}
        filterExprIssues={filterExprIssues}
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
            Error fetching list of bug reports, please change filters, refresh
            page or select a different app to try again
          </p>
        )}

      {readyFilter !== null &&
        (status === "success" || status === "pending") && (
          <div className="flex flex-col items-center w-full">
            <BugReportsOverviewPlot
              startDate={readyFilter.date.startDate}
              endDate={readyFilter.date.endDate}
              query={bugReportsPlotQuery}
            />
            <div className="self-end">
              <Paginator
                prevEnabled={
                  isFetching ? false : bugReportsOverview.meta.previous
                }
                nextEnabled={isFetching ? false : bugReportsOverview.meta.next}
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
                  <TableHead className="w-[60%]">Bug Report</TableHead>
                  <TableHead className="w-[20%] text-center">Time</TableHead>
                  <TableHead className="w-[20%] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugReportsOverview.results?.map(
                  (
                    {
                      event_id,
                      description,
                      status,
                      app_id,
                      timestamp,
                      attribute,
                    }: any,
                    idx: number,
                  ) => {
                    const bugReportHref = `/${params.teamId}/bug_reports/${app_id}/${event_id}`;
                    return (
                      <TableRow
                        key={`${idx}-${event_id}`}
                        data-testid="bug-report-row"
                        className="font-body"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(bugReportHref);
                          }
                        }}
                      >
                        <TableCell className="w-[60%] relative p-0">
                          <Link
                            href={bugReportHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-label={`ID: ${event_id}`}
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate text-xs text-muted-foreground select-none">
                              ID: {event_id}
                            </p>
                            <div className="py-1" />
                            <p
                              data-testid="bug-report-row-description"
                              className="truncate select-none"
                            >
                              {description ? description : "No Description"}
                            </p>
                            <div className="py-1" />
                            <p className="text-xs truncate text-muted-foreground select-none">
                              {attribute.app_version +
                                "(" +
                                attribute.app_build +
                                "), " +
                                (attribute.os_name === "android"
                                  ? "Android API Level"
                                  : attribute.os_name === "ios"
                                    ? "iOS"
                                    : attribute.os_name === "ipados"
                                      ? "iPadOS"
                                      : attribute.os_name) +
                                " " +
                                attribute.os_version +
                                ", " +
                                attribute.device_manufacturer +
                                " " +
                                attribute.device_model}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-center relative p-0">
                          <Link
                            href={bugReportHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate select-none">
                              {formatDateToHumanReadableDate(timestamp)}
                            </p>
                            <div className="py-1" />
                            <p className="text-xs truncate select-none">
                              {formatDateToHumanReadableTime(timestamp)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-center relative p-0">
                          <Link
                            href={bugReportHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4 items-center flex justify-center">
                            <Pill
                              type={
                                status === 0
                                  ? PillType.OpenStatus
                                  : PillType.ClosedStatus
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
