// Pricing constants.
// Pro plan: $50/mo minimum, 25 GB included, $2/GB overage (same rate as the
// included tier — $50 / 25 GB = $2/GB).
//
// IMPORTANT: these mirror the Measure Pro plan items configured in the Autumn
// dashboard (https://app.useautumn.com → Plans → measure_pro). When pricing
// changes there, update this file by hand. Used by the public /pricing page
// and the cost estimator, which can't read Autumn (no auth/team context).
// Logged-in usage page reads bytes_granted/bytes_used from BillingInfo, which
// is always Autumn-accurate.
export const PRICE_PER_GB_MONTH = 2                            // $2 per GB
export const FREE_GB = 5                                        // 5 GB free per month
export const FREE_BYTES = 5 * 1_000_000_000                      // 5 GB in bytes (decimal)
export const FREE_RETENTION_DAYS = 30                           // Free plan retention
export const PRO_RETENTION_DAYS = 90                            // Pro plan retention (fixed, 3 months)
export const MINIMUM_PRICE_AFTER_FREE_TIER = 50                 // minimum $50/month charge for Pro

// Derived constants
export const INCLUDED_PRO_GB = MINIMUM_PRICE_AFTER_FREE_TIER / PRICE_PER_GB_MONTH  // = 25 GB

// Assumed event sizes for cost estimator
export const ERROR_EVENT_SIZE_KB = 50
export const DEFAULT_EVENT_SIZE_KB = 1
