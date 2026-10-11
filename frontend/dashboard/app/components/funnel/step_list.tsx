"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { urlFiltersKeyMap } from "../../stores/filters_store";
import { formatShare } from "./format";
import { numberToKMB } from "../../utils/number_utils";
import { formatMillisToHumanReadable } from "../../utils/time_utils";
import EmptyState from "../empty_state";
import LoadingBar from "../loading_bar";
import RowLinkCell from "../row_link_cell";
import { SkeletonTable } from "../skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../table";

export type StepListQuery<Data> = Pick<
  UseQueryResult<Data>,
  "data" | "status" | "isFetching"
>;

// The users that did the previous step, split into those that did the
// selected step and those that did not. Rows show their counts as a share of
// each group.
export type StepOutcomes = { converted: number; dropped: number };

// Detail pages open with the date range the list was read under.
export function useDateRangeParams(): URLSearchParams {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  for (const key of [
    urlFiltersKeyMap.dateRange,
    urlFiltersKeyMap.startDate,
    urlFiltersKeyMap.endDate,
  ]) {
    const value = searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}

export function StepList<Item>({
  query,
  offset,
  noun,
  icon,
  columns,
  header,
  children,
}: {
  query: StepListQuery<{ results: Item[] }>;
  offset: number;
  noun: string;
  icon: LucideIcon;
  columns: number;
  header: ReactNode;
  children: (item: Item) => ReactNode;
}) {
  const { data, status, isFetching } = query;
  const empty =
    status === "success" && offset === 0 && data?.results.length === 0;

  return (
    <div className="w-full font-body">
      <div
        className={`py-1 w-full ${isFetching && status !== "pending" ? "visible" : "invisible"}`}
      >
        <LoadingBar />
      </div>
      <div className="py-2" />

      {status === "pending" && <SkeletonTable rows={5} columns={columns} />}

      {status === "error" && (
        <p className="text-sm">
          Error fetching list of {noun}, please change filters or refresh page
          to try again
        </p>
      )}

      {empty && (
        <EmptyState
          icon={icon}
          title={`No ${noun} between these steps`}
          className="h-144"
        />
      )}

      {status === "success" && data !== undefined && !empty && (
        <Table className="font-display select-none overflow-hidden">
          <TableHeader>
            <TableRow>{header}</TableRow>
          </TableHeader>
          <TableBody>{data.results.map(children)}</TableBody>
        </Table>
      )}
    </div>
  );
}

// `label` names the row's link for screen readers. Rows without an href,
// such as those of a demo, link nowhere.
export function StepRow({
  href,
  label,
  titleClassName,
  title,
  children,
  onOpen,
}: {
  href: string | undefined;
  label: string;
  titleClassName: string;
  title: ReactNode;
  children: ReactNode;
  onOpen?: () => void;
}) {
  const router = useRouter();
  if (href === undefined) {
    return (
      <TableRow className="font-body">
        <TableCell className={`${titleClassName} p-0`}>
          <div className="p-4">{title}</div>
        </TableCell>
        {children}
      </TableRow>
    );
  }
  return (
    <TableRow
      className="font-body"
      tabIndex={0}
      onClick={onOpen}
      // A middle click opens the link in a new tab and fires auxclick, not
      // click.
      onAuxClick={(e) => {
        if (e.button === 1) {
          onOpen?.();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
          router.push(href);
        }
      }}
    >
      <TableCell className={`${titleClassName} relative p-0`}>
        <Link
          href={href}
          className="absolute inset-0 z-10 cursor-pointer"
          tabIndex={-1}
          aria-label={label}
          style={{ display: "block" }}
        />
        <div className="pointer-events-none p-4">{title}</div>
      </TableCell>
      {children}
    </TableRow>
  );
}

function StepCell({
  href,
  className,
  children,
}: {
  href: string | undefined;
  className: string;
  children: ReactNode;
}) {
  if (href === undefined) {
    return (
      <TableCell className={`${className} select-none p-0`}>
        <div className="p-4">{children}</div>
      </TableCell>
    );
  }
  return (
    <RowLinkCell href={href} className={className}>
      {children}
    </RowLinkCell>
  );
}

export function CountCell({
  href,
  className,
  count,
}: {
  href: string | undefined;
  className: string;
  count: number;
}) {
  return (
    <StepCell href={href} className={`${className} text-center truncate`}>
      {numberToKMB(count)}
    </StepCell>
  );
}

export function OutcomeCells({
  href,
  className,
  item,
  outcomes,
}: {
  href: string | undefined;
  className: string;
  item: StepOutcomes;
  outcomes: StepOutcomes;
}) {
  const share = (count: number, total: number) => (
    <StepCell href={href} className={`${className} text-center truncate`}>
      <p>{formatShare(count, total)}</p>
      <p className="text-xs text-muted-foreground">{numberToKMB(count)}</p>
    </StepCell>
  );
  return (
    <>
      {share(item.converted, outcomes.converted)}
      {share(item.dropped, outcomes.dropped)}
    </>
  );
}

const SLOWER_THRESHOLD_PERCENT = 10;

export function DurationCells({
  href,
  className,
  convertedMs,
  droppedMs,
}: {
  href: string | undefined;
  className: string;
  convertedMs: number | null;
  droppedMs: number | null;
}) {
  const slowerPercent =
    convertedMs !== null && droppedMs !== null && convertedMs > 0
      ? Math.round((droppedMs / convertedMs - 1) * 100)
      : 0;
  const format = (ms: number | null) =>
    ms === null ? "–" : formatMillisToHumanReadable(ms);
  return (
    <>
      <StepCell href={href} className={`${className} text-center truncate`}>
        {format(convertedMs)}
      </StepCell>
      <StepCell href={href} className={`${className} text-center truncate`}>
        <p>{format(droppedMs)}</p>
        {slowerPercent >= SLOWER_THRESHOLD_PERCENT && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            {slowerPercent}% slower
          </p>
        )}
      </StepCell>
    </>
  );
}
