import type { Funnel } from "@/app/api/api_calls";
import {
  cadenceHourRange,
  formatConversionWindow,
  formatFunnelSteps,
  formatShare,
  funnelHref,
  splitConversionWindow,
  trendPeriodRange,
} from "@/app/components/funnel/format";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { DateTime, Settings } from "luxon";

function funnelWith(overrides: Partial<Funnel>): Funnel {
  return {
    id: "funnel-1",
    app_id: "app-1",
    name: "Checkout",
    steps: [{ event_name: "open" }, { event_name: "buy" }],
    conversion_window_seconds: 3600,
    pinned: false,
    pin_order: null,
    created_by: null,
    created_by_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("splitConversionWindow", () => {
  it("uses days when the window is a whole number of days", () => {
    const { amount, unit } = splitConversionWindow(3 * 86_400);
    expect(amount).toBe(3);
    expect(unit.label).toBe("days");
  });

  it("uses hours when the window is whole hours but not whole days", () => {
    const { amount, unit } = splitConversionWindow(25 * 3_600);
    expect(amount).toBe(25);
    expect(unit.label).toBe("hours");
  });

  it("uses minutes when the window is whole minutes but not whole hours", () => {
    const { amount, unit } = splitConversionWindow(90 * 60);
    expect(amount).toBe(90);
    expect(unit.label).toBe("minutes");
  });

  it("falls back to minutes, rounded, when no unit divides the window", () => {
    const { amount, unit } = splitConversionWindow(150);
    expect(amount).toBe(3);
    expect(unit.label).toBe("minutes");
  });
});

describe("formatConversionWindow", () => {
  it("uses the singular unit for an amount of one and the plural otherwise", () => {
    expect(formatConversionWindow(60)).toBe("1 minute");
    expect(formatConversionWindow(3_600)).toBe("1 hour");
    expect(formatConversionWindow(86_400)).toBe("1 day");
    expect(formatConversionWindow(2_700)).toBe("45 minutes");
    expect(formatConversionWindow(7_200)).toBe("2 hours");
    expect(formatConversionWindow(604_800)).toBe("7 days");
  });
});

describe("formatShare", () => {
  it("returns 0% when the whole is zero", () => {
    expect(formatShare(0, 0)).toBe("0%");
    expect(formatShare(5, 0)).toBe("0%");
  });

  it("returns 0% without a decimal when the part is zero", () => {
    expect(formatShare(0, 250)).toBe("0%");
  });

  it("returns <0.1% for a share above zero and below 0.1%", () => {
    expect(formatShare(1, 1_001)).toBe("<0.1%");
    expect(formatShare(1, 100_000)).toBe("<0.1%");
  });

  it("shows one decimal from 0.1% up to below 10%", () => {
    expect(formatShare(1, 1_000)).toBe("0.1%");
    expect(formatShare(1, 30)).toBe("3.3%");
    expect(formatShare(99, 1_000)).toBe("9.9%");
  });

  it("shows no decimal from 10% upwards", () => {
    expect(formatShare(1, 10)).toBe("10%");
    expect(formatShare(1, 3)).toBe("33%");
    expect(formatShare(250, 250)).toBe("100%");
  });

  it("shows a share that rounds to 10% without a decimal", () => {
    expect(formatShare(996, 10_000)).toBe("10%");
    expect(formatShare(995, 10_000)).toBe("10%");
    expect(formatShare(994, 10_000)).toBe("9.9%");
  });

  it("shows >99% for a share that would round up to 100%", () => {
    expect(formatShare(995, 1_000)).toBe(">99%");
    expect(formatShare(9_996, 10_000)).toBe(">99%");
    expect(formatShare(994, 1_000)).toBe("99%");
  });
});

describe("formatFunnelSteps", () => {
  it("joins the event names in step order with arrows", () => {
    const funnel = funnelWith({
      steps: [
        { event_name: "app_open" },
        { event_name: "add_to_cart" },
        { event_name: "app_open" },
      ],
    });
    expect(formatFunnelSteps(funnel)).toBe("app_open → add_to_cart → app_open");
  });
});

describe("trendPeriodRange", () => {
  const originalZone = Settings.defaultZone;

  beforeEach(() => {
    Settings.defaultZone = "UTC";
    Settings.now = () => Date.parse("2026-03-10T12:00:00Z");
  });

  afterEach(() => {
    Settings.defaultZone = originalZone;
    Settings.now = () => Date.now();
  });

  it("covers one day for a finished day", () => {
    const { start, end } = trendPeriodRange("2026-03-08T00:00:00Z", "day");
    expect(start.toISO()).toBe("2026-03-08T00:00:00.000Z");
    expect(end.toISO()).toBe("2026-03-09T00:00:00.000Z");
  });

  it("covers one week for a finished week", () => {
    const { start, end } = trendPeriodRange("2026-02-23T00:00:00Z", "week");
    expect(start.toISO()).toBe("2026-02-23T00:00:00.000Z");
    expect(end.toISO()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("covers one calendar month for a finished month", () => {
    const { start, end } = trendPeriodRange("2026-02-01T00:00:00Z", "month");
    expect(start.toISO()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISO()).toBe("2026-03-01T00:00:00.000Z");
  });

  it.each(["day", "week", "month"] as const)(
    "ends the %s still in progress now",
    (period) => {
      const { start, end } = trendPeriodRange("2026-03-10T00:00:00Z", period);
      expect(start.toISO()).toBe("2026-03-10T00:00:00.000Z");
      expect(end.toMillis()).toBe(DateTime.now().toMillis());
    },
  );
});

describe("cadenceHourRange", () => {
  const originalZone = Settings.defaultZone;

  beforeEach(() => {
    Settings.defaultZone = "Asia/Kolkata";
  });

  afterEach(() => {
    Settings.defaultZone = originalZone;
  });

  it("covers the hour on the weekday of the last week before the cadence's end", () => {
    const { start, end } = cadenceHourRange(
      "2026-10-12T00:00:00.000+05:30",
      3,
      14,
    );
    expect(start.toISO()).toBe("2026-10-07T14:00:00.000+05:30");
    expect(end.toISO()).toBe("2026-10-07T15:00:00.000+05:30");
  });

  it("covers Sunday's last hour on the day before the cadence's end", () => {
    const { start, end } = cadenceHourRange(
      "2026-10-12T00:00:00.000+05:30",
      7,
      23,
    );
    expect(start.toISO()).toBe("2026-10-11T23:00:00.000+05:30");
    expect(end.toISO()).toBe("2026-10-12T00:00:00.000+05:30");
  });
});

describe("funnelHref", () => {
  it("links to the funnel under its team and app", () => {
    const funnel = funnelWith({ id: "f-9", app_id: "a-3", name: "Checkout" });
    expect(funnelHref("team-1", funnel)).toBe("/team-1/funnels/a-3/f-9");
  });
});
