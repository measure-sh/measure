"use client"

import { FetchBillingUsageThresholdApiStatus, fetchBillingUsageThresholdFromServer } from '@/app/api/api_calls'
import { isBillingEnabled } from '@/app/utils/feature_flag_utils'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type UsageThresholdBannerProps = {
  teamId: string
}

export default function UsageThresholdBanner({ teamId }: UsageThresholdBannerProps) {
  const [threshold, setThreshold] = useState<number>(0)

  useEffect(() => {
    if (!isBillingEnabled()) {
      return
    }

    const fetchData = async () => {
      const result = await fetchBillingUsageThresholdFromServer(teamId)
      if (result.status !== FetchBillingUsageThresholdApiStatus.Success) {
        return
      }
      setThreshold(result.data?.threshold ?? 0)
    }

    fetchData()
  }, [teamId])

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
