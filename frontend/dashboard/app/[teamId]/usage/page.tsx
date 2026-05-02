"use client";

import { Button, buttonVariants } from "@/app/components/button";
import { Card } from "@/app/components/card";
import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import { Skeleton } from "@/app/components/skeleton";

import {
  fetchCustomerPortalUrl,
  useBillingInfoQuery,
  useDowngradeToFreeMutation,
  useHandleUpgradeMutation,
  useUndoDowngradeMutation,
  useUsagePermissionsQuery,
  useUsageQuery,
} from "@/app/query/hooks";
import { isBillingEnabled } from "@/app/utils/feature_flag_utils";
import { formatBytesSI } from "@/app/utils/number_utils";
import {
  FREE_GB,
  FREE_RETENTION_DAYS,
  INCLUDED_PRO_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_MONTH,
  PRO_RETENTION_DAYS,
} from "@/app/utils/pricing_constants";
import { chartTheme, underlineLinkStyle } from "@/app/utils/shared_styles";
import { ResponsivePie } from "@nivo/pie";

import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog";
import { Progress } from "@/app/components/progress";
import { toastNegative, toastPositive } from "@/app/utils/use_toast";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

type AppMonthlyUsage = {
  id: string;
  label: string;
  value: number;
  events: number;
  spans: number;
  bytes_in: number;
};

// formatDataLine renders the unified "Data" line shown on the user's
// current plan card. All inputs come from BillingInfo (i.e. Autumn) so the
// caller doesn't need plan-specific constants.
//
//   - bytes_unlimited           → "Unlimited"
//   - else, with overage usage  → "X of Y used, Z overage"
//   - else                      → "X of Y used"
function formatDataLine(billingInfo: {
  bytes_used?: number;
  bytes_granted?: number;
  bytes_unlimited?: boolean;
  bytes_overage_allowed?: boolean;
}): string {
  if (billingInfo?.bytes_unlimited) {
    return "Unlimited";
  }
  const used = billingInfo?.bytes_used ?? 0;
  const granted = billingInfo?.bytes_granted ?? 0;
  const base = `${formatBytesSI(used)} of ${formatBytesSI(granted)} used`;
  if (billingInfo?.bytes_overage_allowed && used > granted) {
    return `${base}, ${formatBytesSI(used - granted)} overage`;
  }
  return base;
}

function parseMonths(data: any[]): string[] {
  const monthYearSet: Set<string> = new Set();
  data.forEach((app) => {
    app.monthly_app_usage.forEach((u: any) => {
      monthYearSet.add(u.month_year);
    });
  });
  return Array.from(monthYearSet);
}

function parseUsageForMonth(usage: any[], month: string): AppMonthlyUsage[] {
  const result: AppMonthlyUsage[] = [];
  usage.forEach((app) => {
    app.monthly_app_usage.forEach((u: any) => {
      if (u.month_year === month) {
        result.push({
          id: app.app_id,
          label: app.app_name,
          value: u.sessions,
          events: u.events,
          spans: u.spans,
          bytes_in: u.bytes_in,
        });
      }
    });
  });
  return result;
}

export default function Usage({ params }: { params: { teamId: string } }) {
  const { theme } = useTheme();

  // UI-only local state
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [isUndoingDowngrade, setIsUndoingDowngrade] = useState(false);
  const [downgradeConfirmationDialogOpen, setDowngradeConfirmationDialogOpen] =
    useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  // Month selection state
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(
    undefined,
  );

  // After a successful Stripe redirect-back, rapid-poll the billing info
  // query until Autumn confirms the upgrade. (Downgrade no longer polls — the
  // /billing/downgrade endpoint returns synchronously and the next refetch
  // reflects canceled_at.)
  const [awaitingProConfirmation, setAwaitingProConfirmation] = useState(false);

  // TanStack Query: reads
  const { data: usageData, status: usageStatus } = useUsageQuery(params.teamId);
  const { data: permissions } = useUsagePermissionsQuery(
    isBillingEnabled() ? params.teamId : undefined,
  );
  const { data: billingInfo, status: billingInfoStatus } = useBillingInfoQuery(
    isBillingEnabled() ? params.teamId : undefined,
    {
      refetchInterval: awaitingProConfirmation
        ? (q) => (q.state.data?.plan === "pro" ? false : 1000)
        : false,
    },
  );
  const currentUserCanChangePlan = permissions?.canChangePlan === true;

  // TanStack Query: mutations
  const upgradeMutation = useHandleUpgradeMutation();
  const downgradeMutation = useDowngradeToFreeMutation();
  const undoDowngradeMutation = useUndoDowngradeMutation();

  // Derived data from usage
  const months = usageData ? parseMonths(usageData) : [];
  const effectiveMonth =
    selectedMonth ??
    (months.length > 0 ? months[months.length - 1] : undefined);
  const selectedMonthUsage =
    usageData && effectiveMonth
      ? parseUsageForMonth(usageData, effectiveMonth)
      : [];

  // Set initial month when usage data loads
  useEffect(() => {
    if (usageData && !selectedMonth && months.length > 0) {
      setSelectedMonth(months[months.length - 1]);
    }
  }, [usageData]);

  // Handle success/cancel from Autumn-driven checkout redirect
  useEffect(() => {
    const timer = setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");

      if (success === "true") {
        toastPositive("Successfully upgraded to Pro! Your plan is now active.");
        setAwaitingProConfirmation(true);
        window.history.replaceState({}, "", window.location.pathname);
      } else if (canceled === "true") {
        toastNegative("Checkout canceled", "You can try again anytime.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Stop polling once Autumn confirms Pro.
  useEffect(() => {
    if (awaitingProConfirmation && billingInfo?.plan === "pro") {
      setAwaitingProConfirmation(false);
    }
  }, [billingInfo, awaitingProConfirmation]);

  const bytesGranted = billingInfo?.bytes_granted ?? 0;
  const bytesUsed = billingInfo?.bytes_used ?? 0;
  const cancellationScheduled =
    billingInfo?.plan === "pro" &&
    (billingInfo?.canceled_at ?? 0) > 0 &&
    (billingInfo?.current_period_end ?? 0) * 1000 > Date.now();
  const freeUsagePercent =
    billingInfo?.plan === "free" && bytesGranted > 0
      ? Math.min(
          100,
          bytesUsed > 0
            ? Math.max(
                0.01,
                Math.round((bytesUsed / bytesGranted) * 10000) / 100,
              )
            : 0,
        )
      : 0;

  const onUpgrade = async () => {
    setIsUpgrading(true);
    const currentUrl = window.location.href.split("?")[0];

    upgradeMutation.mutate(
      { teamId: params.teamId, successUrl: `${currentUrl}?success=true` },
      {
        onSuccess: (data) => {
          if (data?.already_upgraded) {
            toastPositive(
              "Your Pro plan is now active! A previous subscription was found and applied.",
            );
            setIsUpgrading(false);
          } else if (data?.checkout_url) {
            window.location.href = data.checkout_url;
          } else {
            toastNegative("Failed to start checkout", "Please try again.");
            setIsUpgrading(false);
          }
        },
        onError: () => {
          toastNegative("Failed to start checkout", "Please try again.");
          setIsUpgrading(false);
        },
      },
    );
  };

  const onDowngrade = async () => {
    setIsDowngrading(true);

    downgradeMutation.mutate(
      { teamId: params.teamId },
      {
        onSuccess: () => {
          toastPositive(
            "Cancellation scheduled. Pro stays active until the end of the current billing cycle.",
          );
          setIsDowngrading(false);
        },
        onError: () => {
          toastNegative("Failed to schedule cancellation", "Please try again.");
          setIsDowngrading(false);
        },
      },
    );
  };

  const onUndoDowngrade = async () => {
    setIsUndoingDowngrade(true);

    undoDowngradeMutation.mutate(
      { teamId: params.teamId },
      {
        onSuccess: () => {
          toastPositive(
            "Cancellation undone. Your Pro plan continues as normal.",
          );
          setIsUndoingDowngrade(false);
        },
        onError: () => {
          toastNegative("Failed to undo cancellation", "Please try again.");
          setIsUndoingDowngrade(false);
        },
      },
    );
  };

  const onManageBilling = async () => {
    setIsLoadingPortal(true);
    const returnUrl = window.location.href.split("?")[0];
    const result = await fetchCustomerPortalUrl(params.teamId, returnUrl);

    if (result.redirect) {
      window.location.href = result.redirect;
    } else {
      toastNegative("Failed to open billing portal", result.error);
      setIsLoadingPortal(false);
    }
  };

  // @ts-ignore
  const CenteredMetric = ({ centerX, centerY }) => {
    let totalSessions = 0;
    let totalEvents = 0;
    let totalSpans = 0;
    selectedMonthUsage.forEach((appMonthlyUsage) => {
      totalSessions += appMonthlyUsage.value;
      totalEvents += appMonthlyUsage.events;
      totalSpans += appMonthlyUsage.spans;
    });

    return (
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display font-semibold fill-foreground"
      >
        <tspan className="text-2xl" x={centerX} dy="-0.7em">
          Sessions: {totalSessions}
        </tspan>
        <tspan className="text-sm" x={centerX} dy="2em">
          Events: {totalEvents}
        </tspan>
        <tspan className="text-sm" x={centerX} dy="1.4em">
          Spans: {totalSpans}
        </tspan>
      </text>
    );
  };

  // Determine usage display status
  const usageHasNoApps = usageStatus === "success" && usageData === null;
  const usageIsError = usageStatus === "error";
  const usageIsLoading = usageStatus === "pending";
  const usageIsSuccess = usageStatus === "success" && usageData !== null;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      {/* Error states */}
      {usageIsError && (
        <p className="font-body text-sm">
          Error fetching usage data, please check if Team ID is valid or refresh
          page to try again
        </p>
      )}
      {usageHasNoApps && (
        <p className="font-body text-sm">
          Looks like you don&apos;t have any apps yet. Get started by{" "}
          <Link className={underlineLinkStyle} href={`apps`}>
            creating your first app!
          </Link>
        </p>
      )}

      {/* Main UI */}
      {usageIsLoading && (
        <div className="flex flex-col items-start w-full">
          <Skeleton className="h-9 w-[150px]" />
          <div className="py-4" />
          <div className="w-full h-[36rem] flex items-center justify-center">
            <Skeleton className="w-72 h-72 rounded-full" />
          </div>
        </div>
      )}
      {usageIsSuccess && (
        <div className="flex flex-col items-start w-full">
          <DropdownSelect
            title="Month"
            type={DropdownSelectType.SingleString}
            items={months}
            initialSelected={effectiveMonth!}
            onChangeSelected={(item) => setSelectedMonth(item as string)}
          />
          <div className="py-4" />
          <div className="w-full h-[36rem]">
            <ResponsivePie
              data={selectedMonthUsage}
              theme={chartTheme}
              animate
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.7}
              enableArcLabels={false}
              arcLinkLabel={(d) => `${d.label}`}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: theme === "dark" ? "tableau10" : "nivo" }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: "color" }}
              tooltip={({ datum: { id, label, value, color } }) => {
                return (
                  <div className="bg-accent text-accent-foreground flex flex-col py-2 px-4 font-display rounded-md">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: color }}
                    >
                      {label}
                    </p>
                    <div className="py-0.5" />
                    <p className="text-xs">Sessions: {value}</p>
                    <p className="text-xs">
                      Events:{" "}
                      {selectedMonthUsage?.find((i) => i.id === id)!.events!}
                    </p>
                    <p className="text-xs">
                      Spans:{" "}
                      {selectedMonthUsage?.find((i) => i.id === id)!.spans}
                    </p>
                  </div>
                );
              }}
              legends={[]}
              layers={[
                "arcs",
                "arcLabels",
                "arcLinkLabels",
                "legends",
                CenteredMetric,
              ]}
            />
          </div>
        </div>
      )}

      {isBillingEnabled() && (
        <div className="flex flex-col items-start py-4 w-full">
          <div className="py-4" />
          <p className="font-display text-3xl max-w-6xl text-center">Billing</p>
          <div className="py-2" />

          {/* Error states */}
          {billingInfoStatus === "error" && (
            <p className="font-body text-sm">
              Error fetching billing data, please check if Team ID is valid or
              refresh page to try again
            </p>
          )}

          {/* Main UI */}
          {billingInfoStatus === "pending" && (
            <div className="flex flex-col items-start w-full">
              {/* Progress bar area */}
              <div className="w-full max-w-6xl">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-1 w-full" />
              </div>

              {/* Plan cards */}
              <div className="flex flex-col md:flex-row gap-8 w-full mt-12">
                <Card className="w-full md:w-1/2">
                  <div className="p-4 md:p-8 flex flex-col items-center gap-3">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-10 w-48" />
                    <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  </div>
                </Card>
                <Card className="w-full md:w-1/2">
                  <div className="p-4 md:p-8 flex flex-col items-center gap-3">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-10 w-48" />
                    <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <Skeleton className="h-9 w-40 mt-8" />
                  </div>
                </Card>
              </div>
            </div>
          )}
          {billingInfoStatus === "success" && (
            <div className="flex flex-col items-start w-full">
              {/* Progress indicator for Free plan */}
              {billingInfo?.plan === "free" && (
                <div className="w-full max-w-6xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-body">
                      Free plan usage:{" "}
                      <span className="font-semibold">{freeUsagePercent}%</span>
                    </p>
                    <p className="font-body text-muted-foreground">
                      {formatBytesSI(bytesUsed)} used of{" "}
                      {formatBytesSI(bytesGranted)}
                    </p>
                  </div>
                  <Progress value={freeUsagePercent} />
                </div>
              )}

              {/* Plan Cards */}
              <div className="flex flex-col md:flex-row gap-8 w-full mt-12">
                {/* Free Plan Card - only show when on free plan */}
                {billingInfo?.plan === "free" && (
                  <Card className="w-full md:w-1/2 relative">
                    {showCurrentPlanBadge()}
                    <div className="p-4 md:p-8 flex flex-col items-center">
                      <p className="text-xl font-display">FREE</p>
                      <p className="text-4xl font-display py-2">$0 per month</p>
                      <ul className="list-disc space-y-2 mt-6">
                        <li className="font-body">
                          Data: {formatDataLine(billingInfo)}
                        </li>
                        <li className="font-body">
                          {FREE_RETENTION_DAYS} days retention
                        </li>
                      </ul>
                    </div>
                  </Card>
                )}

                {/* Pro Plan Card — visible to free (upgrade pitch) and pro (current plan).
                    Enterprise users see the dedicated Enterprise card below instead. */}
                {billingInfo?.plan !== "enterprise" && (
                  <Card
                    className={`${billingInfo?.plan === "pro" ? "w-full" : "w-full md:w-1/2"} bg-green-50 dark:bg-card border border-green-300 dark:border-border relative`}
                  >
                    {billingInfo?.plan === "pro" && showCurrentPlanBadge()}
                    <div className="p-4 md:p-8 flex flex-col items-center">
                      <p className="text-xl text-green-900 dark:text-primary font-display">
                        PRO
                      </p>
                      <p className="text-4xl text-green-900 dark:text-primary font-display py-2">
                        ${MINIMUM_PRICE_AFTER_FREE_TIER} per month
                      </p>
                      {billingInfo?.plan !== "pro" && (
                        <ul className="list-disc space-y-2 mt-6">
                          <li className="font-body text-green-900 dark:text-foreground">
                            {INCLUDED_PRO_GB} GB per month included
                          </li>
                          <li className="font-body text-green-900 dark:text-foreground">
                            {PRO_RETENTION_DAYS} days retention
                          </li>
                          <li className="font-body text-green-900 dark:text-foreground">
                            Extra data charged at $
                            {PRICE_PER_GB_MONTH.toFixed(2)} per GB/month
                          </li>
                        </ul>
                      )}
                      {billingInfo?.plan === "pro" &&
                        currentUserCanChangePlan &&
                        billingInfo.status && (
                          <div className="mt-4 font-body text-start space-y-1">
                            <ul className="list-disc list-inside">
                              <li className="text-green-900 dark:text-foreground">
                                Status:{" "}
                                <span className="font-semibold capitalize">
                                  {billingInfo.status}
                                </span>
                              </li>
                              <li className="text-green-900 dark:text-foreground">
                                Current billing cycle:{" "}
                                <span className="font-semibold">
                                  {new Date(
                                    billingInfo.current_period_start * 1000,
                                  ).toLocaleDateString()}{" "}
                                  –{" "}
                                  {new Date(
                                    billingInfo.current_period_end * 1000,
                                  ).toLocaleDateString()}
                                </span>
                              </li>
                              {!cancellationScheduled && (
                                <li className="text-green-900 dark:text-foreground">
                                  Next invoice:{" "}
                                  <span className="font-semibold">
                                    {new Date(
                                      billingInfo.current_period_end * 1000,
                                    ).toLocaleDateString()}
                                  </span>
                                </li>
                              )}
                              <li className="text-green-900 dark:text-foreground">
                                Data:{" "}
                                <span className="font-semibold">
                                  {formatDataLine(billingInfo)}
                                </span>
                              </li>
                            </ul>
                          </div>
                        )}
                      <div className="pt-12">
                        {billingInfo?.plan === "free" && (
                          <Button
                            className={buttonVariants({ variant: "default" })}
                            onClick={onUpgrade}
                            disabled={!currentUserCanChangePlan || isUpgrading}
                          >
                            {isUpgrading ? "Redirecting..." : "Upgrade to Pro"}
                          </Button>
                        )}
                        {billingInfo?.plan === "pro" && (
                          <div className="flex flex-col gap-3 items-center">
                            <Button
                              className="w-56"
                              variant={"default"}
                              onClick={onManageBilling}
                              disabled={
                                !currentUserCanChangePlan ||
                                isLoadingPortal ||
                                isDowngrading ||
                                isUndoingDowngrade
                              }
                            >
                              {isLoadingPortal
                                ? "Redirecting..."
                                : "Manage Billing"}
                            </Button>
                            {cancellationScheduled ? (
                              <Button
                                className="w-56"
                                variant={"default"}
                                onClick={onUndoDowngrade}
                                disabled={
                                  !currentUserCanChangePlan ||
                                  isUndoingDowngrade ||
                                  isLoadingPortal
                                }
                              >
                                {isUndoingDowngrade
                                  ? "Undoing..."
                                  : "Undo Cancellation"}
                              </Button>
                            ) : (
                              <Button
                                className="w-56"
                                variant={"destructive"}
                                onClick={() =>
                                  setDowngradeConfirmationDialogOpen(true)
                                }
                                disabled={
                                  !currentUserCanChangePlan ||
                                  isDowngrading ||
                                  isLoadingPortal
                                }
                              >
                                {isDowngrading
                                  ? "Scheduling..."
                                  : "Downgrade to Free"}
                              </Button>
                            )}
                            {cancellationScheduled &&
                              billingInfo.current_period_end && (
                                <p className="font-body text-sm text-center text-muted-foreground pt-2">
                                  Cancellation scheduled for{" "}
                                  {new Date(
                                    billingInfo.current_period_end * 1000,
                                  ).toLocaleDateString()}
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Enterprise Plan Card — full-width, no price. Bytes can be
                    unlimited; retention and plan length come from the
                    bespoke Autumn plan. */}
                {billingInfo?.plan === "enterprise" && (
                  <Card className="w-full bg-green-50 dark:bg-card border border-green-300 dark:border-border relative">
                    {showCurrentPlanBadge()}
                    <div className="p-4 md:p-8 flex flex-col items-center">
                      <p className="text-xl text-green-900 dark:text-primary font-display">
                        ENTERPRISE
                      </p>
                      <div className="mt-4 font-body text-start space-y-1">
                        <ul className="list-disc list-inside">
                          <li className="text-green-900 dark:text-foreground">
                            Data:{" "}
                            <span className="font-semibold">
                              {formatDataLine(billingInfo)}
                            </span>
                          </li>
                          {billingInfo?.retention_days ? (
                            <li className="text-green-900 dark:text-foreground">
                              Retention:{" "}
                              <span className="font-semibold">
                                {billingInfo.retention_days} days
                              </span>
                            </li>
                          ) : null}
                          {billingInfo?.current_period_start &&
                          billingInfo?.current_period_end ? (
                            <li className="text-green-900 dark:text-foreground">
                              Plan period:{" "}
                              <span className="font-semibold">
                                {new Date(
                                  billingInfo.current_period_start * 1000,
                                ).toLocaleDateString()}{" "}
                                –{" "}
                                {new Date(
                                  billingInfo.current_period_end * 1000,
                                ).toLocaleDateString()}
                              </span>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                      <div className="pt-12">
                        <Button
                          className="w-56"
                          variant={"default"}
                          onClick={onManageBilling}
                          disabled={
                            !currentUserCanChangePlan || isLoadingPortal
                          }
                        >
                          {isLoadingPortal
                            ? "Redirecting..."
                            : "Manage Billing"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {billingInfo?.plan !== "enterprise" && (
                <p
                  className={`text-sm text-card-foreground font-body mt-8 p-4 w-full text-center`}
                >
                  Have large data volumes or need custom retention?{" "}
                  <Link
                    href="mailto:hello@measure.sh"
                    className={underlineLinkStyle}
                  >
                    Contact us
                  </Link>{" "}
                  for personalised plans.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <DangerConfirmationDialog
        body={
          <div className="font-body">
            <p>
              Are you sure you want to downgrade to the{" "}
              <span className="font-display font-bold">Free</span> plan?
            </p>
            <ul className="list-disc list-inside pt-2 text-sm">
              <li>
                Pro stays active until the end of the current billing cycle
              </li>
              <li>At cycle end, you&apos;ll be moved to the Free plan</li>
              <li>App retention will be reset to {FREE_RETENTION_DAYS} days</li>
              <li>Data will be limited to {FREE_GB} GB per month</li>
              <li>You can undo this anytime before the cycle ends</li>
            </ul>
          </div>
        }
        open={downgradeConfirmationDialogOpen}
        affirmativeText="Yes, schedule cancellation"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setDowngradeConfirmationDialogOpen(false);
          onDowngrade();
        }}
        onCancelAction={() => setDowngradeConfirmationDialogOpen(false)}
      />
    </div>
  );
}

function showCurrentPlanBadge() {
  return (
    <div className="absolute top-4 right-4 bg-green-700 dark:bg-accent text-white dark:text-accent-foreground text-xs font-display px-2 py-1 rounded">
      Current Plan
    </div>
  );
}
