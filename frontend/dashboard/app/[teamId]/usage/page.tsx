"use client"

import { AuthzAndMembersApiStatus, DowngradeToFreeApiStatus, downgradeToFreeFromServer, emptyUsage, fetchAuthzAndMembersFromServer, FetchBillingInfoApiStatus, fetchBillingInfoFromServer, FetchCustomerPortalUrlApiStatus, fetchCustomerPortalUrlFromServer, FetchStripeCheckoutSessionApiStatus, fetchStripeCheckoutSessionFromServer, FetchSubscriptionInfoApiStatus, fetchSubscriptionInfoFromServer, FetchUsageApiStatus, fetchUsageFromServer } from '@/app/api/api_calls'
import { Button, buttonVariants } from '@/app/components/button'
import { Card } from '@/app/components/card'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import LoadingSpinner from '@/app/components/loading_spinner'
import { Skeleton } from '@/app/components/skeleton'

import { isBillingEnabled } from '@/app/utils/feature_flag_utils'
import { formatBytes } from '@/app/utils/number_utils'
import { FREE_BYTES, FREE_GB, FREE_RETENTION_DAYS, INCLUDED_PRO_GB, MAX_RETENTION_DAYS, MINIMUM_PRICE_AFTER_FREE_TIER, PRICE_PER_GB_MONTH } from '@/app/utils/pricing_constants'
import { chartTheme, underlineLinkStyle } from '@/app/utils/shared_styles'
import { ResponsivePie } from '@nivo/pie'

import DangerConfirmationDialog from '@/app/components/danger_confirmation_dialog'
import { Progress } from '@/app/components/progress'
import { toastNegative, toastPositive } from '@/app/utils/use_toast'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Usage({ params }: { params: { teamId: string } }) {
  type BillingInfo = {
    team_id: string
    plan: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
    updated_at: string
  }

  type AppMonthlyUsage = {
    id: string
    label: string
    value: number
    events: number
    spans: number
    bytes_in: number
  }

  type SubscriptionInfo = {
    status: string
    current_period_start: number
    current_period_end: number
    upcoming_invoice: {
      amount_due: number
      currency: string
    } | null
    billing_cycle_usage: number
  }

  const [fetchUsageApiStatus, setFetchUsageApiStatus] = useState(FetchUsageApiStatus.Loading)
  const [usage, setUsage] = useState(emptyUsage)
  const [months, setMonths] = useState<string[]>()
  const [currentBillingCycleUsage, setCurrentBillingCycleUsage] = useState<number>(0)
  const [selectedMonth, setSelectedMonth] = useState<string>()
  const [selectedMonthUsage, setSelectedMonthUsage] = useState<AppMonthlyUsage[]>()
  const [fetchBillingInfoApiStatus, setFetchBillingInfoApiStatus] = useState(FetchBillingInfoApiStatus.Loading)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isDowngrading, setIsDowngrading] = useState(false)
  const [downgradeConfirmationDialogOpen, setDowngradeConfirmationDialogOpen] = useState(false)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [currentUserCanChangePlan, setCurrentUserCanChangePlan] = useState(false)
  const [fetchSubscriptionInfoApiStatus, setFetchSubscriptionInfoApiStatus] = useState(FetchSubscriptionInfoApiStatus.Loading)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const { theme } = useTheme()

  const getCurrentUserCanChangePlan = async () => {
    const result = await fetchAuthzAndMembersFromServer(params.teamId)

    switch (result.status) {
      case AuthzAndMembersApiStatus.Error:
        break
      case AuthzAndMembersApiStatus.Success:
        setCurrentUserCanChangePlan(result.data.can_change_billing === true)
        break
    }
  }

  const freeUsagePercent = billingInfo?.plan === 'free' && FREE_BYTES > 0
    ? Math.min(100, currentBillingCycleUsage > 0
      ? Math.max(0.01, Math.round((currentBillingCycleUsage / FREE_BYTES) * 10000) / 100)
      : 0)
    : 0

  useEffect(() => {
    if (isBillingEnabled()) {
      getCurrentUserCanChangePlan()
    }
  }, [params.teamId])

  // Handle success/cancel from Stripe redirect
  useEffect(() => {
    // Small delay to ensure toast provider is mounted
    const timer = setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search)
      const success = searchParams.get('success')
      const canceled = searchParams.get('canceled')

      if (success === 'true') {
        toastPositive("Successfully upgraded to Pro! Your plan is now active.")
        pollForPlan('pro')
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)
      } else if (canceled === 'true') {
        toastNegative("Checkout canceled", "You can try again anytime.")
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  function parseMonths(data: typeof emptyUsage): string[] {
    const monthYearSet: Set<string> = new Set()

    data.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        monthYearSet.add(u.month_year)
      })
    })

    return Array.from(monthYearSet)
  }

  function parseUsageForMonth(usage: typeof emptyUsage, month: string): AppMonthlyUsage[] {
    const selectedMonthUsages: AppMonthlyUsage[] = []

    usage.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        if (u.month_year === month) {
          selectedMonthUsages.push({ id: app.app_id, label: app.app_name, value: u.sessions, events: u.events, spans: u.spans, bytes_in: u.bytes_in })
        }
      })
    })
    return selectedMonthUsages
  }

  const getUsage = async () => {
    setFetchUsageApiStatus(FetchUsageApiStatus.Loading)

    const result = await fetchUsageFromServer(params.teamId)

    switch (result.status) {
      case FetchUsageApiStatus.NoApps:
        setFetchUsageApiStatus(FetchUsageApiStatus.NoApps)
        break
      case FetchUsageApiStatus.Error:
        setFetchUsageApiStatus(FetchUsageApiStatus.Error)
        break
      case FetchUsageApiStatus.Success:
        setFetchUsageApiStatus(FetchUsageApiStatus.Success)
        setUsage(result.data)
        let months = parseMonths(result.data)
        let initialMonth = months[months.length - 1]
        setMonths(months)
        setSelectedMonth(initialMonth)
        let initialMonthUsage = parseUsageForMonth(result.data, initialMonth)
        setSelectedMonthUsage(initialMonthUsage)
        setCurrentBillingCycleUsage(initialMonthUsage.reduce((acc, usage) => acc + usage.bytes_in, 0))
        break
    }
  }

  useEffect(() => {
    getUsage()
  }, [])

  useEffect(() => {
    setSelectedMonthUsage(parseUsageForMonth(usage, selectedMonth!))
  }, [selectedMonth])

  const getBillingInfo = async () => {
    setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Loading)

    const result = await fetchBillingInfoFromServer(params.teamId)

    switch (result.status) {
      case FetchBillingInfoApiStatus.Error:
        setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Error)
        break
      case FetchBillingInfoApiStatus.Success:
        setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Success)
        setBillingInfo(result.data)
        break
    }
  }

  const pollForPlan = async (targetPlan: string) => {
    for (let i = 0; i < 60; i++) {
      const result = await fetchBillingInfoFromServer(params.teamId)
      if (result.status === FetchBillingInfoApiStatus.Success && result.data?.plan === targetPlan) {
        setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Success)
        setBillingInfo(result.data)
        return
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    // Fallback: show whatever the current state is
    getBillingInfo()
  }

  useEffect(() => {
    if (isBillingEnabled()) {
      getBillingInfo()
    }
  }, [])

  const getSubscriptionInfo = async () => {
    setFetchSubscriptionInfoApiStatus(FetchSubscriptionInfoApiStatus.Loading)

    const result = await fetchSubscriptionInfoFromServer(params.teamId)

    switch (result.status) {
      case FetchSubscriptionInfoApiStatus.Error:
        setFetchSubscriptionInfoApiStatus(FetchSubscriptionInfoApiStatus.Error)
        break
      case FetchSubscriptionInfoApiStatus.Success:
        setFetchSubscriptionInfoApiStatus(FetchSubscriptionInfoApiStatus.Success)
        setSubscriptionInfo(result.data)
        break
    }
  }

  useEffect(() => {
    if (isBillingEnabled() && billingInfo?.plan === 'pro' && currentUserCanChangePlan) {
      getSubscriptionInfo()
    }
  }, [billingInfo, currentUserCanChangePlan])

  const handleUpgrade = async () => {
    setIsUpgrading(true)

    const currentUrl = window.location.href.split('?')[0]
    const result = await fetchStripeCheckoutSessionFromServer(
      params.teamId,
      `${currentUrl}?success=true`,
      `${currentUrl}?canceled=true`
    )

    if (result.status === FetchStripeCheckoutSessionApiStatus.Success) {
      if (result.data?.already_upgraded) {
        toastPositive("Your Pro plan is now active! A previous subscription was found and applied.")
        getBillingInfo()
        setIsUpgrading(false)
      } else if (result.data?.checkout_url) {
        window.location.href = result.data.checkout_url
      } else {
        toastNegative("Failed to start checkout", "Please try again.")
        setIsUpgrading(false)
      }
    } else {
      toastNegative("Failed to start checkout", "Please try again.")
      setIsUpgrading(false)
    }
  }

  const handleDowngrade = async () => {
    setIsDowngrading(true)

    const result = await downgradeToFreeFromServer(params.teamId)

    switch (result.status) {
      case DowngradeToFreeApiStatus.Error:
        toastNegative("Failed to downgrade", "Please try again.")
        setIsDowngrading(false)
        break
      case DowngradeToFreeApiStatus.Success:
        await pollForPlan('free')
        toastPositive("Successfully downgraded to Free plan.")
        setIsDowngrading(false)
        break
    }
  }

  const handleManageBilling = async () => {
    setIsLoadingPortal(true)

    const returnUrl = window.location.href.split('?')[0]
    const result = await fetchCustomerPortalUrlFromServer(params.teamId, returnUrl)

    switch (result.status) {
      case FetchCustomerPortalUrlApiStatus.Success:
        if (result.data?.url) {
          window.location.href = result.data.url
        } else {
          toastNegative("Failed to open billing portal", "No portal URL returned.")
          setIsLoadingPortal(false)
        }
        break
      case FetchCustomerPortalUrlApiStatus.Error:
        toastNegative("Failed to open billing portal", "Please try again.")
        setIsLoadingPortal(false)
        break
      case FetchCustomerPortalUrlApiStatus.Cancelled:
        toastNegative("Failed to open billing portal", "Request was cancelled.")
        setIsLoadingPortal(false)
        break
    }
  }

  // @ts-ignore
  const CenteredMetric = ({ centerX, centerY }) => {
    let totalSessions = 0
    let totalEvents = 0
    let totalSpans = 0
    selectedMonthUsage!.forEach(appMonthlyUsage => {
      totalSessions += appMonthlyUsage.value
      totalEvents += appMonthlyUsage.events
      totalSpans += appMonthlyUsage.spans
    })

    return (
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="central"
        className='font-display font-semibold fill-foreground'
      >
        <tspan className='text-2xl' x={centerX} dy="-0.7em">Sessions: {totalSessions}</tspan>
        <tspan className='text-sm' x={centerX} dy="2em">Events: {totalEvents}</tspan>
        <tspan className='text-sm' x={centerX} dy="1.4em">Spans: {totalSpans}</tspan>
      </text>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Usage</p>
      <div className="py-4" />

      {/* Error states */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Error && <p className="font-body text-sm">Error fetching usage data, please check if Team ID is valid or refresh page to try again</p>}
      {fetchUsageApiStatus === FetchUsageApiStatus.NoApps && <p className='font-body text-sm'>Looks like you don&apos;t have any apps yet. Get started by <Link className={underlineLinkStyle} href={`apps`}>creating your first app!</Link></p>}

      {/* Main UI */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Loading && <LoadingSpinner />}
      {fetchUsageApiStatus === FetchUsageApiStatus.Success &&
        <div className="flex flex-col items-start w-full">
          <DropdownSelect title="Month" type={DropdownSelectType.SingleString} items={months!} initialSelected={selectedMonth!} onChangeSelected={(item) => setSelectedMonth(item as string)} />
          <div className="py-4" />
          <div className='w-full h-[36rem]'>
            <ResponsivePie
              data={selectedMonthUsage!}
              theme={chartTheme}
              animate
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.7}
              enableArcLabels={false}
              arcLinkLabel={d => `${d.label}`}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: 'color' }}
              tooltip={({ datum: { id, label, value, color } }) => {
                return (
                  <div className="bg-accent text-accent-foreground flex flex-col py-2 px-4 font-display rounded-md">
                    <p className='text-sm font-semibold' style={{ color: color }}>{label}</p>
                    <div className='py-0.5' />
                    <p className='text-xs'>Sessions: {value}</p>
                    <p className='text-xs'>Events: {selectedMonthUsage?.find((i) => i.id === id)!.events!}</p>
                    <p className='text-xs'>Spans: {selectedMonthUsage?.find((i) => i.id === id)!.spans}</p>
                  </div>
                )
              }}
              legends={[]}
              layers={['arcs', 'arcLabels', 'arcLinkLabels', 'legends', CenteredMetric]}
            />
          </div>
        </div>}

      {isBillingEnabled() &&
        <div className='flex flex-col items-start py-4 w-full'>
          <p className="font-display text-4xl max-w-6xl text-center">Billing</p>
          <div className="py-4" />

          {/* Error states */}
          {fetchBillingInfoApiStatus === FetchBillingInfoApiStatus.Error && <p className="font-body text-sm">Error fetching billing data, please check if Team ID is valid or refresh page to try again</p>}

          {/* Main UI */}
          {fetchBillingInfoApiStatus === FetchBillingInfoApiStatus.Loading && <LoadingSpinner />}
          {fetchBillingInfoApiStatus === FetchBillingInfoApiStatus.Success &&
            <div className="flex flex-col items-start w-full">
              {/* Progress indicator for Free plan */}
              {billingInfo?.plan === 'free' && (
                <div className='w-full max-w-6xl'>
                  <div className='flex items-center justify-between mb-2'>
                    <p className='font-body'>Free plan usage: <span className='font-semibold'>{freeUsagePercent}%</span></p>
                    <p className='font-body text-muted-foreground'>{formatBytes(currentBillingCycleUsage)} used of {FREE_GB} GB</p>
                  </div>
                  <Progress value={freeUsagePercent} />
                </div>
              )}

              {/* Plan Cards */}
              <div className='flex flex-col md:flex-row gap-8 w-full mt-12'>
                {/* Free Plan Card - only show when on free plan */}
                {billingInfo?.plan === 'free' && (
                  <Card className='w-full md:w-1/2 relative'>
                    {showCurrentPlanBadge()}
                    <div className="p-4 md:p-8 flex flex-col items-center">
                      <p className='text-xl font-display'>FREE</p>
                      <p className='text-4xl font-display py-2'>$0 per month</p>
                      <ul className='list-disc space-y-2 mt-6'>
                        <li className='font-body'>Up to {FREE_GB} GB per month</li>
                        <li className='font-body'>{FREE_RETENTION_DAYS} days retention</li>
                        <li className='font-body'>No credit card needed</li>
                      </ul>
                    </div>
                  </Card>
                )}

                {/* Pro Plan Card */}
                <Card className={`${billingInfo?.plan === 'pro' ? 'w-full' : 'w-full md:w-1/2'} bg-green-50 dark:bg-card border border-green-300 dark:border-border relative`}>
                  {billingInfo?.plan === 'pro' && showCurrentPlanBadge()}
                  <div className="p-4 md:p-8 flex flex-col items-center">
                    <p className='text-xl text-green-900 dark:text-primary font-display'>PRO</p>
                    <p className='text-4xl text-green-900 dark:text-primary font-display py-2'>${MINIMUM_PRICE_AFTER_FREE_TIER} per month</p>
                    {billingInfo?.plan !== 'pro' && (
                      <ul className='list-disc space-y-2 mt-6'>
                        <li className='font-body text-green-900 dark:text-foreground'>{INCLUDED_PRO_GB} GB per month included</li>
                        <li className='font-body text-green-900 dark:text-foreground'>Retention up to {MAX_RETENTION_DAYS} days</li>
                        <li className='font-body text-green-900 dark:text-foreground'>Extra data & retention charged at:<br /> ${PRICE_PER_GB_MONTH.toFixed(2)} per GB/month</li>
                      </ul>
                    )}
                    {billingInfo?.plan === 'pro' && currentUserCanChangePlan && fetchSubscriptionInfoApiStatus === FetchSubscriptionInfoApiStatus.Loading && (
                      <div className='mt-4 w-full max-w-md space-y-3'>
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                      </div>
                    )}
                    {billingInfo?.plan === 'pro' && currentUserCanChangePlan && fetchSubscriptionInfoApiStatus === FetchSubscriptionInfoApiStatus.Success && subscriptionInfo && (
                      <div className='mt-4 font-body text-start space-y-1'>
                        <ul className='list-disc list-inside'>
                          <li className='text-green-900 dark:text-foreground'>
                            Status: <span className='font-semibold capitalize'>{subscriptionInfo.status}</span>
                          </li>
                          <li className='text-green-900 dark:text-foreground'>
                            Current billing cycle: <span className='font-semibold'>
                              {new Date(subscriptionInfo.current_period_start * 1000).toLocaleDateString()} – {new Date(subscriptionInfo.current_period_end * 1000).toLocaleDateString()}
                            </span>
                          </li>
                          <li className='text-green-900 dark:text-foreground'>
                            Next invoice: <span className='font-semibold'>
                              {new Date(subscriptionInfo.current_period_end * 1000).toLocaleDateString()}
                            </span>
                          </li>
                          <li className='text-green-900 dark:text-foreground'>
                            GB-days used (data x retention days based on usage so far): <span className='font-semibold'>
                              {subscriptionInfo.billing_cycle_usage.toLocaleString()}
                            </span>
                          </li>
                          {subscriptionInfo.upcoming_invoice && (
                            <li className='text-green-900 dark:text-foreground'>
                              Upcoming invoice amount (based on usage so far): <span className='font-semibold'>
                                {(subscriptionInfo.upcoming_invoice.amount_due / 100).toLocaleString(undefined, {
                                  style: 'currency',
                                  currency: subscriptionInfo.upcoming_invoice.currency.toUpperCase(),
                                })}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className='pt-12'>
                      {billingInfo?.plan === 'free' && (
                        <Button
                          className={buttonVariants({ variant: "default" })}
                          onClick={handleUpgrade}
                          disabled={!currentUserCanChangePlan || isUpgrading}
                        >
                          {isUpgrading ? 'Redirecting...' : 'Upgrade to Pro'}
                        </Button>
                      )}
                      {billingInfo?.plan === 'pro' && (
                        <div className='flex flex-col gap-3 items-center'>
                          <Button
                            className="w-56"
                            variant={"default"}
                            onClick={handleManageBilling}
                            disabled={!currentUserCanChangePlan || isLoadingPortal || isDowngrading}
                          >
                            {isLoadingPortal ? 'Redirecting...' : 'Manage Billing'}
                          </Button>
                          <Button
                            className="w-56"
                            variant={"destructive"}
                            onClick={() => setDowngradeConfirmationDialogOpen(true)}
                            disabled={!currentUserCanChangePlan || isDowngrading || isLoadingPortal}
                          >
                            {isDowngrading ? 'Downgrading...' : 'Downgrade to Free'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
              {billingInfo?.plan === 'pro' && (
                <p className={`text-sm text-card-foreground font-body mt-4 p-4 w-full text-center`}>
                  Have large data volumes?{" "}
                  <Link
                    href="mailto:hello@measure.sh"
                    className={underlineLinkStyle}>
                    Contact us
                  </Link>
                  {" "}for personalised volume discounts.
                </p>
              )}
            </div>}
        </div>}

      <DangerConfirmationDialog
        body={
          <div className="font-body">
            <p>Are you sure you want to downgrade to the <span className="font-display font-bold">Free</span> plan?</p>
            <ul className="list-disc list-inside pt-2 text-sm">
              <li>Your subscription will be canceled immediately</li>
              <li>All app retention will be reset to {FREE_RETENTION_DAYS} days</li>
              <li>Data will be limited to {FREE_GB} GB per month</li>
            </ul>
          </div>
        }
        open={downgradeConfirmationDialogOpen}
        affirmativeText="Yes, downgrade"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setDowngradeConfirmationDialogOpen(false)
          handleDowngrade()
        }}
        onCancelAction={() => setDowngradeConfirmationDialogOpen(false)}
      />
    </div>
  )
}

function showCurrentPlanBadge() {
  return <div className='absolute top-4 right-4 bg-green-700 dark:bg-accent text-white dark:text-accent-foreground text-xs font-display px-2 py-1 rounded'>
    Current Plan
  </div>
}
