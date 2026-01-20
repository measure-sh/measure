"use client"

import { LucideCheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button, buttonVariants } from '../components/button'
import { Card } from '../components/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/collapsible'
import LandingFooter from '../components/landing_footer'
import LandingHeader from '../components/landing_header'
import { Slider } from '../components/slider'
import { FREE_UNITS, INCLUDED_PRO_UNITS, MINIMUM_PRICE_AFTER_FREE_TIER, PRICE_PER_1K_UNITS_MONTH, PRICE_PER_UNIT_DAY } from '../utils/pricing_constants'
import { cn } from '../utils/shadcn_utils'
import { underlineLinkStyle } from '../utils/shared_styles'

const EVENTS_PER_SESSION_MINUTE = 60 // number of events generated per minute of session time
const SESSION_TIME_PER_ERROR = 5 // time for which we collect timeline for errored sessions (in minutes)
const AVG_SESSION_TIME = 10 // average session time in minutes
const JOURNEY_EVENTS_PER_MINUTE = 10 // number of journey events generated per minute of session time
const RETENTION_MONTHS = [1, 3, 6, 12] as const


export default function Pricing() {
  const [dailyUsers, setDailyUsers] = useState(1000)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Advanced configurable rates (percent values for UI)
  const [averageAppOpens, setAverageAppOpens] = useState(3) // times
  const [launchSamplePercent, setLaunchSamplePercent] = useState(0.01) // percent
  const [errorRatePercent, setErrorRatePercent] = useState(0.5) // percent
  const [perfSpanSamplePercent, setPerfSpanSamplePercent] = useState(0.01) // percent
  const [perfSpanCount, setPerfSpanCount] = useState(10) // number of performance spans in app
  const [journeySamplePercent, setJourneySamplePercent] = useState(0.01) // percent
  const [retentionMonths, setRetentionMonths] = useState(1) // months (1,3,6,12)

  // Per-day event breakdown based on assumptions
  const sessionStartPerDay = dailyUsers * averageAppOpens // 1 per open
  const launchPerDay = dailyUsers * averageAppOpens * (launchSamplePercent / 100)
  const crashSessionsPerDay = dailyUsers * averageAppOpens * (errorRatePercent / 100)
  const crashEventsPerDay = crashSessionsPerDay // assume 1 crash event per crashed session
  const sessionTimelineSessionsPerDay = crashSessionsPerDay
  const sessionTimelineEventsPerDay = sessionTimelineSessionsPerDay * SESSION_TIME_PER_ERROR * EVENTS_PER_SESSION_MINUTE // events per collected timeline
  const perfSpansCollectedSessionsPerDay = dailyUsers * averageAppOpens * (perfSpanSamplePercent / 100)
  const perfSpansPerDay = perfSpansCollectedSessionsPerDay * perfSpanCount
  const journeyEventsPerDay = dailyUsers * averageAppOpens * AVG_SESSION_TIME * JOURNEY_EVENTS_PER_MINUTE * (journeySamplePercent / 100)

  const totalUnitsPerDay = sessionStartPerDay + launchPerDay + crashEventsPerDay + sessionTimelineEventsPerDay + perfSpansPerDay + journeyEventsPerDay
  const totalUnitsPerMonth = totalUnitsPerDay * 30

  // Calculate Billable Unit Days
  // 1 Unit retained for 30 days = 30 Unit-Days.
  const retentionDays = retentionMonths * 30
  const totalUnitsRounded = Math.round(totalUnitsPerMonth)

  // Base units (first 30 days of retention)
  // If Total > 1M, ALL units are billable for the first 30 days.
  const baseExcessUnits = totalUnitsRounded > FREE_UNITS ? totalUnitsRounded : 0
  const billableUnitDaysBase = baseExcessUnits * 30

  // Extended retention (days beyond 30)
  // All units (including the first 1M) are charged for extra days.
  const extraRetentionDays = Math.max(0, retentionDays - 30)
  const billableUnitDaysRetention = totalUnitsRounded * extraRetentionDays

  const baseCost = billableUnitDaysBase * PRICE_PER_UNIT_DAY
  const retentionCost = billableUnitDaysRetention * PRICE_PER_UNIT_DAY
  const rawMonthlyCost = baseCost + retentionCost

  // Free tier applies only when total events are within free limits AND retention is default (1 month)
  const isFreeTier = totalUnitsRounded <= FREE_UNITS && retentionMonths === 1

  const compactFormatter = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  })

  const formatNumber = (num: number) => {
    // For numbers under 1000 show full value (integers without decimals,
    // non-integers up to 2 decimals). For larger numbers use compact
    // notation (1K, 1.5K, 1M) with at most one fractional digit.
    if (Math.abs(num) < 1000) {
      return Number.isInteger(num)
        ? num.toLocaleString()
        : num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }

    return compactFormatter.format(num)
  }

  const formatPercent = (rate: number) => {
    const pct = rate * 100
    return Number.isInteger(pct) ? `${pct}%` : `${parseFloat(pct.toFixed(2))}%`
  }

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        {/* Header */}
        <div className="py-16" />
        <h1 className="text-6xl font-display">Pricing</h1>

        <div className="py-8" />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Measure Cloud pricing is based on the data you send to us and how long you retain it.
          If you are <Link href="https://github.com/measure-sh/measure/blob/main/docs/hosting/README.md" target="_blank" className={underlineLinkStyle}>self hosting</Link>, it is completely free to use.
        </p>

        <div className="py-8" />
        <div className='flex flex-col md:flex-row gap-8 w-full max-w-4xl px-4 md:px-0'>
          <Card className='w-full md:w-1/2'>
            <div className="p-4 md:p-8 flex flex-col items-center">
              <p className='text-xl font-display'>FREE</p>
              <p className='text-4xl font-display py-4'>$0 per month</p>
              <ul className='list-inside space-y-2'>
                <li className='font-body text-center'>Up to {formatNumber(FREE_UNITS)} units per month</li>
                <li className='font-body text-center'>30 day retention</li>
                <li className='font-body text-center'>No credit card needed</li>
              </ul>
            </div>
          </Card>
          <Card className='w-full md:w-1/2 bg-green-50 dark:bg-card border border-green-300 dark:border-border'>
            <div className="p-4 md:p-8 flex flex-col items-center">
              <p className='text-xl text-green-900 dark:text-primary font-display'>PRO</p>
              <p className='text-4xl text-green-900 dark:text-primary font-display py-4'>$50 per month</p>
              <ul className='list-inside space-y-2'>
                <li className='font-body text-center text-green-900 dark:text-foreground'>{formatNumber(INCLUDED_PRO_UNITS)} units per month included</li>
                <li className='font-body text-center text-green-900 dark:text-foreground'>Retention upto 1 year</li>
                <li className='font-body text-center text-green-900 dark:text-foreground'>Extra units & retention charged at:<br /> ${PRICE_PER_1K_UNITS_MONTH.toFixed(3)} per 1,000 units/month</li>
              </ul>
            </div>
          </Card>
        </div>

        <p className="font-body text-sm py-16">Every Crash, ANR, Bug Report, Performance Span, Launch metric, Session Timeline event, User interaction event, Custom event etc counts as 1 unit.</p>

        <div className='flex flex-wrap justify-between px-4 md:px-0 md:w-4xl gap-4 font-display'>
          <div className='flex flex-row gap-4 items-center'><p>Control costs with <Link href="/product/adaptive-capture" className={underlineLinkStyle}>Adaptive Capture</Link></p>
            <LucideCheckCircle className='text-green-600 dark:text-green-500 w-4 h-4' />
          </div>
          <div className='flex flex-row gap-4 items-center'><p>No Seat Limits</p>
            <LucideCheckCircle className='text-green-600 dark:text-green-500 w-4 h-4' />
          </div>
          <div className='flex flex-row gap-4 items-center'><p>No feature restrictions</p>
            <LucideCheckCircle className='text-green-600 dark:text-green-500 w-4 h-4' />
          </div>
        </div>


        {/* Cost Estimator */}
        <div className='py-12' />
        <div id="estimator" className="w-full max-w-6xl px-4 md:px-0">
          <div className="bg-card text-card-foreground border-2 border-border rounded-2xl p-8 md:p-12">
            <h3 className="text-4xl font-display text-center">Estimate Your Monthly Cost</h3>
            <div className="py-6" />

            {/* Daily users slider (single input) */}
            <div className="mb-10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <label className="text-2xl font-display">Daily app users</label>
                  <p className="text-sm py-2 text-muted-foreground font-body">Number of users who open your app per day</p>
                </div>
                <span className="text-2xl font-display">{formatNumber(dailyUsers)}</span>
              </div>
              <Slider
                value={[dailyUsers]}
                onValueChange={(value) => setDailyUsers(value[0])}
                min={0}
                max={5000000}
                step={dailyUsers < 10000 ? 1000 : dailyUsers < 100000 ? 10000 : 100000}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground font-body">
                <span>0</span>
                <span>5M+</span>
              </div>
            </div>

            {/* Advanced settings dropdown */}
            <Collapsible className='my-8'>
              <div className="flex justify-end">
                <CollapsibleTrigger asChild>
                  <Button variant={"outline"} className='font-display select-none' onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Hide" : "Show"} Advanced Settings</Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-8 space-y-8 rounded-lg">
                {/* App opens per user per day */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">📲 Average app opens by a user per day</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Average number of times a user opens your app per day</p>
                    </div>
                    <span className="text-xl font-display">{averageAppOpens} times</span>
                  </div>
                  <Slider value={[averageAppOpens]} onValueChange={(v) => setAverageAppOpens(v[0])} min={0} max={50} step={1} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0</span>
                    <span>50</span>
                  </div>
                </div>

                {/* Launch sample rate */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">🚀 Launch time metrics collection rate</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Percentage of app opens for which we collect launch timing metrics</p>
                    </div>
                    <span className="text-xl font-display">{formatPercent(launchSamplePercent / 100)}</span>
                  </div>
                  <Slider value={[launchSamplePercent]} onValueChange={(v) => setLaunchSamplePercent(v[0])} min={0} max={5} step={0.01} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0%</span>
                    <span>5%</span>
                  </div>
                </div>

                {/* Error rate */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">🐞 Error rate (Crashes, ANRs & Bug reports)</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Percentage of app opens which have Crashes, ANRs & Bug reports</p>
                    </div>
                    <span className="text-xl font-display">{formatPercent(errorRatePercent / 100)}</span>
                  </div>
                  <Slider value={[errorRatePercent]} onValueChange={(v) => setErrorRatePercent(v[0])} min={0} max={5} step={0.01} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0%</span>
                    <span>5%</span>
                  </div>
                </div>

                {/* Performance spans collection rate */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">⚡️ Performance Spans collection rate</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Percentage of performance spans collected per session when sampled (a Trace can have multiple child spans)</p>
                    </div>
                    <span className="text-xl font-display">{formatNumber(perfSpanSamplePercent)}%</span>
                  </div>
                  <Slider value={[perfSpanSamplePercent]} onValueChange={(v) => setPerfSpanSamplePercent(v[0])} min={0} max={1} step={0.01} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0%</span>
                    <span>1%</span>
                  </div>
                </div>

                {/* Performance spans count */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">⚡️ Number of Performance Spans in app</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Number of performance spans collected per session when sampled (a Trace can have multiple child spans)</p>
                    </div>
                    <span className="text-xl font-display">{formatNumber(perfSpanCount)}</span>
                  </div>
                  <Slider value={[perfSpanCount]} onValueChange={(v) => setPerfSpanCount(Math.round(v[0]))} min={0} max={100} step={1} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>

                {/* User Journey events collection rate */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">🚕  User Journey events collection rate</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">Percentage of user journey events collected per session when sampled</p>
                    </div>
                    <span className="text-xl font-display">{formatNumber(journeySamplePercent)}%</span>
                  </div>
                  <Slider value={[journeySamplePercent]} onValueChange={(v) => setJourneySamplePercent(v[0])} min={0} max={1} step={0.01} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-body">
                    <span>0%</span>
                    <span>1%</span>
                  </div>
                </div>

                {/* Data retention */}
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <label className="text-xl font-display">🗄️ Data retention</label>
                      <p className="text-sm py-2 text-muted-foreground font-body">How long events are retained for query and analytics</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    {RETENTION_MONTHS.map((m) => (
                      <Button
                        key={m}
                        onClick={() => setRetentionMonths(m)}
                        variant={"outline"}
                        className={cn(
                          "border-2",
                          retentionMonths === m ? "border-primary dark:border-primary" : "",
                        )}
                      >
                        {m === 12 ? '1 year' : `${m} month${m > 1 ? 's' : ''}`}
                      </Button>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Results */}
            <div className="border-t-2 border-border pt-8">
              <div className="bg-secondary rounded-lg p-4 my-4 space-y-2 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Session tracking events per month:</span>
                  <span className="font-display">{formatNumber(Math.round(sessionStartPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Crash, ANR & Bug report events per month:</span>
                  <span className="font-display">{formatNumber(Math.round(crashEventsPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Launch time events per month:</span>
                  <span className="font-display">{formatNumber(Math.round(launchPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Performance spans per month:</span>
                  <span className="font-display">{formatNumber(Math.round(perfSpansPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Session timeline events per month:</span>
                  <span className="font-display">{formatNumber(Math.round(sessionTimelineEventsPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground">Journey events per month:</span>
                  <span className="font-display">{formatNumber(Math.round(journeyEventsPerDay * 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-foreground font-semibold">Total units per month:</span>
                  <span className="font-display font-semibold">{formatNumber(Math.round(totalUnitsPerMonth))}</span>
                </div>
                {totalUnitsRounded <= FREE_UNITS && (
                  <div className="flex justify-between">
                    <span className="text-secondary-foreground font-semibold">Free units per month:</span>
                    <span className="font-display text-green-600 dark:text-green-500">{formatNumber(FREE_UNITS)}</span>
                  </div>
                )}
                {!isFreeTier && (
                  <>
                    {baseCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-secondary-foreground font-semibold">Units price:</span>
                        <span className="font-display font-semibold">${baseCost.toFixed(2)}</span>
                      </div>
                    )}
                    {retentionCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-secondary-foreground font-semibold">Retention price:</span>
                        <span className="font-display font-semibold">${retentionCost.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isFreeTier && (
                <div className="bg-green-50 dark:bg-background border-2 border-green-300 dark:border-border rounded-lg p-6 mb-8">
                  <div className="flex flex-col items-start gap-1">
                    <h4 className="font-display text-lg text-green-900 dark:text-green-500">Free Tier</h4>
                    <p className="font-body text-green-800 dark:text-green-500">Your usage is within the free limits ({formatNumber(FREE_UNITS)} units/month). No charges apply.</p>
                  </div>
                </div>
              )}

              {!isFreeTier && (
                <div className="flex justify-between gap-2 items-start md:items-center mb-6 py-8 border-b-2 border-border">
                  <span className="text-4xl font-display text-card-foreground">Estimated monthly cost:</span>
                  <span className={cn("text-4xl font-display text-card-foreground")}>
                    ${rawMonthlyCost < MINIMUM_PRICE_AFTER_FREE_TIER ? formatNumber(MINIMUM_PRICE_AFTER_FREE_TIER) : formatNumber(rawMonthlyCost)}
                  </span>
                </div>)}

              <Link
                href={"/auth/login"}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "text-xl px-8 py-6 w-full text-center",
                )}
              >
                Get Started
              </Link>

              <p className={`text-sm text-card-foreground font-body mt-4 p-4 w-full text-center`}>
                Have large unit volumes?{" "}
                <Link
                  href="mailto:hello@measure.sh"
                  className={underlineLinkStyle}>
                  Contact us
                </Link>
                {" "}for personalised volume discounts.
              </p>

            </div>
          </div>
        </div>
        <div className="py-16" />
      </div >
      <LandingFooter />
    </main >
  )
}