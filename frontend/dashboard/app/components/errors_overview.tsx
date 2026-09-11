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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import ErrorsOverviewPlot from "./errors_overview_plot";
import LoadingBar from "./loading_bar";
import Paginator from "./paginator";
import Pill, { PillType } from "./pill";
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

export const ErrorsOverview: React.FC<ErrorsOverviewProps> = ({ teamId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

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
            <div className="self-end">
              <Paginator
                prevEnabled={isFetching ? false : errorsOverview.meta.previous}
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
                  <TableHead className="w-[60%]">Error</TableHead>
                  <TableHead className="w-[20%] text-center">
                    Instances
                  </TableHead>
                  <TableHead className="w-[20%] text-center">
                    Percentage contribution
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
                      percentage_contribution,
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
                        <TableCell className="w-[60%] relative p-0">
                          <Link
                            href={href}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-label={`${file_name !== "" ? file_name : "unknown_file"}: ${method_name !== "" ? method_name : "unknown_method"}()`}
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate select-none">
                              {(file_name !== "" ? file_name : "unknown_file") +
                                ": " +
                                (method_name !== ""
                                  ? method_name
                                  : "unknown_method") +
                                "()"}
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
                        <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                          <Link
                            href={href}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div
                            data-testid="exception-row-instances"
                            className="pointer-events-none p-4"
                          >
                            {count}
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                          <Link
                            href={href}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            {percentage_contribution}%
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
};
