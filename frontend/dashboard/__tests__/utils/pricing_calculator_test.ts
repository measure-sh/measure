import {
  calculate,
  CalculatorInputs,
  computeBytesPerDay,
  computeEventBreakdown,
} from '@/app/utils/pricing_calculator'
import {
  DEFAULT_EVENT_SIZE_KB,
  FREE_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_MONTH,
} from '@/app/utils/pricing_constants'
import { describe, expect, it } from '@jest/globals'

// ============================================================================
// Helpers
// ============================================================================

const defaultInputs: CalculatorInputs = {
  dailyUsers: 1000,
  averageAppOpens: 3,
  launchSamplePercent: 0.01,
  errorRatePercent: 0.5,
  perfSpanSamplePercent: 0.01,
  perfSpanCount: 10,
  journeySamplePercent: 0.01,
}

function inputsWith(overrides: Partial<CalculatorInputs>): CalculatorInputs {
  return { ...defaultInputs, ...overrides }
}

// ============================================================================
// Pricing constants sanity checks
// ============================================================================

describe('pricing constants', () => {
  it('PRICE_PER_GB_MONTH is $2', () => {
    expect(PRICE_PER_GB_MONTH).toBe(2)
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
})

// ============================================================================
// Full calculator (integration)
// ============================================================================

describe('calculate', () => {
  describe('free tier', () => {
    it('qualifies when total data <= FREE_GB', () => {
      const result = calculate(inputsWith({ dailyUsers: 0 }))
      expect(result.isFreeTier).toBe(true)
      expect(result.rawMonthlyCost).toBe(0)
    })

    it('does not qualify when data exceeds FREE_GB', () => {
      const result = calculate(inputsWith({ dailyUsers: 5000000 }))
      expect(result.totalGBPerMonth).toBeGreaterThan(FREE_GB)
      expect(result.isFreeTier).toBe(false)
    })
  })

  describe('raw cost is $1/GB', () => {
    it('rawMonthlyCost equals totalGBPerMonth times PRICE_PER_GB_MONTH', () => {
      const result = calculate(defaultInputs)
      expect(result.rawMonthlyCost).toBeCloseTo(result.totalGBPerMonth * PRICE_PER_GB_MONTH)
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
      expect(result.rawMonthlyCost).toBe(0)
    })

    it('rawMonthlyCost is not clamped to minimum', () => {
      // Small non-free usage: rawMonthlyCost reflects actual GB * $1
      const result = calculate(inputsWith({ dailyUsers: 1000 }))
      if (!result.isFreeTier) {
        expect(result.rawMonthlyCost).toBe(result.totalGBPerMonth * PRICE_PER_GB_MONTH)
      }
    })
  })

  describe('data volume calculations', () => {
    it('totalGBPerMonth = totalGBPerDay * 30', () => {
      const result = calculate(defaultInputs)
      expect(result.totalGBPerMonth).toBeCloseTo(result.totalGBPerDay * 30)
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

    it('produces a valid cost within free tier for this low volume', () => {
      const result = calculate(minimalInputs)
      expect(result.totalGBPerDay).toBeGreaterThan(0)
      expect(result.isFreeTier).toBe(true)
    })
  })

  describe('single event type isolation', () => {
    const zeroInputs: CalculatorInputs = {
      dailyUsers: 1000,
      averageAppOpens: 1,
      launchSamplePercent: 0,
      errorRatePercent: 0,
      perfSpanSamplePercent: 0,
      perfSpanCount: 0,
      journeySamplePercent: 0,
    }

    it('session starts always contribute (baseline)', () => {
      const bytes = computeBytesPerDay(computeEventBreakdown(zeroInputs))
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
      expect(with10 - base).toBeCloseTo(2 * (with5 - base))
    })
  })
})
