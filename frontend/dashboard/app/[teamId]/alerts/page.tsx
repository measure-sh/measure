"use client";

import { emptyAlertsOverviewResponse } from "@/app/api/api_calls";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import { SkeletonListPage } from "@/app/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { useAlertsOverviewQuery } from "@/app/query/hooks";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
} from "@/app/utils/time_utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

const PAGINATION_LIMIT = 5;

export default function AlertsOverview(props: {
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
    entity: "alerts",
    paginationLimit: PAGINATION_LIMIT,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const {
    data: alertsOverview = emptyAlertsOverviewResponse,
    status,
    isFetching,
  } = useAlertsOverviewQuery(filterParams, paginationOffset);

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="alerts"
        teamId={params.teamId}
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        showFilterExpr={false}
        status={filterStatus}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && (
        <SkeletonListPage showPlot={false} tableColumns={2} />
      )}

      {readyValue !== null && status === "error" && (
        <p className="text-lg font-display">
          Error fetching list of alerts, please change filters, refresh page or
          select a different app to try again
        </p>
      )}

      {readyValue !== null && status !== "error" && (
        <div className="flex flex-col items-center w-full">
          <div className="self-end">
            <Paginator
              prevEnabled={isFetching ? false : alertsOverview.meta.previous}
              nextEnabled={isFetching ? false : alertsOverview.meta.next}
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
                <TableHead className="w-[60%]">Alert</TableHead>
                <TableHead className="w-[20%] text-center">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsOverview.results?.map(
                (
                  {
                    id,
                    team_id,
                    app_id,
                    entity_id,
                    type,
                    message,
                    url,
                    created_at,
                    updated_at,
                  }: any,
                  idx: number,
                ) => {
                  return (
                    <TableRow
                      key={`${idx}-${id}`}
                      className="font-body select-none"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(url);
                        }
                      }}
                    >
                      <TableCell className="w-[60%] relative p-0">
                        <Link
                          href={url}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-label={`ID: ${id}`}
                          style={{ display: "block" }}
                        />
                        <div className="pointer-events-none p-4">
                          <p className="truncate text-xs text-muted-foreground select-none">
                            ID: {id}
                          </p>
                          <div className="py-1" />
                          <p className="truncate select-none">{message}</p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] text-center relative p-0">
                        <Link
                          href={url}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-hidden="true"
                          style={{ display: "block" }}
                        />
                        <div className="pointer-events-none p-4">
                          <p className="truncate select-none">
                            {formatDateToHumanReadableDate(created_at)}
                          </p>
                          <div className="py-1" />
                          <p className="text-xs truncate select-none">
                            {formatDateToHumanReadableTime(created_at)}
                          </p>
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
