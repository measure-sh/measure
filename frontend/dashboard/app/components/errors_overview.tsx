"use client";

import { emptyErrorsOverviewResponse } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import {
  useErrorsOverviewPlotQuery,
  useErrorsOverviewQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import { numberToKMB } from "@/app/utils/number_utils";
import { ResponsiveBarCanvas } from "@nivo/bar";
import { DateTime } from "luxon";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { formatPlotTooltipDate, PlotTimeGroup } from "../utils/time_utils";
import ErrorsOverviewPlot from "./errors_overview_plot";
import LoadingBar from "./loading_bar";
import Paginator from "./paginator";
import Pill, { PillType } from "./pill";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import { SkeletonListPage } from "./skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const PAGINATION_LIMIT = 5;

const {
  dateRange: dateRangeUrlKey,
  startDate: startDateUrlKey,
  endDate: endDateUrlKey,
} = urlFiltersKeyMap;

interface ErrorsOverviewProps {
  teamId: string;
}

function groupTitle(fileName: string, methodName: string): string {
  const file = fileName !== "" ? fileName : "unknown_file";
  const method = methodName !== "" ? methodName : "unknown_method";
  const complete = method.endsWith(")") || method.endsWith("]");
  return `${file}: ${method}${complete ? "" : "()"}`;
}

const RowLinkCell: React.FC<{
  href: string;
  className: string;
  children: React.ReactNode;
}> = ({ href, className, children }) => (
  <TableCell className={`${className} select-none relative p-0`}>
    <Link
      href={href}
      className="absolute inset-0 z-10 cursor-pointer"
      tabIndex={-1}
      aria-hidden="true"
      style={{ display: "block" }}
    />
    <div className="pointer-events-none p-4">{children}</div>
  </TableCell>
);

export const ErrorsOverview: React.FC<ErrorsOverviewProps> = ({ teamId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const trendColor = theme === "dark" ? "#a1a1a1" : "#a3a3a3";

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
  } = useFilterPage({
    teamId,
    entity: "errors",
    paginationLimit: PAGINATION_LIMIT,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const errorsQuery = useErrorsOverviewQuery(filterParams, paginationOffset);
  const errorsPlotQuery = useErrorsOverviewPlotQuery(filterParams);

  const filterExprIssues =
    filterExprIssuesIn(errorsQuery.error) ??
    filterExprIssuesIn(errorsPlotQuery.error);

  const {
    data: errorsOverview = emptyErrorsOverviewResponse,
    status,
    isFetching,
  } = errorsQuery;
  const listEmpty =
    status === "success" &&
    paginationOffset === 0 &&
    (errorsOverview.results?.length ?? 0) === 0;

  // Detail links keep the date range the list was read under.
  const d = searchParams.get(dateRangeUrlKey);
  const sd = searchParams.get(startDateUrlKey);
  const ed = searchParams.get(endDateUrlKey);
  const detailQuery = [
    d ? `${dateRangeUrlKey}=${encodeURIComponent(d)}` : null,
    sd ? `${startDateUrlKey}=${encodeURIComponent(sd)}` : null,
    ed ? `${endDateUrlKey}=${encodeURIComponent(ed)}` : null,
  ]
    .filter(Boolean)
    .join("&");

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="errors"
        teamId={teamId}
        placeholder="Filter errors…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        status={filterStatus}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && <SkeletonListPage />}

      {readyValue !== null &&
        status === "error" &&
        filterExprIssues === null && (
          <p className="text-lg font-display">
            Error fetching list of errors, please change filters, refresh page
            or select a different app to try again
          </p>
        )}

      {readyValue !== null &&
        (status === "success" || status === "pending") && (
          <div className="flex flex-col items-center w-full">
            <ErrorsOverviewPlot
              startDate={readyValue.date.startDate}
              endDate={readyValue.date.endDate}
              query={errorsPlotQuery}
            />
            {!listEmpty && (
              <>
                <div className="self-end">
                  <Paginator
                    prevEnabled={
                      isFetching ? false : errorsOverview.meta.previous
                    }
                    nextEnabled={isFetching ? false : errorsOverview.meta.next}
                    displayText=""
                    onNext={nextPage}
                    onPrev={prevPage}
                  />
                </div>
                <div
                  className={`py-1 w-full ${isFetching ? "visible" : "invisible"}`}
                >
                  <LoadingBar />
                </div>
                <div className="py-4" />
                <Table className="font-display select-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Error</TableHead>
                      <TableHead className="w-[12%] text-center">
                        Last seen
                      </TableHead>
                      <TableHead className="w-[18%] text-center">
                        Trend
                      </TableHead>
                      <TableHead className="w-[10%] text-center">
                        Instances
                      </TableHead>
                      <TableHead className="w-[10%] text-center">
                        Sessions
                      </TableHead>
                      <TableHead className="w-[10%] text-center">
                        Users
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorsOverview.results?.map(
                      (
                        {
                          id,
                          type,
                          error_type,
                          severity,
                          message,
                          method_name,
                          file_name,
                          count,
                          users,
                          sessions,
                          last_seen,
                          trend,
                        }: any,
                        idx: number,
                      ) => {
                        const groupName =
                          type + (file_name !== "" ? "@" + file_name : "");
                        const basePath = `/${teamId}/errors/${readyValue.app.id}/${id}/${encodeURIComponent(groupName)}`;
                        const href = detailQuery
                          ? `${basePath}?${detailQuery}`
                          : basePath;
                        return (
                          <TableRow
                            key={`${idx}-${id}`}
                            data-testid="exception-row"
                            className="font-body"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(href);
                              }
                            }}
                          >
                            <TableCell className="w-[40%] relative p-0">
                              <Link
                                href={href}
                                className="absolute inset-0 z-10 cursor-pointer"
                                tabIndex={-1}
                                aria-label={groupTitle(file_name, method_name)}
                                style={{ display: "block" }}
                              />
                              <div className="pointer-events-none p-4">
                                <p className="truncate select-none">
                                  {groupTitle(file_name, method_name)}
                                </p>

                                <p
                                  data-testid="exception-row-type"
                                  className="text-xs truncate text-muted-foreground mt-0.5 select-none"
                                >
                                  {`${type}${message ? `:${message}` : ""}`}
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-3">
                                  {error_type === "anr" && (
                                    <Pill type={PillType.Anr} />
                                  )}
                                  {error_type === "exception" && (
                                    <Pill
                                      type={
                                        severity === "fatal"
                                          ? PillType.Crash
                                          : PillType.Error
                                      }
                                    />
                                  )}
                                  {severity === "fatal" && (
                                    <Pill type={PillType.Fatal} />
                                  )}
                                  {severity === "unhandled" && (
                                    <Pill type={PillType.Unhandled} />
                                  )}
                                  {severity === "handled" && (
                                    <Pill type={PillType.Handled} />
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <RowLinkCell
                              href={href}
                              className="w-[12%] text-center truncate"
                            >
                              <span data-testid="exception-row-last-seen">
                                {DateTime.fromISO(last_seen) >= DateTime.now()
                                  ? "just now"
                                  : DateTime.fromISO(last_seen).toRelative()}
                              </span>
                            </RowLinkCell>
                            <RowLinkCell href={href} className="w-[18%]">
                              {/* The chart is raised above the row link so hovering a
                                  bar shows its tooltip, and a click on it opens the
                                  error like the rest of the row. */}
                              <div
                                data-testid="exception-row-trend"
                                className="relative z-20 pointer-events-auto cursor-pointer w-full h-4 border-b border-border"
                                onClick={() => router.push(href)}
                              >
                                <ResponsiveBarCanvas
                                  data={trend ?? []}
                                  keys={["instances"]}
                                  indexBy="datetime"
                                  colors={[trendColor]}
                                  margin={{
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                  }}
                                  padding={0.2}
                                  valueScale={{ type: "linear", min: 0 }}
                                  axisTop={null}
                                  axisRight={null}
                                  axisBottom={null}
                                  axisLeft={null}
                                  enableGridY={false}
                                  enableLabel={false}
                                  tooltip={({ data }) => (
                                    <PlotTooltipShell>
                                      <p className="p-2">
                                        Date:{" "}
                                        {formatPlotTooltipDate(
                                          data.datetime.toString(),
                                          errorsOverview.meta
                                            .plot_time_group as PlotTimeGroup,
                                        )}
                                      </p>
                                      <div className="flex flex-row items-center p-2">
                                        <PlotTooltipSwatch color={trendColor} />
                                        <span className="px-2">
                                          {data.instances.toLocaleString()}{" "}
                                          {data.instances === 1
                                            ? "instance"
                                            : "instances"}
                                        </span>
                                      </div>
                                    </PlotTooltipShell>
                                  )}
                                />
                              </div>
                            </RowLinkCell>
                            <RowLinkCell
                              href={href}
                              className="w-[10%] text-center truncate"
                            >
                              <span data-testid="exception-row-instances">
                                {numberToKMB(count)}
                              </span>
                            </RowLinkCell>
                            <RowLinkCell
                              href={href}
                              className="w-[10%] text-center truncate"
                            >
                              <span data-testid="exception-row-sessions">
                                {numberToKMB(sessions)}
                              </span>
                            </RowLinkCell>
                            <RowLinkCell
                              href={href}
                              className="w-[10%] text-center truncate"
                            >
                              <span data-testid="exception-row-users">
                                {users === 0 ? "–" : numberToKMB(users)}
                              </span>
                            </RowLinkCell>
                          </TableRow>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}
    </div>
  );
};
