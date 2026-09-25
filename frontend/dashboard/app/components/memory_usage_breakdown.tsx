"use client";

import type { useMemoryUsageBreakdownQuery } from "@/app/query/hooks";
import { MemoryStick } from "lucide-react";
import { formatMemoryKilobytes } from "../utils/number_utils";
import EmptyState from "./empty_state";
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
      <p className="font-display text-xl">Memory by Device</p>
      <div className="py-2" />
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
      {status === "success" && !data?.length && (
        <EmptyState
          icon={MemoryStick}
          title="No memory samples found"
          description="Try a wider time range or different filters"
          className="h-48"
        />
      )}
      {status === "success" && !!data?.length && (
        <Table className="font-display">
          <TableHeader>
            <TableRow>
              <TableHead>Device total memory</TableHead>
              <TableHead className="text-center">p50</TableHead>
              <TableHead className="text-center">p90</TableHead>
              <TableHead className="text-center">p95</TableHead>
              <TableHead className="text-center">Sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-body tabular-nums">
            {data.map((row) => (
              <TableRow
                data-testid="memory-breakdown-row"
                key={row.device_total_memory_tier}
              >
                <TableCell>{row.device_total_memory_tier}</TableCell>
                <TableCell className="text-center">
                  {formatMemoryKilobytes(row.p50)}
                </TableCell>
                <TableCell className="text-center">
                  {formatMemoryKilobytes(row.p90)}
                </TableCell>
                <TableCell className="text-center">
                  {formatMemoryKilobytes(row.p95)}
                </TableCell>
                <TableCell className="text-center">
                  {row.session_count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
