"use client";

import type { MemoryUsageBreakdownPoint } from "@/app/api/api_calls";
import type { useMemoryUsageBreakdownQuery } from "@/app/query/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const RAM_TIERS = [
  "0-3gb",
  "4-5gb",
  "6-7gb",
  "8-11gb",
  "12-15gb",
  "16-31gb",
  "32-63gb",
  "64gb+",
  "unknown",
] as const;

const RAM_TIER_LABELS: Record<(typeof RAM_TIERS)[number], string> = {
  "0-3gb": "0–3 GB",
  "4-5gb": "4–5 GB",
  "6-7gb": "6–7 GB",
  "8-11gb": "8–11 GB",
  "12-15gb": "12–15 GB",
  "16-31gb": "16–31 GB",
  "32-63gb": "32–63 GB",
  "64gb+": "64 GB+",
  unknown: "Unknown",
};

// These are the Play app thresholds associated with the lower tier boundary.
// Larger tiers have no defined Play threshold and remain uncolored.
const P90_THRESHOLDS_KIB: Partial<Record<(typeof RAM_TIERS)[number], number>> =
  {
    "4-5gb": 2 * 1024 * 1024,
    "6-7gb": 2.25 * 1024 * 1024,
    "8-11gb": 2.25 * 1024 * 1024,
    "12-15gb": 3.25 * 1024 * 1024,
    "16-31gb": 4.25 * 1024 * 1024,
  };

function formatMemory(value: number | null) {
  if (value === null) return "—";
  const mb = value / 1024;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function p90Class(tier: string, p90: number | null) {
  const threshold = P90_THRESHOLDS_KIB[tier as (typeof RAM_TIERS)[number]];
  if (p90 === null || threshold === undefined) return "";
  if (p90 >= threshold) return "text-red-400";
  if (p90 >= threshold * 0.8) return "text-yellow-400";
  return "";
}

export default function MemoryUsageBreakdown({
  query,
}: {
  query: ReturnType<typeof useMemoryUsageBreakdownQuery>;
}) {
  const { data, status } = query;
  if (status === "pending") return null;
  if (status === "error") {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load memory breakdown.
      </p>
    );
  }

  const byTier = new Map((data ?? []).map((point) => [point.ram_tier, point]));
  const populatedTiers = RAM_TIERS.filter((tier) => {
    const point = byTier.get(tier);
    return point !== undefined && point.session_count > 0;
  });
  return (
    <section className="w-full font-body">
      <h2 className="mb-4 font-display text-xl">
        Breakdown by device total memory
      </h2>
      <Table className="font-display select-none">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28%]">Device total memory</TableHead>
            <TableHead className="w-[14%] text-right">P50</TableHead>
            <TableHead className="w-[14%] text-right">P90</TableHead>
            <TableHead className="w-[14%] text-right">P95</TableHead>
            <TableHead className="w-[14%] text-right">P99</TableHead>
            <TableHead className="w-[16%] text-right">Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="font-body">
          {populatedTiers.map((tier) => {
            const point = byTier.get(tier) as MemoryUsageBreakdownPoint;
            return (
              <TableRow key={tier}>
                <TableCell className="w-[28%]">
                  {RAM_TIER_LABELS[tier]}
                </TableCell>
                <TableCell className="w-[14%] text-right">
                  {formatMemory(point.p50)}
                </TableCell>
                <TableCell
                  className={`w-[14%] text-right ${p90Class(tier, point.p90)}`}
                >
                  {formatMemory(point.p90)}
                </TableCell>
                <TableCell className="w-[14%] text-right">
                  {formatMemory(point.p95)}
                </TableCell>
                <TableCell className="w-[14%] text-right">
                  {formatMemory(point.p99)}
                </TableCell>
                <TableCell className="w-[16%] text-right">
                  {point.session_count}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
