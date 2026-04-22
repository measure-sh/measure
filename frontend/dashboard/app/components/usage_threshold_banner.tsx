"use client"

import { useBillingInfoQuery } from '@/app/query/hooks'
import { isBillingEnabled } from '@/app/utils/feature_flag_utils'
import Link from 'next/link'

type UsageThresholdBannerProps = {
  teamId: string
}

// Banner only fires for Free plan above 75% — Pro/Enterprise self-manage overages.
function thresholdFor(billingInfo: { plan?: string; bytes_granted?: number; bytes_used?: number } | undefined): number {
  if (!billingInfo || billingInfo.plan !== 'free') {
    return 0
  }
  const granted = billingInfo.bytes_granted ?? 0
  const used = billingInfo.bytes_used ?? 0
  if (granted <= 0) {
    return 0
  }
  const pct = (used / granted) * 100
  if (pct >= 100) return 100
  if (pct >= 90) return 90
  if (pct >= 75) return 75
  return 0
}

export default function UsageThresholdBanner({ teamId }: UsageThresholdBannerProps) {
  const { data: billingInfo } = useBillingInfoQuery(isBillingEnabled() ? teamId : undefined)
  const threshold = thresholdFor(billingInfo)

  if (threshold === 0) {
    return null
  }

  const usagePageUrl = `/${teamId}/usage`

  let message: string
  let bannerClass: string

  if (threshold >= 100) {
    message = '100% of free plan used — event ingestion blocked.'
    bannerClass = 'bg-red-500 text-accent-foreground'
  } else if (threshold >= 90) {
    message = '90% of free plan used.'
    bannerClass = 'bg-orange-600 text-accent-foreground'
  } else {
    message = '75% of free plan used.'
    bannerClass = 'bg-yellow-300 text-primary-foreground'
  }

  return (
    <div className={`w-full px-4 py-2 font-body text-sm flex items-center justify-between mb-8 ${bannerClass}`}>
      <span>{message}</span>
      <Link href={usagePageUrl} className="font-semibold underline ml-4 whitespace-nowrap">
        Upgrade to Pro →
      </Link>
    </div>
  )
}
