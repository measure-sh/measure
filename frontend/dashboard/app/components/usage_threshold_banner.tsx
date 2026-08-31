"use client";

import { useBillingInfoQuery } from "@/app/query/hooks";
import { isBillingEnabled } from "@/app/utils/feature_flag_utils";
import Link from "next/link";

type UsageThresholdBannerProps = {
  teamId: string;
};

// Banner fires above 75% for the free plan and for enterprise plans with a
// finite limit — Pro self-manages overages.
function thresholdFor(
  billingInfo:
    | {
        plan?: string;
        bytes_granted?: number;
        bytes_used?: number;
        bytes_unlimited?: boolean;
      }
    | undefined,
): number {
  if (!billingInfo) {
    return 0;
  }
  if (billingInfo.plan !== "free" && billingInfo.plan !== "enterprise") {
    return 0;
  }
  if (billingInfo.bytes_unlimited) {
    return 0;
  }
  const granted = billingInfo.bytes_granted ?? 0;
  const used = billingInfo.bytes_used ?? 0;
  if (granted <= 0) {
    return 0;
  }
  const pct = (used / granted) * 100;
  if (pct >= 100) return 100;
  if (pct >= 90) return 90;
  if (pct >= 75) return 75;
  return 0;
}

export default function UsageThresholdBanner({
  teamId,
}: UsageThresholdBannerProps) {
  const { data: billingInfo } = useBillingInfoQuery(
    isBillingEnabled() ? teamId : undefined,
  );
  const threshold = thresholdFor(billingInfo);

  if (threshold === 0) {
    return null;
  }

  const isEnterprise = billingInfo?.plan === "enterprise";
  const planLabel = isEnterprise ? "plan data limit" : "free plan";
  const linkHref = isEnterprise
    ? "mailto:hello@measure.sh"
    : `/${teamId}/usage`;
  const linkText = isEnterprise ? "Contact Us →" : "Upgrade to Pro →";

  let message: string;
  let bannerClass: string;

  if (threshold >= 100) {
    message = `100% of ${planLabel} used — event ingestion blocked.`;
    bannerClass = "bg-red-300 text-primary-foreground";
  } else if (threshold >= 90) {
    message = `90% of ${planLabel} used.`;
    bannerClass = "bg-orange-300 text-primary-foreground";
  } else {
    message = `75% of ${planLabel} used.`;
    bannerClass = "bg-yellow-300 text-primary-foreground";
  }

  return (
    <div
      className={`w-full px-4 py-2 font-body text-sm flex items-center justify-between mb-8 ${bannerClass}`}
    >
      <span>{message}</span>
      <Link
        href={linkHref}
        className="font-semibold underline ml-4 whitespace-nowrap"
      >
        {linkText}
      </Link>
    </div>
  );
}
