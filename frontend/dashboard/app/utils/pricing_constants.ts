// Pricing constants
export const PRICE_PER_UNIT_DAY = 2 / 1000000 / 30 // Derived from $2 per million units per month (30 days)
export const FREE_UNITS = 1_000_000 // 1M units free per month
export const FREE_RETENTION_DAYS = 30 // 30 days retention in free plan
export const MAX_RETENTION_DAYS = 365 // 365 days max retention
export const MINIMUM_PRICE_AFTER_FREE_TIER = 50 // minimum $50 charge if above free tier
export const UNIT_EXPLANATION = "Every Crash, ANR, Bug Report, Performance Span, Launch metric, Session Timeline event, User interaction event, Custom event etc counts as 1 unit."

// Derived constants
export const PRICE_PER_1K_UNITS_MONTH = PRICE_PER_UNIT_DAY * 1000 * 30
export const INCLUDED_PRO_UNITS = MINIMUM_PRICE_AFTER_FREE_TIER / (PRICE_PER_UNIT_DAY * 30)