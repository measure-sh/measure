"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "../components/button";
import { buttonVariants } from "../components/button_variants";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/collapsible";
import { SyncedInputSlider } from "../components/synced_input_slider";
import GetStartedLink from "../components/get_started_link";
import {
  FREE_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_MONTH,
} from "../utils/pricing_constants";
import { cn } from "../utils/shadcn_utils";
import { underlineLinkStyle } from "../utils/shared_styles";

// Assumed event sizes for the cost estimate
export const ERROR_EVENT_SIZE_KB = 50;
export const DEFAULT_EVENT_SIZE_KB = 1;

const EVENTS_PER_SESSION_MINUTE = 60;
const JOURNEY_EVENTS_PER_MINUTE = 10;

export type CalculatorInputs = {
  dailyUsers: number;
  averageAppOpens: number;
  sessionLengthMinutes: number;
  launchSamplePercent: number; // e.g. 0.01 means 0.01%
  errorRatePercent: number; // e.g. 0.5 means 0.5%
  perfSpanSamplePercent: number; // e.g. 0.01 means 0.01%
  perfSpanCount: number;
  journeySamplePercent: number; // e.g. 0.01 means 0.01%
  httpSamplePercent: number; // e.g. 0.01 means 0.01%
  httpRequestsPerSession: number;
};

export type EventBreakdown = {
  sessionStartPerDay: number;
  launchPerDay: number;
  crashEventsPerDay: number;
  sessionReplayEventsPerDay: number;
  perfSpansPerDay: number;
  journeyEventsPerDay: number;
  httpEventsPerDay: number;
};

export type CalculatorResult = {
  events: EventBreakdown;
  totalGBPerDay: number;
  totalGBPerMonth: number;
  isFreeTier: boolean;
  rawMonthlyCost: number;
};

export function computeEventBreakdown(
  inputs: CalculatorInputs,
): EventBreakdown {
  const {
    dailyUsers,
    averageAppOpens,
    sessionLengthMinutes,
    launchSamplePercent,
    errorRatePercent,
    perfSpanSamplePercent,
    perfSpanCount,
    journeySamplePercent,
    httpSamplePercent,
    httpRequestsPerSession,
  } = inputs;

  const sessionStartPerDay = dailyUsers * averageAppOpens;
  const launchPerDay =
    dailyUsers * averageAppOpens * (launchSamplePercent / 100);
  const crashSessionsPerDay =
    dailyUsers * averageAppOpens * (errorRatePercent / 100);
  const crashEventsPerDay = crashSessionsPerDay;
  const sessionReplayEventsPerDay =
    crashSessionsPerDay * sessionLengthMinutes * EVENTS_PER_SESSION_MINUTE;
  const perfSpansPerDay =
    dailyUsers *
    averageAppOpens *
    (perfSpanSamplePercent / 100) *
    perfSpanCount;
  const journeyEventsPerDay =
    dailyUsers *
    averageAppOpens *
    sessionLengthMinutes *
    JOURNEY_EVENTS_PER_MINUTE *
    (journeySamplePercent / 100);
  const httpEventsPerDay =
    dailyUsers *
    averageAppOpens *
    (httpSamplePercent / 100) *
    httpRequestsPerSession;

  return {
    sessionStartPerDay,
    launchPerDay,
    crashEventsPerDay,
    sessionReplayEventsPerDay,
    perfSpansPerDay,
    journeyEventsPerDay,
    httpEventsPerDay,
  };
}

export function computeBytesPerDay(events: EventBreakdown): number {
  const crashBytes = events.crashEventsPerDay * ERROR_EVENT_SIZE_KB * 1024;
  const otherBytes =
    (events.sessionStartPerDay +
      events.launchPerDay +
      events.sessionReplayEventsPerDay +
      events.perfSpansPerDay +
      events.journeyEventsPerDay +
      events.httpEventsPerDay) *
    DEFAULT_EVENT_SIZE_KB *
    1024;
  return crashBytes + otherBytes;
}

export function calculate(inputs: CalculatorInputs): CalculatorResult {
  const events = computeEventBreakdown(inputs);
  const totalBytesPerDay = computeBytesPerDay(events);
  const totalGBPerDay = totalBytesPerDay / 1_000_000_000;
  const totalGBPerMonth = totalGBPerDay * 30;
  const isFreeTier = totalGBPerMonth <= FREE_GB;
  const rawMonthlyCost = totalGBPerMonth * PRICE_PER_GB_MONTH;

  return {
    events,
    totalGBPerDay,
    totalGBPerMonth,
    isFreeTier,
    rawMonthlyCost,
  };
}

export default function PricingCalculator() {
  const [dailyUsers, setDailyUsers] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [averageAppOpens, setAverageAppOpens] = useState(3);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(5);
  const [errorRatePercent, setErrorRatePercent] = useState(0.5);
  const [perfSpanSamplePercent, setPerfSpanSamplePercent] = useState(0.01);
  const [perfSpanCount, setPerfSpanCount] = useState(10); // spans per session
  const [launchSamplePercent, setLaunchSamplePercent] = useState(0.01);
  const [journeySamplePercent, setJourneySamplePercent] = useState(0.01);
  const [httpSamplePercent, setHttpSamplePercent] = useState(0.01);
  const [httpRequestsPerSession, setHttpRequestsPerSession] = useState(20);

  const result = calculate({
    dailyUsers,
    averageAppOpens,
    sessionLengthMinutes,
    launchSamplePercent,
    errorRatePercent,
    perfSpanSamplePercent,
    perfSpanCount,
    journeySamplePercent,
    httpSamplePercent,
    httpRequestsPerSession,
  });

  const {
    events: {
      sessionStartPerDay,
      launchPerDay,
      crashEventsPerDay,
      sessionReplayEventsPerDay,
      perfSpansPerDay,
      journeyEventsPerDay,
      httpEventsPerDay,
    },
    totalGBPerMonth,
    isFreeTier,
    rawMonthlyCost,
  } = result;

  const compactFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 1000) {
      return Number.isInteger(num)
        ? num.toLocaleString("en-US")
        : num.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    return compactFormatter.format(num);
  };

  const percentStep = (value: number) => {
    if (value < 1) {
      return 0.01;
    }
    if (value < 10) {
      return 0.1;
    }
    return 1;
  };

  const sectionHeadingStyle =
    "font-display text-lg text-muted-foreground border-b border-border pb-2";

  return (
    <div id="estimator" className="w-full max-w-6xl px-4 md:px-6">
      <div className="bg-card text-card-foreground border-2 border-border rounded-2xl p-8 md:p-12">
        <h3 className="text-4xl font-display text-center">
          Estimate Your Monthly Cost
        </h3>
        <div className="py-6" />

        <SyncedInputSlider
          large
          className="mb-10"
          label="Daily app users"
          description="Number of users who open your app per day"
          value={dailyUsers}
          onChange={setDailyUsers}
          min={0}
          max={10000000}
          step={(v: number) => (v < 10000 ? 1000 : v < 100000 ? 10000 : 100000)}
          integer
          suffix="users"
          rangeStartLabel="0"
          rangeEndLabel="10M+"
        />

        <Collapsible className="my-8">
          <div className="flex justify-end">
            <CollapsibleTrigger asChild>
              <Button
                variant={"outline"}
                className="font-display select-none"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Hide" : "Show"} Advanced Settings
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-8 space-y-12 rounded-lg">
            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>Usage</h4>
              <SyncedInputSlider
                label="App opens per user per day"
                description="Average number of times a user opens your app per day"
                value={averageAppOpens}
                onChange={setAverageAppOpens}
                min={0}
                max={50}
                step={1}
                integer
                suffix="times"
                rangeStartLabel="0"
                rangeEndLabel="50"
              />
              <SyncedInputSlider
                label="Session length"
                description="Average time a user spends in your app each time they open it. A session replay covers the whole session."
                value={sessionLengthMinutes}
                onChange={setSessionLengthMinutes}
                min={0}
                max={60}
                step={1}
                integer
                suffix="minutes"
                rangeStartLabel="0"
                rangeEndLabel="60"
              />
            </div>

            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>
                Errors, ANRs, App Hangs & Bug Reports
              </h4>
              <SyncedInputSlider
                label="Sessions with an error"
                description="Percentage of app opens that have an error, ANR, App Hang or bug report"
                value={errorRatePercent}
                onChange={setErrorRatePercent}
                min={0}
                max={100}
                step={percentStep}
                suffix="%"
                rangeStartLabel="0%"
                rangeEndLabel="100%"
              />
            </div>

            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>Traces</h4>
              <SyncedInputSlider
                label="Trace sampling rate"
                description="Percentage of traces collected"
                value={perfSpanSamplePercent}
                onChange={setPerfSpanSamplePercent}
                min={0}
                max={100}
                step={percentStep}
                suffix="%"
                rangeStartLabel="0%"
                rangeEndLabel="100%"
              />
              <SyncedInputSlider
                label="Spans per session"
                description="Number of spans your app records per session, counting each child span in a trace"
                value={perfSpanCount}
                onChange={setPerfSpanCount}
                min={0}
                max={100}
                step={1}
                integer
                suffix="spans"
                rangeStartLabel="0"
                rangeEndLabel="100"
              />
            </div>

            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>Launch Metrics</h4>
              <SyncedInputSlider
                label="Launch metrics sampling rate"
                description="Percentage of app opens that collect cold, warm and hot launch metrics"
                value={launchSamplePercent}
                onChange={setLaunchSamplePercent}
                min={0}
                max={100}
                step={percentStep}
                suffix="%"
                rangeStartLabel="0%"
                rangeEndLabel="100%"
              />
            </div>

            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>User Journeys</h4>
              <SyncedInputSlider
                label="User journey sampling rate"
                description="Percentage of sessions that collect user journeys"
                value={journeySamplePercent}
                onChange={setJourneySamplePercent}
                min={0}
                max={100}
                step={percentStep}
                suffix="%"
                rangeStartLabel="0%"
                rangeEndLabel="100%"
              />
            </div>

            <div className="space-y-8">
              <h4 className={sectionHeadingStyle}>HTTP</h4>
              <SyncedInputSlider
                label="HTTP sampling rate"
                description="Percentage of HTTP events collected"
                value={httpSamplePercent}
                onChange={setHttpSamplePercent}
                min={0}
                max={100}
                step={percentStep}
                suffix="%"
                rangeStartLabel="0%"
                rangeEndLabel="100%"
              />
              <SyncedInputSlider
                label="Requests per session"
                description="Average number of HTTP requests your app makes per session"
                value={httpRequestsPerSession}
                onChange={setHttpRequestsPerSession}
                min={0}
                max={200}
                step={1}
                integer
                suffix="requests"
                rangeStartLabel="0"
                rangeEndLabel="200"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Results */}
        <div className="border-t-2 border-border pt-8">
          <div className="bg-secondary rounded-lg p-4 my-4 space-y-2 text-sm font-body">
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Session tracking events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(sessionStartPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Error, ANR, App Hang & Bug report events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(crashEventsPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Launch time events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(launchPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Performance spans per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(perfSpansPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Session replay events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(sessionReplayEventsPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                Journey events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(journeyEventsPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground">
                HTTP events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(httpEventsPerDay * 30))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-foreground font-semibold">
                Total data per month:
              </span>
              <span className="font-display font-semibold">
                {totalGBPerMonth.toFixed(2)} GB
              </span>
            </div>
            {isFreeTier && (
              <div className="flex justify-between">
                <span className="text-secondary-foreground font-semibold">
                  Free data per month:
                </span>
                <span className="font-display text-green-700 dark:text-green-400">
                  {FREE_GB} GB
                </span>
              </div>
            )}
          </div>

          {isFreeTier && (
            <div className="bg-green-50 dark:bg-background border-2 border-green-300 dark:border-border rounded-lg p-6 mb-8">
              <div className="flex flex-col items-start gap-1">
                <h4 className="font-display text-lg text-green-900 dark:text-green-400">
                  Free Tier
                </h4>
                <p className="font-body text-green-800 dark:text-green-400">
                  Your usage is within the free limits ({FREE_GB} GB/month). No
                  charges apply.
                </p>
              </div>
            </div>
          )}

          {!isFreeTier && (
            <div className="flex justify-between gap-2 items-start md:items-center mb-6 py-8 border-b-2 border-border">
              <span className="text-4xl font-display text-card-foreground">
                Estimated monthly cost:
              </span>
              <span
                className={cn("text-4xl font-display text-card-foreground")}
              >
                $
                {formatNumber(
                  Math.max(rawMonthlyCost, MINIMUM_PRICE_AFTER_FREE_TIER),
                )}
              </span>
            </div>
          )}

          <GetStartedLink
            location="pricing"
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-xl px-8 py-6 w-full text-center",
            )}
          />

          <p
            className={`text-sm text-card-foreground font-body mt-4 p-4 w-full text-center`}
          >
            Have large data volumes or need custom retention?{" "}
            <Link href="mailto:hello@measure.sh" className={underlineLinkStyle}>
              Contact us
            </Link>{" "}
            for personalised plans.
          </p>
        </div>
      </div>
    </div>
  );
}
