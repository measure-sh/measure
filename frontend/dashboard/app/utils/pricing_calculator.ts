import { DEFAULT_EVENT_SIZE_KB, ERROR_EVENT_SIZE_KB, FREE_GB, PRICE_PER_GB_MONTH } from './pricing_constants'

const EVENTS_PER_SESSION_MINUTE = 60
const SESSION_TIME_PER_ERROR = 5
const AVG_SESSION_TIME = 10
const JOURNEY_EVENTS_PER_MINUTE = 10

export type CalculatorInputs = {
  dailyUsers: number
  averageAppOpens: number
  launchSamplePercent: number   // e.g. 0.01 means 0.01%
  errorRatePercent: number      // e.g. 0.5 means 0.5%
  perfSpanSamplePercent: number // e.g. 0.01 means 0.01%
  perfSpanCount: number
  journeySamplePercent: number  // e.g. 0.01 means 0.01%
}

export type EventBreakdown = {
  sessionStartPerDay: number
  launchPerDay: number
  crashEventsPerDay: number
  sessionTimelineEventsPerDay: number
  perfSpansPerDay: number
  journeyEventsPerDay: number
}

export type CalculatorResult = {
  events: EventBreakdown
  totalGBPerDay: number
  totalGBPerMonth: number
  isFreeTier: boolean
  rawMonthlyCost: number
}

export function computeEventBreakdown(inputs: CalculatorInputs): EventBreakdown {
  const { dailyUsers, averageAppOpens, launchSamplePercent, errorRatePercent, perfSpanSamplePercent, perfSpanCount, journeySamplePercent } = inputs

  const sessionStartPerDay = dailyUsers * averageAppOpens
  const launchPerDay = dailyUsers * averageAppOpens * (launchSamplePercent / 100)
  const crashSessionsPerDay = dailyUsers * averageAppOpens * (errorRatePercent / 100)
  const crashEventsPerDay = crashSessionsPerDay
  const sessionTimelineEventsPerDay = crashSessionsPerDay * SESSION_TIME_PER_ERROR * EVENTS_PER_SESSION_MINUTE
  const perfSpansPerDay = dailyUsers * averageAppOpens * (perfSpanSamplePercent / 100) * perfSpanCount
  const journeyEventsPerDay = dailyUsers * averageAppOpens * AVG_SESSION_TIME * JOURNEY_EVENTS_PER_MINUTE * (journeySamplePercent / 100)

  return {
    sessionStartPerDay,
    launchPerDay,
    crashEventsPerDay,
    sessionTimelineEventsPerDay,
    perfSpansPerDay,
    journeyEventsPerDay,
  }
}

export function computeBytesPerDay(events: EventBreakdown): number {
  const crashBytes = events.crashEventsPerDay * ERROR_EVENT_SIZE_KB * 1024
  const otherBytes = (events.sessionStartPerDay + events.launchPerDay + events.sessionTimelineEventsPerDay + events.perfSpansPerDay + events.journeyEventsPerDay) * DEFAULT_EVENT_SIZE_KB * 1024
  return crashBytes + otherBytes
}

export function calculate(inputs: CalculatorInputs): CalculatorResult {
  const events = computeEventBreakdown(inputs)
  const totalBytesPerDay = computeBytesPerDay(events)
  const totalGBPerDay = totalBytesPerDay / 1_000_000_000
  const totalGBPerMonth = totalGBPerDay * 30
  const isFreeTier = totalGBPerMonth <= FREE_GB
  const rawMonthlyCost = totalGBPerMonth * PRICE_PER_GB_MONTH

  return {
    events,
    totalGBPerDay,
    totalGBPerMonth,
    isFreeTier,
    rawMonthlyCost,
  }
}
