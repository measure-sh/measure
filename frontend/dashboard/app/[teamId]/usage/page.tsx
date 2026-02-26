"use client"

import { AuthzAndMembersApiStatus, DowngradeToFreeApiStatus, downgradeToFreeFromServer, emptyUsage, fetchAuthzAndMembersFromServer, FetchBillingInfoApiStatus, fetchBillingInfoFromServer, FetchStripeCheckoutSessionApiStatus, fetchStripeCheckoutSessionFromServer, FetchUsageApiStatus, fetchUsageFromServer } from '@/app/api/api_calls'
import { Button, buttonVariants } from '@/app/components/button'
import { Card } from '@/app/components/card'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import LoadingSpinner from '@/app/components/loading_spinner'

import { isBillingEnabled } from '@/app/utils/feature_flag_utils'
import { FREE_RETENTION_DAYS, FREE_UNITS, INCLUDED_PRO_UNITS, MAX_RETENTION_DAYS, MINIMUM_PRICE_AFTER_FREE_TIER, PRICE_PER_1K_UNITS_MONTH, UNIT_EXPLANATION } from '@/app/utils/pricing_constants'
import { chartTheme, underlineLinkStyle } from '@/app/utils/shared_styles'
import { ResponsivePie } from '@nivo/pie'

import DangerConfirmationDialog from '@/app/components/danger_confirmation_dialog'
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
  const [currentUserCanChangePlan, setCurrentUserCanChangePlan] = useState(false)
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
          selectedMonthUsages.push({ id: app.app_id, label: app.app_name, value: u.sessions, events: u.events, spans: u.spans })
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
        let selectedMonthUsage = parseUsageForMonth(result.data, initialMonth)
        setSelectedMonthUsage(selectedMonthUsage)
        setCurrentBillingCycleUsage(selectedMonthUsage.reduce((acc, usage) => acc + usage.events + usage.spans, 0))
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
              {/* Current Usage Summary */}
              <div className='font-body text-xl'>
                <p>Units used in current month: <span className='font-semibold'>{currentBillingCycleUsage.toLocaleString()}</span></p>
                <p className="mt-2 font-body text-xs text-muted-foreground">{UNIT_EXPLANATION}</p>
              </div>

              {/* Plan Cards */}
              <div className='flex flex-col md:flex-row gap-8 w-full mt-12'>
                {/* Free Plan Card - only show when on free plan */}
                {billingInfo?.plan === 'free' && (
                  <Card className='w-full md:w-1/2 relative'>
                    {showCurrentPlanBadge()}
                    <div className="p-4 md:p-8 flex flex-col items-center">
                      <p className='text-xl font-display'>FREE</p>
                      <p className='text-4xl font-display py-4'>$0 per month</p>
                      <ul className='list-inside space-y-2'>
                        <li className='font-body text-center'>Up to {FREE_UNITS.toLocaleString()} units per month</li>
                        <li className='font-body text-center'>{FREE_RETENTION_DAYS} days retention</li>
                        <li className='font-body text-center'>No credit card needed</li>
                      </ul>
                    </div>
                  </Card>
                )}

                {/* Pro Plan Card */}
                <Card className={`${billingInfo?.plan === 'pro' ? 'w-full' : 'w-full md:w-1/2'} bg-green-50 dark:bg-card border border-green-300 dark:border-border relative`}>
                  {billingInfo?.plan === 'pro' && showCurrentPlanBadge()}
                  <div className="p-4 md:p-8 flex flex-col items-center">
                    <p className='text-xl text-green-900 dark:text-primary font-display'>PRO</p>
                    <p className='text-4xl text-green-900 dark:text-primary font-display py-4'>${MINIMUM_PRICE_AFTER_FREE_TIER} per month</p>
                    <ul className='list-inside space-y-2'>
                      <li className='font-body text-center text-green-900 dark:text-foreground'>{INCLUDED_PRO_UNITS.toLocaleString()} units per month included</li>
                      <li className='font-body text-center text-green-900 dark:text-foreground'>Retention up to {MAX_RETENTION_DAYS} days</li>
                      <li className='font-body text-center text-green-900 dark:text-foreground'>Extra units & retention charged at:<br /> ${PRICE_PER_1K_UNITS_MONTH.toFixed(3)} per 1,000 units/month</li>
                    </ul>
                    <div className='pt-6'>
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
                        <Button
                          className={buttonVariants({ variant: "secondary" })}
                          onClick={() => setDowngradeConfirmationDialogOpen(true)}
                          disabled={!currentUserCanChangePlan || isDowngrading}
                        >
                          {isDowngrading ? 'Downgrading...' : 'Downgrade to Free'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
              {billingInfo?.plan === 'pro' && (
                <p className={`text-sm text-card-foreground font-body mt-4 p-4 w-full text-center`}>
                  Have large unit volumes?{" "}
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
              <li>Units will be limited to {FREE_UNITS.toLocaleString()} per month</li>
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
