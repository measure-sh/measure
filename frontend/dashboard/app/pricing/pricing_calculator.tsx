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
import { Slider } from "../components/slider";
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

  const compactFormatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 1000) {
      return Number.isInteger(num)
        ? num.toLocaleString()
        : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    return compactFormatter.format(num);
  };

  const formatPercent = (rate: number) => {
    const pct = rate * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${parseFloat(pct.toFixed(2))}%`;
  };

  return (
    <div id="estimator" className="w-full max-w-6xl px-4 md:px-0">
      <div className="bg-card text-card-foreground border-2 border-border rounded-2xl p-8 md:p-12">
        <h3 className="text-4xl font-display text-center">
          Estimate Your Monthly Cost
        </h3>
        <div className="py-6" />

        {/* Daily users slider (single input) */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="text-2xl font-display">Daily app users</label>
              <p className="text-sm py-2 text-muted-foreground font-body">
                Number of users who open your app per day
              </p>
            </div>
            <span className="text-2xl font-display">
              {formatNumber(dailyUsers)}
            </span>
          </div>
          <Slider
            value={[dailyUsers]}
            onValueChange={(value) => setDailyUsers(value[0])}
            min={0}
            max={5000000}
            step={
              dailyUsers < 10000 ? 1000 : dailyUsers < 100000 ? 10000 : 100000
            }
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-muted-foreground font-body">
            <span>0</span>
            <span>5M+</span>
          </div>
        </div>

        {/* Advanced settings dropdown */}
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
            {/* App opens per user per day */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    📲 Average app opens by a user per day
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Average number of times a user opens your app per day
                  </p>
                </div>
                <span className="text-xl font-display">
                  {averageAppOpens} times
                </span>
              </div>
              <Slider
                value={[averageAppOpens]}
                onValueChange={(v) => setAverageAppOpens(v[0])}
                min={0}
                max={50}
                step={1}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0</span>
                <span>50</span>
              </div>
            </div>

            {/* Launch sample rate */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    🚀 Launch time metrics collection rate
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Percentage of app opens for which we collect launch timing
                    metrics
                  </p>
                </div>
                <span className="text-xl font-display">
                  {formatPercent(launchSamplePercent / 100)}
                </span>
              </div>
              <Slider
                value={[launchSamplePercent]}
                onValueChange={(v) => setLaunchSamplePercent(v[0])}
                min={0}
                max={5}
                step={0.01}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0%</span>
                <span>5%</span>
              </div>
            </div>

            {/* Error rate */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    🐞 Error rate (Crashes, ANRs & Bug reports)
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Percentage of app opens which have Crashes, ANRs & Bug
                    reports
                  </p>
                </div>
                <span className="text-xl font-display">
                  {formatPercent(errorRatePercent / 100)}
                </span>
              </div>
              <Slider
                value={[errorRatePercent]}
                onValueChange={(v) => setErrorRatePercent(v[0])}
                min={0}
                max={5}
                step={0.01}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0%</span>
                <span>5%</span>
              </div>
            </div>

            {/* Performance spans collection rate */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    ⚡️ Performance Spans collection rate
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Percentage of performance spans collected per session when
                    sampled (a Trace can have multiple child spans)
                  </p>
                </div>
                <span className="text-xl font-display">
                  {formatNumber(perfSpanSamplePercent)}%
                </span>
              </div>
              <Slider
                value={[perfSpanSamplePercent]}
                onValueChange={(v) => setPerfSpanSamplePercent(v[0])}
                min={0}
                max={1}
                step={0.01}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0%</span>
                <span>1%</span>
              </div>
            </div>

            {/* Performance spans count */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    ⚡️ Number of Performance Spans in app
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Number of performance spans collected per session when
                    sampled (a Trace can have multiple child spans)
                  </p>
                </div>
                <span className="text-xl font-display">
                  {formatNumber(perfSpanCount)}
                </span>
              </div>
              <Slider
                value={[perfSpanCount]}
                onValueChange={(v) => setPerfSpanCount(Math.round(v[0]))}
                min={0}
                max={100}
                step={1}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0</span>
                <span>100</span>
              </div>
            </div>

            {/* User Journey events collection rate */}
            <div>
              <div className="flex justify-between items-center mb-4 gap-2">
                <div>
                  <label className="text-xl font-display">
                    🚕 User Journey events collection rate
                  </label>
                  <p className="text-sm py-2 text-muted-foreground font-body">
                    Percentage of user journey events collected per session when
                    sampled
                  </p>
                </div>
                <span className="text-xl font-display">
                  {formatNumber(journeySamplePercent)}%
                </span>
              </div>
              <Slider
                value={[journeySamplePercent]}
                onValueChange={(v) => setJourneySamplePercent(v[0])}
                min={0}
                max={1}
                step={0.01}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0%</span>
                <span>1%</span>
              </div>
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
                <span className="font-display text-green-600 dark:text-green-500">
                  {FREE_GB} GB
                </span>
              </div>
            )}
          </div>

          {isFreeTier && (
            <div className="bg-green-50 dark:bg-background border-2 border-green-300 dark:border-border rounded-lg p-6 mb-8">
              <div className="flex flex-col items-start gap-1">
                <h4 className="font-display text-lg text-green-900 dark:text-green-500">
                  Free Tier
                </h4>
                <p className="font-body text-green-800 dark:text-green-500">
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

          <Link
            href={"/auth/login"}
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-xl px-8 py-6 w-full text-center",
            )}
          >
            Get Started
          </Link>

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
