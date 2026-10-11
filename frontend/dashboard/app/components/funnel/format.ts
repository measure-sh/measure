import { DateTime } from "luxon";
import type { Funnel, FunnelTrendPeriod } from "../../api/api_calls";

export const CONVERSION_WINDOW_UNITS = [
  { label: "minutes", singular: "minute", seconds: 60 },
  { label: "hours", singular: "hour", seconds: 3_600 },
  { label: "days", singular: "day", seconds: 86_400 },
];

// Picks the largest unit that divides the window, so a window saved as
// 2 hours is shown as 2 hours and not as 120 minutes.
export function splitConversionWindow(seconds: number): {
  amount: number;
  unit: (typeof CONVERSION_WINDOW_UNITS)[number];
} {
  const unit =
    [...CONVERSION_WINDOW_UNITS]
      .reverse()
      .find((u) => seconds % u.seconds === 0) ?? CONVERSION_WINDOW_UNITS[0];
  return { amount: Math.round(seconds / unit.seconds), unit };
}

export function formatConversionWindow(seconds: number): string {
  const { amount, unit } = splitConversionWindow(seconds);
  return `${amount} ${amount === 1 ? unit.singular : unit.label}`;
}

export function formatShare(part: number, whole: number): string {
  if (whole === 0) {
    return "0%";
  }
  const share = (part / whole) * 100;
  if (share > 0 && share < 0.1) {
    return "<0.1%";
  }
  // Shares from 10% up have no decimals, so 99.5% and up would show as 100%.
  if (share >= 99.5 && share < 100) {
    return ">99%";
  }
  // Rounded first, so 9.96% shows as 10% like an exact 10%.
  const rounded = Number(share.toFixed(1));
  return `${rounded >= 10 || rounded === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatFunnelSteps(funnel: Funnel): string {
  return funnel.steps.map((step) => step.event_name).join(" → ");
}

// The dates a trend point covers. The period still in progress ends now.
export function trendPeriodRange(
  datetime: string,
  period: FunnelTrendPeriod,
): { start: DateTime; end: DateTime } {
  const start = DateTime.fromISO(datetime);
  return {
    start,
    end: DateTime.min(start.plus({ [period]: 1 }), DateTime.now()),
  };
}

// The most recent occurrence of an hour of the week that a cadence covers,
// which is in the last week before the cadence's end.
export function cadenceHourRange(
  cadenceEnd: string,
  weekday: number,
  hour: number,
): { start: DateTime; end: DateTime } {
  const start = DateTime.fromISO(cadenceEnd)
    .minus({ weeks: 1 })
    .plus({ days: weekday - 1 })
    .set({ hour });
  return { start, end: start.plus({ hours: 1 }) };
}

export function funnelHref(
  teamId: string,
  funnel: Pick<Funnel, "id" | "app_id">,
  from?: string,
): string {
  const path = `/${teamId}/funnels/${funnel.app_id}/${funnel.id}`;
  return from === undefined ? path : `${path}?from=${from}`;
}
