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
import TrackCtaLink from "../components/analytics/track_cta_link";
import { calculate } from "../utils/pricing_calculator";
import {
  FREE_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
} from "../utils/pricing_constants";
import { cn } from "../utils/shadcn_utils";
import { underlineLinkStyle } from "../utils/shared_styles";

export default function PricingCalculator() {
  const [dailyUsers, setDailyUsers] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced configurable rates (percent values for UI)
  const [averageAppOpens, setAverageAppOpens] = useState(3); // times
  const [launchSamplePercent, setLaunchSamplePercent] = useState(0.01); // percent
  const [errorRatePercent, setErrorRatePercent] = useState(0.5); // percent
  const [perfSpanSamplePercent, setPerfSpanSamplePercent] = useState(0.01); // percent
  const [perfSpanCount, setPerfSpanCount] = useState(10); // number of performance spans in app
  const [journeySamplePercent, setJourneySamplePercent] = useState(0.01); // percent

  const result = calculate({
    dailyUsers,
    averageAppOpens,
    launchSamplePercent,
    errorRatePercent,
    perfSpanSamplePercent,
    perfSpanCount,
    journeySamplePercent,
  });

  const {
    events: {
      sessionStartPerDay,
      launchPerDay,
      crashEventsPerDay,
      sessionTimelineEventsPerDay,
      perfSpansPerDay,
      journeyEventsPerDay,
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

  return (
    <div id="estimator" className="w-full max-w-6xl px-4 md:px-0">
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
          step={(v) => (v < 10000 ? 1000 : v < 100000 ? 10000 : 100000)}
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

          <CollapsibleContent className="mt-8 space-y-8 rounded-lg">
            <SyncedInputSlider
              label="📲 Average app opens by a user per day"
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
              label="🚀 Launch time metrics collection rate"
              description="Percentage of app opens for which we collect launch timing metrics"
              value={launchSamplePercent}
              onChange={setLaunchSamplePercent}
              min={0}
              max={100}
              step={percentStep}
              suffix="%"
              rangeStartLabel="0%"
              rangeEndLabel="100%"
            />

            <SyncedInputSlider
              label="🐞 Error rate (Crashes, ANRs & Bug reports)"
              description="Percentage of app opens which have Crashes, ANRs & Bug reports"
              value={errorRatePercent}
              onChange={setErrorRatePercent}
              min={0}
              max={100}
              step={percentStep}
              suffix="%"
              rangeStartLabel="0%"
              rangeEndLabel="100%"
            />

            <SyncedInputSlider
              label="⚡️ Performance Spans collection rate"
              description="Percentage of performance spans collected per session when sampled (a Trace can have multiple child spans)"
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
              label="⚡️ Number of Performance Spans in app"
              description="Number of performance spans collected per session when sampled (a Trace can have multiple child spans)"
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

            <SyncedInputSlider
              label="🚕 User Journey events collection rate"
              description="Percentage of user journey events collected per session when sampled"
              value={journeySamplePercent}
              onChange={setJourneySamplePercent}
              min={0}
              max={100}
              step={percentStep}
              suffix="%"
              rangeStartLabel="0%"
              rangeEndLabel="100%"
            />
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
                Crash, ANR & Bug report events per month:
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
                Session timeline events per month:
              </span>
              <span className="font-display">
                {formatNumber(Math.round(sessionTimelineEventsPerDay * 30))}
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

          <TrackCtaLink
            location="pricing"
            destination="signup"
            href={"/auth/login"}
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-xl px-8 py-6 w-full text-center",
            )}
          >
            Get Started
          </TrackCtaLink>

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
