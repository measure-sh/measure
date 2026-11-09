"use client";

import Pill from "./pill";

const SAMPLE_TOOLTIP =
  "Percentage of users included in the analysis. For large amounts of data, a sample of users is analyzed and used to estimate results for all users.";

// The server reads every user when a date range has few events, and only a
// fraction of a percent of users for a large app over a long range, so small
// percents keep two significant digits. The server sends null when a query
// found no rows, since it can't tell the sample then.
export function formatSamplePercent(
  percent: number | null | undefined,
): string {
  if (percent === null || percent === undefined) {
    return "–";
  }
  if (percent >= 99.95) {
    return "100%";
  }
  if (percent >= 10) {
    return `${percent.toFixed(0)}%`;
  }
  return `${Number(percent.toPrecision(2))}%`;
}

export function SamplePercent({
  percent,
  className,
}: {
  percent: number | null | undefined;
  className?: string;
}) {
  return (
    <Pill tooltip={SAMPLE_TOOLTIP} className={className}>
      {`Sampled at: ${formatSamplePercent(percent)}`}
    </Pill>
  );
}
