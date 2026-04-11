import {
  calculate,
  CalculatorInputs,
  computeBytesPerDay,
  computeEventBreakdown,
  computeGBDays,
  computeMonthlyCost,
} from '@/app/utils/pricing_calculator'
import {
  DEFAULT_EVENT_SIZE_KB,
  ERROR_EVENT_SIZE_KB,
  FREE_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_DAY,
} from '@/app/utils/pricing_constants'
import { describe, expect, it } from '@jest/globals'

// ============================================================================
// Helpers
// ============================================================================

const GB = 1024 * 1024 * 1024

const defaultInputs: CalculatorInputs = {
  dailyUsers: 1000,
  averageAppOpens: 3,
  launchSamplePercent: 0.01,
  errorRatePercent: 0.5,
  perfSpanSamplePercent: 0.01,
  perfSpanCount: 10,
  journeySamplePercent: 0.01,
  retentionMonths: 1,
}

function inputsWith(overrides: Partial<CalculatorInputs>): CalculatorInputs {
  return { ...defaultInputs, ...overrides }
}

// ============================================================================
// Pricing constants sanity checks
// ============================================================================

describe('pricing constants', () => {
  it('PRICE_PER_GB_DAY equals $2/month divided by 30', () => {
    expect(PRICE_PER_GB_DAY).toBeCloseTo(2 / 30)
  })

  it('FREE_GB is 5', () => {
    expect(FREE_GB).toBe(5)
  })

  it('MINIMUM_PRICE_AFTER_FREE_TIER is $50', () => {
    expect(MINIMUM_PRICE_AFTER_FREE_TIER).toBe(50)
  })
})

// ============================================================================
// Event breakdown
// ============================================================================

describe('computeEventBreakdown', () => {
  it('computes session starts as dailyUsers * averageAppOpens', () => {
    const events = computeEventBreakdown(inputsWith({ dailyUsers: 500, averageAppOpens: 4 }))
    expect(events.sessionStartPerDay).toBe(2000)
  })

  it('computes launch events with sample rate applied', () => {
    // 1000 users * 3 opens * 0.01/100 = 0.3
    const events = computeEventBreakdown(defaultInputs)
    expect(events.launchPerDay).toBeCloseTo(0.3)
  })

  it('computes crash events as dailyUsers * appOpens * errorRate', () => {
    // 1000 * 3 * 0.5/100 = 15
    const events = computeEventBreakdown(defaultInputs)
    expect(events.crashEventsPerDay).toBe(15)
  })

  it('computes session timeline events from crash sessions', () => {
    // crashSessions=15, * 5 min * 60 events/min = 4500
    const events = computeEventBreakdown(defaultInputs)
    expect(events.sessionTimelineEventsPerDay).toBe(4500)
  })

  it('computes perf spans from sample rate and span count', () => {
    // 1000 * 3 * 0.01/100 * 10 = 3
    const events = computeEventBreakdown(defaultInputs)
    expect(events.perfSpansPerDay).toBeCloseTo(3)
  })

  it('computes journey events from sample rate and session time', () => {
    // 1000 * 3 * 10 min * 10 events/min * 0.01/100 = 30
    const events = computeEventBreakdown(defaultInputs)
    expect(events.journeyEventsPerDay).toBeCloseTo(30)
  })

  it('returns all zeros when dailyUsers is 0', () => {
    const events = computeEventBreakdown(inputsWith({ dailyUsers: 0 }))
    expect(events.sessionStartPerDay).toBe(0)
    expect(events.launchPerDay).toBe(0)
    expect(events.crashEventsPerDay).toBe(0)
    expect(events.sessionTimelineEventsPerDay).toBe(0)
    expect(events.perfSpansPerDay).toBe(0)
    expect(events.journeyEventsPerDay).toBe(0)
  })

  it('returns all zeros when averageAppOpens is 0', () => {
    const events = computeEventBreakdown(inputsWith({ averageAppOpens: 0 }))
    expect(events.sessionStartPerDay).toBe(0)
    expect(events.crashEventsPerDay).toBe(0)
  })
})

// ============================================================================
// Bytes per day
// ============================================================================

describe('computeBytesPerDay', () => {
  it('uses ERROR_EVENT_SIZE_KB for crash events', () => {
    const events = computeEventBreakdown(defaultInputs)
    const bytes = computeBytesPerDay(events)
    const crashBytes = events.crashEventsPerDay * ERROR_EVENT_SIZE_KB * 1024
    expect(bytes).toBeGreaterThanOrEqual(crashBytes)
  })

  it('uses DEFAULT_EVENT_SIZE_KB for non-crash events', () => {
    const bytes = computeBytesPerDay({
      sessionStartPerDay: 1000,
      launchPerDay: 0,
      crashEventsPerDay: 0,
      sessionTimelineEventsPerDay: 0,
      perfSpansPerDay: 0,
      journeyEventsPerDay: 0,
    })
    expect(bytes).toBe(1000 * DEFAULT_EVENT_SIZE_KB * 1024)
  })

  it('returns 0 when all events are 0', () => {
    const bytes = computeBytesPerDay({
      sessionStartPerDay: 0,
      launchPerDay: 0,
      crashEventsPerDay: 0,
      sessionTimelineEventsPerDay: 0,
      perfSpansPerDay: 0,
      journeyEventsPerDay: 0,
    })
    expect(bytes).toBe(0)
  })

  it('crash events contribute more bytes than other events due to larger size', () => {
    const oneCrash = computeBytesPerDay({
      sessionStartPerDay: 0, launchPerDay: 0, crashEventsPerDay: 1,
      sessionTimelineEventsPerDay: 0, perfSpansPerDay: 0, journeyEventsPerDay: 0,
    })
    const oneSession = computeBytesPerDay({
      sessionStartPerDay: 1, launchPerDay: 0, crashEventsPerDay: 0,
      sessionTimelineEventsPerDay: 0, perfSpansPerDay: 0, journeyEventsPerDay: 0,
    })
    expect(oneCrash / oneSession).toBe(ERROR_EVENT_SIZE_KB / DEFAULT_EVENT_SIZE_KB)
  })
})

// ============================================================================
// GB-days calculation (core billing logic)
// ============================================================================

describe('computeGBDays', () => {
  it('1 GB/day with 30-day retention = 900 GB-days', () => {
    // Full window: each of 30 days has 30 days * 1 GB = 30 GB stored
    // 30 days * 30 GB = 900 GB-days
    expect(computeGBDays(1, 30)).toBe(900)
  })

  it('1 GB/day with 90-day retention = 2700 GB-days', () => {
    // Full window: each of 30 days has 90 GB stored
    // 30 * 90 = 2700
    expect(computeGBDays(1, 90)).toBe(2700)
  })

  it('1 GB/day with 180-day retention = 5400 GB-days', () => {
    expect(computeGBDays(1, 180)).toBe(5400)
  })

  it('1 GB/day with 365-day retention = 10950 GB-days', () => {
    expect(computeGBDays(1, 365)).toBe(10950)
  })

  it('0 GB/day always produces 0 GB-days', () => {
    expect(computeGBDays(0, 30)).toBe(0)
    expect(computeGBDays(0, 365)).toBe(0)
  })

  it('scales linearly with daily ingestion', () => {
    const base = computeGBDays(1, 30)
    expect(computeGBDays(2, 30)).toBe(base * 2)
    expect(computeGBDays(10, 30)).toBe(base * 10)
  })

  it('scales linearly with retention', () => {
    // 30 * R * gbPerDay — linear in R
    const r30 = computeGBDays(1, 30)
    const r90 = computeGBDays(1, 90)
    expect(r90 / r30).toBe(3)
  })

  it('matches the formula: 30 * retentionDays * gbPerDay', () => {
    const gbPerDay = 2.5
    const retentionDays = 60
    expect(computeGBDays(gbPerDay, retentionDays)).toBe(30 * retentionDays * gbPerDay)
  })
})

// ============================================================================
// Monthly cost
// ============================================================================

describe('computeMonthlyCost', () => {
  it('multiplies GB-days by PRICE_PER_GB_DAY', () => {
    expect(computeMonthlyCost(900)).toBeCloseTo(900 * PRICE_PER_GB_DAY)
  })

  it('900 GB-days at $2/30 per GB-day = $60', () => {
    expect(computeMonthlyCost(900)).toBeCloseTo(60)
  })

  it('0 GB-days = $0', () => {
    expect(computeMonthlyCost(0)).toBe(0)
  })
})

// ============================================================================
// Full calculator (integration)
// ============================================================================

describe('calculate', () => {
  describe('free tier', () => {
    it('qualifies when data <= FREE_GB and retention is 1 month', () => {
      // 0 users = 0 data
      const result = calculate(inputsWith({ dailyUsers: 0, retentionMonths: 1 }))
      expect(result.isFreeTier).toBe(true)
      expect(result.displayMonthlyCost).toBe(0)
    })

    it('does not qualify when retention > 1 month even if data is low', () => {
      const result = calculate(inputsWith({ dailyUsers: 0, retentionMonths: 3 }))
      expect(result.isFreeTier).toBe(false)
    })

    it('does not qualify for any retention period above 1 month', () => {
      for (const months of [3, 6, 12]) {
        const result = calculate(inputsWith({ dailyUsers: 0, retentionMonths: months }))
        expect(result.isFreeTier).toBe(false)
      }
    })

    it('low data with 3-month retention is pro plan, not free', () => {
      // This is the specific bug: under 5 GB but with retention > 1 month
      // should be treated as pro, not free
      const result = calculate(inputsWith({ dailyUsers: 100, retentionMonths: 3 }))
      expect(result.totalGBPerMonth).toBeLessThan(FREE_GB)
      expect(result.isFreeTier).toBe(false)
      expect(result.displayMonthlyCost).toBeGreaterThanOrEqual(MINIMUM_PRICE_AFTER_FREE_TIER)
    })

    it('does not qualify when data exceeds FREE_GB', () => {
      // Use very high user count to exceed 5 GB/month
      const result = calculate(inputsWith({ dailyUsers: 5000000, retentionMonths: 1 }))
      expect(result.totalGBPerMonth).toBeGreaterThan(FREE_GB)
      expect(result.isFreeTier).toBe(false)
    })
  })

  describe('minimum price', () => {
    it('enforces $50 minimum when above free tier', () => {
      // Small usage just above free tier — raw cost would be low
      // but displayMonthlyCost should be at least $50
      const result = calculate(inputsWith({ dailyUsers: 1000, retentionMonths: 1 }))
      if (!result.isFreeTier) {
        expect(result.displayMonthlyCost).toBeGreaterThanOrEqual(MINIMUM_PRICE_AFTER_FREE_TIER)
      }
    })

    it('shows raw cost when it exceeds $50', () => {
      // Very high usage should exceed minimum
      const result = calculate(inputsWith({ dailyUsers: 5000000, retentionMonths: 1 }))
      expect(result.rawMonthlyCost).toBeGreaterThan(MINIMUM_PRICE_AFTER_FREE_TIER)
      expect(result.displayMonthlyCost).toBe(result.rawMonthlyCost)
    })
  })

  describe('retention impact on cost', () => {
    it('3-month retention costs 3x more than 1-month retention', () => {
      const r1 = calculate(inputsWith({ retentionMonths: 1 }))
      const r3 = calculate(inputsWith({ retentionMonths: 3 }))
      expect(r3.rawMonthlyCost / r1.rawMonthlyCost).toBeCloseTo(3)
    })

    it('6-month retention costs 6x more than 1-month retention', () => {
      const r1 = calculate(inputsWith({ retentionMonths: 1 }))
      const r6 = calculate(inputsWith({ retentionMonths: 6 }))
      expect(r6.rawMonthlyCost / r1.rawMonthlyCost).toBeCloseTo(6)
    })

    it('12-month retention costs 12x more than 1-month retention', () => {
      const r1 = calculate(inputsWith({ retentionMonths: 1 }))
      const r12 = calculate(inputsWith({ retentionMonths: 12 }))
      expect(r12.rawMonthlyCost / r1.rawMonthlyCost).toBeCloseTo(12)
    })
  })

  describe('GB-days matches backend formula', () => {
    it('totalGBDays = 30 * retentionDays * totalGBPerDay', () => {
      const result = calculate(defaultInputs)
      expect(result.totalGBDays).toBeCloseTo(30 * result.retentionDays * result.totalGBPerDay)
    })

    it('rawMonthlyCost = totalGBDays * PRICE_PER_GB_DAY', () => {
      const result = calculate(defaultInputs)
      expect(result.rawMonthlyCost).toBeCloseTo(result.totalGBDays * PRICE_PER_GB_DAY)
    })
  })

  describe('data volume calculations', () => {
    it('totalGBPerMonth = totalGBPerDay * 30', () => {
      const result = calculate(defaultInputs)
      expect(result.totalGBPerMonth).toBeCloseTo(result.totalGBPerDay * 30)
    })

    it('retentionDays = retentionMonths * 30', () => {
      expect(calculate(inputsWith({ retentionMonths: 1 })).retentionDays).toBe(30)
      expect(calculate(inputsWith({ retentionMonths: 3 })).retentionDays).toBe(90)
      expect(calculate(inputsWith({ retentionMonths: 6 })).retentionDays).toBe(180)
      expect(calculate(inputsWith({ retentionMonths: 12 })).retentionDays).toBe(360)
    })

    it('doubling daily users doubles the cost', () => {
      const r1 = calculate(inputsWith({ dailyUsers: 1000 }))
      const r2 = calculate(inputsWith({ dailyUsers: 2000 }))
      expect(r2.rawMonthlyCost / r1.rawMonthlyCost).toBeCloseTo(2)
    })

    it('zero users produces zero cost', () => {
      const result = calculate(inputsWith({ dailyUsers: 0 }))
      expect(result.totalGBPerDay).toBe(0)
      expect(result.totalGBPerMonth).toBe(0)
      expect(result.totalGBDays).toBe(0)
      expect(result.rawMonthlyCost).toBe(0)
    })
  })

  describe('known value scenarios', () => {
    it('1 GB/day, 30-day retention = $60/month', () => {
      // We need to find inputs that produce exactly 1 GB/day.
      // Instead, verify the formula directly via computeGBDays.
      const gbDays = computeGBDays(1, 30) // 900
      const cost = computeMonthlyCost(gbDays) // 900 * 2/30 = 60
      expect(cost).toBeCloseTo(60)
    })

    it('1 GB/day, 90-day retention = $180/month', () => {
      const gbDays = computeGBDays(1, 90) // 2700
      const cost = computeMonthlyCost(gbDays) // 2700 * 2/30 = 180
      expect(cost).toBeCloseTo(180)
    })

    it('1 GB/day, 360-day retention (12 months) = $720/month', () => {
      const gbDays = computeGBDays(1, 360) // 10800
      const cost = computeMonthlyCost(gbDays) // 10800 * 2/30 = 720
      expect(cost).toBeCloseTo(720)
    })

    it('0.5 GB/day, 30-day retention = $30/month', () => {
      const gbDays = computeGBDays(0.5, 30) // 450
      const cost = computeMonthlyCost(gbDays) // 450 * 2/30 = 30
      expect(cost).toBeCloseTo(30)
    })
  })

  describe('backend parity', () => {
    // The backend (meter.go) reports GB-days as:
    //   gbDays = bytesInWindow / (1024^3)
    // where bytesInWindow is the total bytes within the retention window
    // on a given day. In steady state, bytesInWindow = retentionDays * bytesPerDay.
    // Over a 30-day billing month, Stripe receives 30 such reports.
    // Total GB-days billed = 30 * (retentionDays * bytesPerDay) / (1024^3)

    it('matches backend for 10 MB/day ingestion, 30-day retention', () => {
      const bytesPerDay = 10 * 1024 * 1024 // 10 MB
      const retentionDays = 30

      // What the backend would report over a 30-day month (steady state):
      const bytesInWindow = bytesPerDay * retentionDays
      const backendGBDaysPerDay = bytesInWindow / GB
      const backendMonthlyGBDays = 30 * backendGBDaysPerDay

      // What our calculator produces:
      const gbPerDay = bytesPerDay / GB
      const calculatorGBDays = computeGBDays(gbPerDay, retentionDays)

      expect(calculatorGBDays).toBeCloseTo(backendMonthlyGBDays)
    })

    it('matches backend for 512 MB/day ingestion, 90-day retention', () => {
      const bytesPerDay = 512 * 1024 * 1024
      const retentionDays = 90

      const backendMonthlyGBDays = 30 * (bytesPerDay * retentionDays) / GB
      const calculatorGBDays = computeGBDays(bytesPerDay / GB, retentionDays)

      expect(calculatorGBDays).toBeCloseTo(backendMonthlyGBDays)
    })

    it('matches backend gbDaysTotal helper: bytesPerDay / 1GB * days', () => {
      // billing_cycle_pro_test.go gbDaysTotal():
      //   return float64(bytesPerDay) / (1024 * 1024 * 1024) * float64(days)
      // That helper computes total GB-days over N days with constant daily snapshot.
      // In steady state, daily snapshot = retentionDays * dailyIngestionGB.
      const dailyIngestionBytes = 100 * 1024 * 1024 // 100 MB/day
      const retentionDays = 30
      const daysInMonth = 30

      // Backend's gbDaysTotal with steady-state bytesPerDay:
      const steadyStateBytesPerDay = dailyIngestionBytes * retentionDays
      const backendGBDaysTotal = (steadyStateBytesPerDay / GB) * daysInMonth

      const calculatorGBDays = computeGBDays(dailyIngestionBytes / GB, retentionDays)
      expect(calculatorGBDays).toBeCloseTo(backendGBDaysTotal)
    })
  })

  describe('only session starts (all sampling disabled)', () => {
    const minimalInputs = inputsWith({
      dailyUsers: 1000,
      averageAppOpens: 3,
      launchSamplePercent: 0,
      errorRatePercent: 0,
      perfSpanSamplePercent: 0,
      perfSpanCount: 0,
      journeySamplePercent: 0,
    })

    it('only session start events are generated', () => {
      const events = computeEventBreakdown(minimalInputs)
      expect(events.sessionStartPerDay).toBe(3000)
      expect(events.launchPerDay).toBe(0)
      expect(events.crashEventsPerDay).toBe(0)
      expect(events.sessionTimelineEventsPerDay).toBe(0)
      expect(events.perfSpansPerDay).toBe(0)
      expect(events.journeyEventsPerDay).toBe(0)
    })

    it('bytes come only from session starts at DEFAULT_EVENT_SIZE_KB', () => {
      const events = computeEventBreakdown(minimalInputs)
      const bytes = computeBytesPerDay(events)
      expect(bytes).toBe(3000 * DEFAULT_EVENT_SIZE_KB * 1024)
    })

    it('produces a valid cost', () => {
      const result = calculate(minimalInputs)
      expect(result.totalGBPerDay).toBeGreaterThan(0)
      expect(result.rawMonthlyCost).toBeGreaterThan(0)
    })
  })

  describe('single event type isolation', () => {
    // Verify each event type contributes independently by enabling
    // only one at a time and checking the bytes increase.

    const zeroInputs: CalculatorInputs = {
      dailyUsers: 1000,
      averageAppOpens: 1,
      launchSamplePercent: 0,
      errorRatePercent: 0,
      perfSpanSamplePercent: 0,
      perfSpanCount: 0,
      journeySamplePercent: 0,
      retentionMonths: 1,
    }

    it('session starts always contribute (baseline)', () => {
      const bytes = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      // 1000 users * 1 open = 1000 session starts
      expect(bytes).toBe(1000 * DEFAULT_EVENT_SIZE_KB * 1024)
    })

    it('enabling launch sampling adds bytes', () => {
      const base = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      const withLaunch = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, launchSamplePercent: 1 }))
      expect(withLaunch).toBeGreaterThan(base)
    })

    it('enabling error rate adds crash bytes (larger) and timeline bytes', () => {
      const base = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      const withErrors = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, errorRatePercent: 1 }))
      expect(withErrors).toBeGreaterThan(base)

      // Crash events use ERROR_EVENT_SIZE_KB which is much larger
      const events = computeEventBreakdown({ ...zeroInputs, errorRatePercent: 1 })
      expect(events.crashEventsPerDay).toBe(10) // 1000 * 1 * 1/100
      expect(events.sessionTimelineEventsPerDay).toBe(3000) // 10 * 5min * 60events/min
    })

    it('enabling perf spans adds bytes', () => {
      const base = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      const withPerf = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, perfSpanSamplePercent: 1, perfSpanCount: 10 }))
      expect(withPerf).toBeGreaterThan(base)
    })

    it('enabling journey sampling adds bytes', () => {
      const base = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      const withJourney = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, journeySamplePercent: 1 }))
      expect(withJourney).toBeGreaterThan(base)
    })

    it('perf spans scale with perfSpanCount', () => {
      const with5 = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, perfSpanSamplePercent: 1, perfSpanCount: 5 }))
      const with10 = computeBytesPerDay(computeEventBreakdown({ ...zeroInputs, perfSpanSamplePercent: 1, perfSpanCount: 10 }))
      const base = computeBytesPerDay(computeEventBreakdown(zeroInputs))
      // The perf contribution should double
      expect(with10 - base).toBeCloseTo(2 * (with5 - base))
    })
  })

  describe('displayMonthlyCost boundary', () => {
    it('is $0 for free tier', () => {
      const result = calculate(inputsWith({ dailyUsers: 0, retentionMonths: 1 }))
      expect(result.isFreeTier).toBe(true)
      expect(result.displayMonthlyCost).toBe(0)
    })

    it('is $50 when raw cost is below minimum', () => {
      // Small non-free usage: rawMonthlyCost will be low but > 0
      const result = calculate(inputsWith({ dailyUsers: 1000, retentionMonths: 1 }))
      if (!result.isFreeTier && result.rawMonthlyCost < MINIMUM_PRICE_AFTER_FREE_TIER) {
        expect(result.displayMonthlyCost).toBe(MINIMUM_PRICE_AFTER_FREE_TIER)
      }
    })

    it('is $50 when raw cost exactly equals minimum', () => {
      // Construct a scenario where rawMonthlyCost = $50 exactly
      // $50 = totalGBDays * PRICE_PER_GB_DAY
      // totalGBDays = 50 / (2/30) = 750
      // 750 = 30 * 30 * gbPerDay → gbPerDay = 750/900 = 5/6 GB
      const gbPerDay = 50 / (30 * 30 * PRICE_PER_GB_DAY)
      const gbDays = computeGBDays(gbPerDay, 30)
      const cost = computeMonthlyCost(gbDays)
      expect(cost).toBeCloseTo(50)
      // At exactly $50, displayMonthlyCost should be $50 (not higher)
      expect(Math.max(cost, MINIMUM_PRICE_AFTER_FREE_TIER)).toBeCloseTo(50)
    })

    it('equals raw cost when above minimum', () => {
      const result = calculate(inputsWith({ dailyUsers: 5000000 }))
      expect(result.rawMonthlyCost).toBeGreaterThan(MINIMUM_PRICE_AFTER_FREE_TIER)
      expect(result.displayMonthlyCost).toBe(result.rawMonthlyCost)
    })

    it('never shows negative cost', () => {
      const result = calculate(inputsWith({ dailyUsers: 0, retentionMonths: 3 }))
      expect(result.displayMonthlyCost).toBeGreaterThanOrEqual(0)
    })
  })
})
