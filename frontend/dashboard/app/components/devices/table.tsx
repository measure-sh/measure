"use client";

import type {
  DeviceRowBase,
  DevicesList,
  DevicesOrder,
  DevicesPercentile,
} from "@/app/api/api_calls";
import {
  DEVICES_LIST_LIMIT,
  type FilterParams,
  useDevicesListQuery,
} from "@/app/query/hooks";
import { Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import EmptyState from "../empty_state";
import LoadingBar from "../loading_bar";
import Paginator from "../paginator";
import RowLinkCell from "../row_link_cell";
import { Separator } from "../separator";
import { SkeletonTable } from "../skeleton";
import TabSelect from "../tab_select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

export type DevicesTableColumn<Row> = {
  header: string;
  // A percentile-ranked table shows only the selected percentile column.
  percentile?: DevicesPercentile;
  cell: (row: Row) => ReactNode;
};

const ORDERS: { label: string; value: DevicesOrder }[] = [
  { label: "Highest", value: "desc" },
  { label: "Lowest", value: "asc" },
];

const PERCENTILES: DevicesPercentile[] = ["p50", "p90", "p95"];

function DeviceCell({ row }: { row: DeviceRowBase }) {
  return (
    <>
      <p className="truncate">{row.device_model}</p>
      <div className="py-1" />
      <p className="truncate text-xs text-muted-foreground">
        {[row.device_manufacturer, row.device_name]
          .filter((part) => part !== "")
          .join(", ")}
      </p>
    </>
  );
}

export default function DevicesTable<Row extends DeviceRowBase>({
  list,
  filterParams,
  extra = {},
  enabled = true,
  rankByPercentile = false,
  testId,
  title,
  description,
  controls,
  columns: allColumns,
  hrefOf,
}: {
  list: DevicesList;
  filterParams: FilterParams | null;
  // Query parameters used only by this list, such as launch type.
  extra?: Record<string, string>;
  enabled?: boolean;
  rankByPercentile?: boolean;
  testId: string;
  title: string;
  description: string;
  controls?: ReactNode;
  columns: DevicesTableColumn<Row>[];
  hrefOf?: (row: Row) => string | undefined;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<DevicesOrder>("desc");
  const [percentile, setPercentile] = useState<DevicesPercentile>("p95");
  const [offset, setOffset] = useState(0);

  // An offset from an earlier filter, order, or list option can point past the
  // new results, so any change starts again from the first page.
  const params = rankByPercentile ? { ...extra, percentile } : extra;
  const resetKey = JSON.stringify([filterParams, params, order]);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setOffset(0);
  }

  const query = useDevicesListQuery<Row>(
    list,
    filterParams,
    order,
    offset,
    params,
    enabled,
  );
  const status = enabled ? query.status : "success";
  const rows = enabled ? (query.data?.results ?? []) : [];
  const meta = query.data?.meta;
  const columns = rankByPercentile
    ? allColumns.filter(
        (column) => !column.percentile || column.percentile === percentile,
      )
    : allColumns;
  // The device column takes 30% of the width. Value columns share the rest,
  // with the last column right-aligned.
  const columnWidth = `${70 / columns.length}%`;
  const alignOf = (i: number) =>
    i === columns.length - 1 ? "text-right" : "text-center";

  return (
    <section data-testid={testId} className="w-full font-body">
      <div className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-xl">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {controls}
      </div>
      <div className="py-2" />
      <div className="mb-2 flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-row items-center gap-2">
          <TabSelect
            items={ORDERS.map((o) => o.label)}
            selected={ORDERS.find((o) => o.value === order)!.label}
            onChangeSelected={(label) =>
              setOrder(ORDERS.find((o) => o.label === label)!.value)
            }
          />
          {rankByPercentile && (
            <>
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-6"
              />
              <TabSelect
                items={PERCENTILES}
                selected={percentile}
                onChangeSelected={(item) =>
                  setPercentile(item as DevicesPercentile)
                }
              />
            </>
          )}
        </div>
        <Paginator
          displayText=""
          prevEnabled={
            status === "success" &&
            !query.isFetching &&
            (meta?.previous ?? false)
          }
          nextEnabled={
            status === "success" && !query.isFetching && (meta?.next ?? false)
          }
          onPrev={() => setOffset(Math.max(0, offset - DEVICES_LIST_LIMIT))}
          onNext={() => setOffset(offset + DEVICES_LIST_LIMIT)}
        />
      </div>
      <div
        className={`py-4 w-full ${status === "success" && query.isFetching ? "visible" : "invisible"}`}
      >
        <LoadingBar />
      </div>
      {status === "pending" && (
        <div role="status" aria-label={`Loading ${title}`}>
          <SkeletonTable rows={5} columns={columns.length + 1} />
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-muted-foreground">
          Unable to load {title.toLowerCase()}.
        </p>
      )}
      {status === "success" && rows.length === 0 && offset === 0 && (
        <EmptyState
          icon={Smartphone}
          title="No devices found"
          description="Try a wider time range or different filters"
          className="h-48"
        />
      )}
      {status === "success" && (rows.length > 0 || offset > 0) && (
        <Table className="font-display select-none max-lg:min-w-160">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Device</TableHead>
              {columns.map((column, i) => (
                <TableHead
                  key={column.header}
                  className={alignOf(i)}
                  style={{ width: columnWidth }}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="font-body tabular-nums">
            {rows.map((row) => {
              const key = `${row.device_manufacturer}\u0000${row.device_model}`;
              const href = hrefOf?.(row);
              if (!href) {
                return (
                  <TableRow
                    data-testid={`${testId}-row`}
                    key={key}
                    className="font-body hover:bg-transparent"
                  >
                    <TableCell>
                      <DeviceCell row={row} />
                    </TableCell>
                    {columns.map((column, i) => (
                      <TableCell key={column.header} className={alignOf(i)}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              }
              return (
                <TableRow
                  data-testid={`${testId}-row`}
                  key={key}
                  className="font-body"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <TableCell className="relative p-0">
                    <Link
                      href={href}
                      className="absolute inset-0 z-10 cursor-pointer"
                      tabIndex={-1}
                      aria-label={`${row.device_manufacturer} ${row.device_model}`}
                      style={{ display: "block" }}
                    />
                    <div className="pointer-events-none p-4">
                      <DeviceCell row={row} />
                    </div>
                  </TableCell>
                  {columns.map((column, i) => (
                    <RowLinkCell
                      key={column.header}
                      href={href}
                      className={alignOf(i)}
                    >
                      {column.cell(row)}
                    </RowLinkCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
