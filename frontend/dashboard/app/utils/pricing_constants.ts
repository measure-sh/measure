// Pricing constants — GB-days model
export const PRICE_PER_GB_DAY = 2 / 30                    // $2 per GB per month (30 days)
export const FREE_GB = 5                                    // 5 GB free per month
export const FREE_BYTES = 5 * 1024 * 1024 * 1024           // 5 GB in bytes
export const FREE_RETENTION_DAYS = 30                       // 30 days retention in free plan
export const MAX_RETENTION_DAYS = 365                       // 365 days max retention
export const MINIMUM_PRICE_AFTER_FREE_TIER = 50             // minimum $50/month charge if above free tier

// Derived constants
export const PRICE_PER_GB_MONTH = PRICE_PER_GB_DAY * 30    // = $2
export const INCLUDED_PRO_GB = MINIMUM_PRICE_AFTER_FREE_TIER / PRICE_PER_GB_MONTH  // = 25 GB

// Assumed event sizes for cost estimator
export const ERROR_EVENT_SIZE_KB = 50
export const DEFAULT_EVENT_SIZE_KB = 1
