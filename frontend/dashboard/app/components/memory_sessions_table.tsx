"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MemorySessionRow } from "../api/api_calls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
} from "../utils/time_utils";

interface MemorySessionsTableProps {
  teamId: string;
  appId: string;
  sessions: MemorySessionRow[];
}

// Same Google Play RAM tier boundaries the backend's session_ram_tier filter
// key buckets device_total_memory_kb by (backend/libs/exprfilter/sessions.go).
function ramTierLabel(totalMemoryKB: number | null): string | null {
  if (totalMemoryKB === null) return null;
  if (totalMemoryKB < 3_276_800) return "0–4 GB";
  if (totalMemoryKB < 4_915_200) return "4 GB";
  if (totalMemoryKB < 6_963_200) return "6 GB";
  if (totalMemoryKB < 9_437_184) return "8 GB";
  if (totalMemoryKB < 14_680_064) return "12 GB";
  if (totalMemoryKB < 18_874_368) return "16 GB";
  return "16 GB+";
}

export default function MemorySessionsTable({
  teamId,
  appId,
  sessions,
}: MemorySessionsTableProps) {
  const router = useRouter();

  if (sessions.length === 0) {
    return (
      <p className="font-body text-sm">
        No data available for the selected filters
      </p>
    );
  }

  return (
    <Table className="font-display select-none">
      <TableHeader className="hover:bg-muted/50">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[45%]">Session</TableHead>
          <TableHead className="w-[25%]">Device</TableHead>
          <TableHead className="w-[15%] text-center">
            % of Device RAM (P90)
          </TableHead>
          <TableHead className="w-[15%] text-center">Start Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          const sessionHref = `/${teamId}/session_replays/${appId}/${session.session_id}`;
          const osLabel =
            session.os_name === "android" ? "Android API Level" : "iOS";
          const ramTier = ramTierLabel(session.device_total_memory_kb);
          return (
            <TableRow
              key={session.session_id}
              data-testid="memory-session-row"
              className="font-body"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(sessionHref);
                }
              }}
            >
              <TableCell className="w-[45%] relative p-0">
                <Link
                  href={sessionHref}
                  className="absolute inset-0 z-10 cursor-pointer"
                  tabIndex={-1}
                  aria-label={`Session ID: ${session.session_id}`}
                  style={{ display: "block" }}
                />
                <div className="pointer-events-none p-4">
                  <p className="truncate select-none">
                    Session ID: {session.session_id}
                  </p>
                  <div className="py-1" />
                  <p className="text-xs truncate text-muted-foreground select-none">
                    {session.app_version}({session.app_build}), {osLabel}{" "}
                    {session.os_version}
                  </p>
                </div>
              </TableCell>
              <TableCell className="w-[25%] relative p-0">
                <Link
                  href={sessionHref}
                  className="absolute inset-0 z-10 cursor-pointer"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ display: "block" }}
                />
                <div className="pointer-events-none p-4">
                  <p className="truncate select-none">
                    {session.device_manufacturer} {session.device_model}
                  </p>
                  {ramTier && (
                    <>
                      <div className="py-1" />
                      <p
                        data-testid="memory-session-ram-tier"
                        className="text-xs truncate text-muted-foreground select-none"
                      >
                        {ramTier}
                      </p>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-[15%] text-center relative p-0">
                <Link
                  href={sessionHref}
                  className="absolute inset-0 z-10 cursor-pointer"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ display: "block" }}
                />
                <div className="pointer-events-none p-4">
                  <p className="select-none">
                    {session.device_total_memory_kb
                      ? `${(session.ram_usage_ratio * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                  <div className="py-1" />
                  <p className="text-xs text-muted-foreground select-none">
                    {Math.round(session.peak_memory_kb / 1024)} MB
                  </p>
                </div>
              </TableCell>
              <TableCell className="w-[15%] text-center relative p-0">
                <Link
                  href={sessionHref}
                  className="absolute inset-0 z-10 cursor-pointer"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ display: "block" }}
                />
                <div className="pointer-events-none p-4">
                  {session.start_time ? (
                    <>
                      <p className="truncate select-none">
                        {formatDateToHumanReadableDate(session.start_time)}
                      </p>
                      <div className="py-1" />
                      <p className="text-xs truncate select-none">
                        {formatDateToHumanReadableTime(session.start_time)}
                      </p>
                    </>
                  ) : (
                    "N/A"
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
