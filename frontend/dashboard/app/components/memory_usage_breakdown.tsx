"use client";

import type { useMemoryUsageBreakdownQuery } from "@/app/query/hooks";
import { formatDeviceMemoryTier } from "../utils/device_memory_tiers";
import LoadingBar from "./loading_bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

function formatMemory(value: number | null) {
  if (value === null) return "—";
  const mb = value / 1024;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function MemoryUsageBreakdown({
  query,
}: {
  query: ReturnType<typeof useMemoryUsageBreakdownQuery>;
}) {
  const { data, status } = query;

  return (
    <section className="w-full font-body">
      <h2 className="mb-2 font-display text-xl">Breakdown</h2>
      {status === "pending" && <LoadingBar />}
      {status === "error" && (
        <p className="text-sm text-muted-foreground">
          Unable to load memory breakdown.
        </p>
      )}
      {status === "success" && (
        <Table className="font-display">
          <TableHeader>
            <TableRow>
              <TableHead>Device total memory</TableHead>
              <TableHead className="text-right">P50</TableHead>
              <TableHead className="text-right">P90</TableHead>
              <TableHead className="text-right">P95</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-body tabular-nums">
            {!data?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-36 text-center text-sm">
                  No memory samples found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.device_total_memory_tier}>
                  <TableCell>
                    {formatDeviceMemoryTier(row.device_total_memory_tier)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemory(row.p50)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemory(row.p90)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemory(row.p95)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.session_count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
