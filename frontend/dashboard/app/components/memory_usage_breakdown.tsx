"use client";

import type { useMemoryUsageBreakdownQuery } from "@/app/query/hooks";
import { formatDeviceMemoryTier } from "../utils/device_memory_tiers";
import { formatMemoryKilobytes } from "../utils/number_utils";
import { SkeletonTable } from "./skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

export default function MemoryUsageBreakdown({
  query,
}: {
  query: ReturnType<typeof useMemoryUsageBreakdownQuery>;
}) {
  const { data, status } = query;

  return (
    <section data-testid="memory-breakdown" className="w-full font-body">
      {status === "pending" && (
        <div role="status" aria-label="Loading memory breakdown">
          <SkeletonTable rows={4} columns={5} />
        </div>
      )}
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
              <TableHead className="text-right">p50</TableHead>
              <TableHead className="text-right">p90</TableHead>
              <TableHead className="text-right">p95</TableHead>
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
                <TableRow
                  data-testid="memory-breakdown-row"
                  key={row.device_total_memory_tier}
                >
                  <TableCell>
                    {formatDeviceMemoryTier(row.device_total_memory_tier)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemoryKilobytes(row.p50)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemoryKilobytes(row.p90)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMemoryKilobytes(row.p95)}
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
