"use client";

import { emptySessionReplayOverviewResponse } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import SessionReplayOverviewPlot from "@/app/components/session_replay_overview_plot";
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
  useSessionReplayOverviewPlotQuery,
  useSessionReplayOverviewQuery,
} from "@/app/query/hooks";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

const PAGINATION_LIMIT = 5;

export default function SessionReplayOverview(props: {
  params: Promise<{ teamId: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();

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
    teamId: params.teamId,
    entity: "sessions",
    paginationLimit: PAGINATION_LIMIT,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const sessionsQuery = useSessionReplayOverviewQuery(
    filterParams,
    paginationOffset,
  );
  const sessionsPlotQuery = useSessionReplayOverviewPlotQuery(filterParams);

  const filterExprIssues =
    filterExprIssuesIn(sessionsQuery.error) ??
    filterExprIssuesIn(sessionsPlotQuery.error);

  const {
    data: sessionsOverview = emptySessionReplayOverviewResponse,
    status,
    isFetching,
  } = sessionsQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="sessions"
        teamId={params.teamId}
        placeholder="Filter sessions…"
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
            Error fetching list of sessions, please change filters, refresh page
            or select a different app to try again
          </p>
        )}

      {readyValue !== null &&
        (status === "success" || status === "pending") && (
          <div className="flex flex-col items-center w-full">
            <SessionReplayOverviewPlot
              startDate={readyValue.date.startDate}
              endDate={readyValue.date.endDate}
              query={sessionsPlotQuery}
            />
            <div className="self-end">
              <Paginator
                prevEnabled={
                  isFetching ? false : sessionsOverview.meta.previous
                }
                nextEnabled={isFetching ? false : sessionsOverview.meta.next}
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
              <TableHeader className="hover:bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[60%]">Session Replay</TableHead>
                  <TableHead className="w-[20%] text-center">
                    Start Time
                  </TableHead>
                  <TableHead className="w-[20%] text-center">
                    Duration
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsOverview.results?.map(
                  (
                    {
                      session_id,
                      app_id,
                      first_event_time,
                      duration,
                      attribute,
                    }: any,
                    idx: number,
                  ) => {
                    const sessionHref = `/${params.teamId}/session_replays/${app_id}/${session_id}`;
                    return (
                      <TableRow
                        key={`${idx}-${session_id}`}
                        className="font-body"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(sessionHref);
                          }
                        }}
                      >
                        <TableCell className="w-[60%] relative p-0">
                          <Link
                            href={sessionHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-label={`Session ID: ${session_id}`}
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate select-none">
                              Session ID: {session_id}
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
                            href={sessionHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            <p className="truncate select-none">
                              {formatDateToHumanReadableDate(first_event_time)}
                            </p>
                            <div className="py-1" />
                            <p className="text-xs truncate select-none">
                              {formatDateToHumanReadableTime(first_event_time)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                          <Link
                            href={sessionHref}
                            className="absolute inset-0 z-10 cursor-pointer"
                            tabIndex={-1}
                            aria-hidden="true"
                            style={{ display: "block" }}
                          />
                          <div className="pointer-events-none p-4">
                            {(duration as unknown as number) === 0
                              ? "N/A"
                              : formatMillisToHumanReadable(
                                  duration as unknown as number,
                                )}
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
