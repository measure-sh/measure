"use client";

import { DateTime } from "luxon";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import CustomDateTimeInput from "./custom_date_input";

export enum DateRange {
  Last15Mins = "Last 15 Minutes",
  Last30Mins = "Last 30 Minutes",
  LastHour = "Last hour",
  Last3Hours = "Last 3 Hours",
  Last6Hours = "Last 6 Hours",
  Last12Hours = "Last 12 Hours",
  Last24Hours = "Last 24 Hours",
  LastWeek = "Last Week",
  Last15Days = "Last 15 Days",
  LastMonth = "Last Month",
  Last3Months = "Last 3 Months",
  Last6Months = "Last 6 Months",
  LastYear = "Last Year",
  Custom = "Custom Range",
}

export function mapDateRangeToDate(dateRange: string): DateTime {
  let today = DateTime.now();

  switch (dateRange) {
    case DateRange.Last15Mins:
      return today.minus({ minutes: 15 });
    case DateRange.Last30Mins:
      return today.minus({ minutes: 30 });
    case DateRange.LastHour:
      return today.minus({ hours: 1 });
    case DateRange.Last3Hours:
      return today.minus({ hours: 3 });
    case DateRange.Last6Hours:
      return today.minus({ hours: 6 });
    case DateRange.Last12Hours:
      return today.minus({ hours: 12 });
    case DateRange.Last24Hours:
      return today.minus({ hours: 24 });
    case DateRange.LastWeek:
      return today.minus({ days: 7 });
    case DateRange.Last15Days:
      return today.minus({ days: 15 });
    case DateRange.LastMonth:
      return today.minus({ months: 1 });
    case DateRange.Last3Months:
      return today.minus({ months: 3 });
    case DateRange.Last6Months:
      return today.minus({ months: 6 });
    case DateRange.LastYear:
      return today.minus({ years: 1 });
    case DateRange.Custom:
      throw Error("Custom date range cannot be mapped to date");
  }

  throw Error(`Unknown date range "${dateRange}"`);
}

export type DateSelection = {
  dateRange: string;
  startDate: string;
  endDate: string;
};

export type UncheckedDateRange = {
  dateRange: string | null;
  startDate: string | null;
  endDate: string | null;
};

function isKnownDateRange(value: string | null): value is DateRange {
  return (
    value !== null && Object.values(DateRange).includes(value as DateRange)
  );
}

function isValidCustomRange(range: UncheckedDateRange): boolean {
  const start = DateTime.fromISO(range.startDate ?? "");
  const end = DateTime.fromISO(range.endDate ?? "");

  return start.isValid && end.isValid && start <= end;
}

function countBackFromNow(dateRange: DateRange): DateSelection {
  return {
    dateRange,
    startDate: mapDateRangeToDate(dateRange).toISO()!,
    endDate: DateTime.now().toISO()!,
  };
}

export function toDateSelection(
  range: UncheckedDateRange,
): DateSelection | null {
  if (!isKnownDateRange(range.dateRange)) {
    return null;
  }

  if (range.dateRange !== DateRange.Custom) {
    return countBackFromNow(range.dateRange);
  }

  if (!isValidCustomRange(range)) {
    return null;
  }
  return {
    dateRange: DateRange.Custom,
    startDate: DateTime.fromISO(range.startDate!).toISO()!,
    endDate: DateTime.fromISO(range.endDate!).toISO()!,
  };
}

export function isValidDateRange(range: UncheckedDateRange): boolean {
  return toDateSelection(range) !== null;
}

export function pickDateRange(
  requestedDateRange: UncheckedDateRange,
  storedDateRange: UncheckedDateRange,
): UncheckedDateRange {
  if (isValidDateRange(requestedDateRange)) {
    return requestedDateRange;
  }
  if (isValidDateRange(storedDateRange)) {
    return storedDateRange;
  }
  return { dateRange: DateRange.Last6Hours, startDate: null, endDate: null };
}

export default function DateRangeSelect({
  selection,
  onChange,
}: {
  selection: DateSelection;
  onChange: (selection: DateSelection) => void;
}) {
  const { dateRange, startDate, endDate } = selection;

  return (
    <div className="flex flex-row items-center">
      <DropdownSelect
        title="Date Range"
        type={DropdownSelectType.SingleString}
        items={Object.values(DateRange)}
        initialSelected={dateRange}
        onChangeSelected={(item) => {
          const range = item as string;

          if (range === dateRange) {
            return;
          }

          // Custom Range keeps its timestamps until they are edited, cut to
          // the minute the inputs work in.
          if (range === DateRange.Custom) {
            onChange({
              dateRange: range,
              startDate: DateTime.fromISO(startDate).startOf("minute").toISO()!,
              endDate: DateTime.fromISO(endDate).startOf("minute").toISO()!,
            });
            return;
          }

          onChange({
            dateRange: range,
            startDate: mapDateRangeToDate(range).toISO()!,
            endDate: DateTime.now().toISO()!,
          });
        }}
      />

      {dateRange === DateRange.Custom && (
        <>
          <p className="font-display px-2">:</p>
          <CustomDateTimeInput
            timestamp={startDate}
            max={endDate}
            onChange={(start) => onChange({ ...selection, startDate: start })}
          />
          <p className="font-display px-2">to</p>
          <CustomDateTimeInput
            timestamp={endDate}
            min={startDate}
            max={DateTime.now().toISO()!}
            onChange={(end) => onChange({ ...selection, endDate: end })}
          />
        </>
      )}
    </div>
  );
}
