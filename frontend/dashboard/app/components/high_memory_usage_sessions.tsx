"use client";

import type { HighMemoryUsageSession } from "@/app/api/api_calls";
import type { useHighMemoryUsageSessionsQuery } from "@/app/query/hooks";
import { formatMemoryKilobytes } from "@/app/utils/number_utils";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
} from "@/app/utils/time_utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingBar from "./loading_bar";
import Paginator from "./paginator";
import { SkeletonTable } from "./skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

function formatSessionDetails(session: HighMemoryUsageSession) {
  const { attribute } = session;
  const device = [attribute.device_manufacturer, attribute.device_model]
    .filter(Boolean)
    .join(" ")
    .trim();
  return [
    `${attribute.app_version} (${attribute.app_build})`,
    `${attribute.os_name} ${attribute.os_version}`.trim(),
    device,
    attribute.device_total_memory > 0
      ? `${formatMemoryKilobytes(attribute.device_total_memory)} RAM`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function HighMemoryUsageSessions({
  teamId,
  query,
  onNext,
  onPrev,
}: {
  teamId: string;
  query: ReturnType<typeof useHighMemoryUsageSessionsQuery>;
  onNext: () => void;
  onPrev: () => void;
}) {
  const router = useRouter();
  const { data, status, isFetching } = query;
  const results = data?.results ?? [];

  return (
    <section data-testid="high-memory-sessions" className="w-full font-body">
      {status === "pending" && (
        <div role="status" aria-label="Loading high memory usage sessions">
          <SkeletonTable rows={5} columns={3} />
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-muted-foreground">
          Unable to load high memory usage sessions.
        </p>
      )}
      {status === "success" && (
        <>
          <div className="mb-2 flex justify-end">
            <Paginator
              prevEnabled={!isFetching && data.meta.previous}
              nextEnabled={!isFetching && data.meta.next}
              displayText=""
              onNext={onNext}
              onPrev={onPrev}
            />
          </div>
          <div
            className={`w-full py-3 ${isFetching ? "visible" : "invisible"}`}
          >
            <LoadingBar />
          </div>
          <Table className="font-display select-none">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[58%]">
                  Sessions with high memory usage
                </TableHead>
                <TableHead className="w-[22%] text-center">
                  Peak memory usage
                </TableHead>
                <TableHead className="w-[20%] text-center">
                  Start time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={3}
                    className="h-36 text-center text-sm text-muted-foreground"
                  >
                    No sessions found with high memory usage.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((session) => {
                  const href = `/${teamId}/session_replays/${session.app_id}/${session.session_id}`;
                  return (
                    <TableRow
                      key={session.session_id}
                      className="font-body"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <TableCell className="relative w-[58%] p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-label={`Session ID: ${session.session_id}`}
                        />
                        <div className="pointer-events-none p-4">
                          <p className="truncate">
                            Session ID: {session.session_id}
                          </p>
                          <div className="py-1" />
                          <p className="truncate text-xs text-muted-foreground">
                            {formatSessionDetails(session)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="relative w-[22%] p-0 text-center">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        <div className="pointer-events-none p-4">
                          <p>{formatMemoryKilobytes(session.peak_memory_kb)}</p>
                          {session.available_memory_at_peak_utilization_kb !=
                            null && (
                            <p className="text-xs text-muted-foreground">
                              {formatMemoryKilobytes(
                                session.available_memory_at_peak_utilization_kb,
                              )}{" "}
                              available at peak utilization
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {session.percent_of_target != null &&
                            session.target_memory_kb != null
                              ? `${Math.round(session.percent_of_target)}% of ${formatMemoryKilobytes(session.target_memory_kb)} target`
                              : session.peak_memory_limit_utilization != null
                                ? `${Math.round(session.peak_memory_limit_utilization * 100)}% of estimated app limit (peak)`
                                : "Threshold unavailable"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="relative w-[20%] p-0 text-center">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        <div className="pointer-events-none p-4">
                          <p>
                            {formatDateToHumanReadableDate(
                              session.first_event_time,
                            )}
                          </p>
                          <div className="py-1" />
                          <p className="text-xs">
                            {formatDateToHumanReadableTime(
                              session.first_event_time,
                            )}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </>
      )}
    </section>
  );
}
