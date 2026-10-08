import {
  calculate,
  CalculatorInputs,
  computeBytesPerDay,
  computeEventBreakdown,
  DEFAULT_EVENT_SIZE_KB,
  ERROR_EVENT_SIZE_KB,
  EventBreakdown,
} from "@/app/pricing/pricing_calculator";
import { FREE_GB, PRICE_PER_GB_MONTH } from "@/app/utils/pricing_constants";
import { describe, expect, it } from "@jest/globals";

// 1,000 users opening the app 3 times a day gives 3,000 sessions a day.
const inputs: CalculatorInputs = {
  dailyUsers: 1000,
  averageAppOpens: 3,
  sessionLengthMinutes: 5,
  launchSamplePercent: 10,
  errorRatePercent: 1,
  perfSpanSamplePercent: 10,
  perfSpanCount: 5,
  journeySamplePercent: 10,
  httpSamplePercent: 10,
  httpRequestsPerSession: 20,
};

const noSampling: CalculatorInputs = {
  ...inputs,
  launchSamplePercent: 0,
  errorRatePercent: 0,
  perfSpanSamplePercent: 0,
  journeySamplePercent: 0,
  httpSamplePercent: 0,
};

describe("computeEventBreakdown", () => {
  it("counts one session start per app open", () => {
    const events = computeEventBreakdown(inputs);
    expect(events.sessionStartPerDay).toBe(3000);
  });

  it("counts launch events for the sampled share of sessions", () => {
    // 3,000 sessions * 10%
    expect(computeEventBreakdown(inputs).launchPerDay).toBeCloseTo(300);
  });

  it("counts one error event per session with an error", () => {
    // 3,000 sessions * 1%
    expect(computeEventBreakdown(inputs).crashEventsPerDay).toBeCloseTo(30);
  });

  it("counts 60 replay events per session minute for each error", () => {
    // 30 errors * 5 minutes * 60 events
    expect(computeEventBreakdown(inputs).sessionReplayEventsPerDay).toBeCloseTo(
      9000,
    );
    // 30 errors * 2 minutes * 60 events
    expect(
      computeEventBreakdown({ ...inputs, sessionLengthMinutes: 2 })
        .sessionReplayEventsPerDay,
    ).toBeCloseTo(3600);
  });

  it("counts spans per session for sampled sessions", () => {
    // 3,000 sessions * 10% * 5 spans
    expect(computeEventBreakdown(inputs).perfSpansPerDay).toBeCloseTo(1500);
  });

  it("counts 10 journey events per session minute for sampled sessions", () => {
    // 3,000 sessions * 5 minutes * 10 events * 10%
    expect(computeEventBreakdown(inputs).journeyEventsPerDay).toBeCloseTo(
      15000,
    );
    // 3,000 sessions * 2 minutes * 10 events * 10%
    expect(
      computeEventBreakdown({ ...inputs, sessionLengthMinutes: 2 })
        .journeyEventsPerDay,
    ).toBeCloseTo(6000);
  });

  it("counts requests per session for sampled HTTP events", () => {
    // 3,000 sessions * 10% * 20 requests
    expect(computeEventBreakdown(inputs).httpEventsPerDay).toBeCloseTo(6000);
  });

  it("collects every sampled type from every session at 100%", () => {
    const events = computeEventBreakdown({
      ...inputs,
      launchSamplePercent: 100,
      perfSpanSamplePercent: 100,
      journeySamplePercent: 100,
      httpSamplePercent: 100,
    });
    expect(events.launchPerDay).toBe(3000);
    expect(events.perfSpansPerDay).toBe(3000 * 5);
    expect(events.journeyEventsPerDay).toBe(3000 * 5 * 10);
    expect(events.httpEventsPerDay).toBe(3000 * 20);
  });

  it("leaves only session starts when every rate is 0%", () => {
    expect(computeEventBreakdown(noSampling)).toEqual({
      sessionStartPerDay: 3000,
      launchPerDay: 0,
      crashEventsPerDay: 0,
      sessionReplayEventsPerDay: 0,
      perfSpansPerDay: 0,
      journeyEventsPerDay: 0,
      httpEventsPerDay: 0,
    });
  });
});

describe("computeBytesPerDay", () => {
  it("sizes error events at ERROR_EVENT_SIZE_KB and every other event at DEFAULT_EVENT_SIZE_KB", () => {
    // Distinct counts per type, so leaving any type out of the sum changes the total.
    const events: EventBreakdown = {
      sessionStartPerDay: 1,
      launchPerDay: 2,
      crashEventsPerDay: 3,
      sessionReplayEventsPerDay: 4,
      perfSpansPerDay: 5,
      journeyEventsPerDay: 6,
      httpEventsPerDay: 7,
    };
    expect(computeBytesPerDay(events)).toBe(
      3 * ERROR_EVENT_SIZE_KB * 1024 +
        (1 + 2 + 4 + 5 + 6 + 7) * DEFAULT_EVENT_SIZE_KB * 1024,
    );
  });
});

describe("calculate", () => {
  it("returns the event breakdown for the inputs", () => {
    expect(calculate(inputs).events).toEqual(computeEventBreakdown(inputs));
  });

  it("converts bytes to decimal GB over a 30 day month and prices them per GB", () => {
    // 1,000,000 session starts a day at 1 KB is 1.024 GB a day.
    const result = calculate({
      ...noSampling,
      dailyUsers: 1_000_000,
      averageAppOpens: 1,
    });
    expect(result.totalGBPerDay).toBeCloseTo(1.024);
    expect(result.totalGBPerMonth).toBeCloseTo(30.72);
    expect(result.rawMonthlyCost).toBeCloseTo(30.72 * PRICE_PER_GB_MONTH);
  });

  it("is free up to FREE_GB a month and paid above it", () => {
    // Daily session starts that add up to FREE_GB a month.
    const usersAtFreeLimit =
      (FREE_GB * 1_000_000_000) / 30 / (DEFAULT_EVENT_SIZE_KB * 1024);
    const atUsers = (dailyUsers: number) =>
      calculate({ ...noSampling, dailyUsers, averageAppOpens: 1 });

    expect(atUsers(Math.floor(usersAtFreeLimit)).isFreeTier).toBe(true);
    expect(atUsers(Math.ceil(usersAtFreeLimit)).isFreeTier).toBe(false);
  });

  it("returns zero data and cost for zero users", () => {
    const result = calculate({ ...inputs, dailyUsers: 0 });
    expect(result.totalGBPerMonth).toBe(0);
    expect(result.rawMonthlyCost).toBe(0);
    expect(result.isFreeTier).toBe(true);
  });
});
