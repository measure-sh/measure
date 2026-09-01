"use client";

import { useBillingInfoQuery } from "@/app/query/hooks";
import { isBillingEnabled } from "@/app/utils/feature_flag_utils";
import Link from "next/link";

type UsageThresholdBannerProps = {
  teamId: string;
};

type BannerState = { message: string; className: string } | null;

// Banner fires above 75% for the free plan and for enterprise plans with a
// finite limit — Pro self-manages overages. Returns null when there is nothing
// to say.
function bannerState(
  billingInfo:
    | {
        plan?: string;
        bytes_granted?: number;
        bytes_used?: number;
        bytes_unlimited?: boolean;
        data_purchase_spent?: boolean;
        ingestion_blocked?: boolean;
      }
    | undefined,
): BannerState {
  if (!billingInfo) {
    return null;
  }
  if (billingInfo.plan !== "free" && billingInfo.plan !== "enterprise") {
    return null;
  }
  if (billingInfo.bytes_unlimited) {
    return null;
  }
  const granted = billingInfo.bytes_granted ?? 0;
  if (granted <= 0) {
    return null;
  }

  const planLabel =
    billingInfo.plan === "enterprise" ? "plan data limit" : "free plan";

  if (billingInfo.ingestion_blocked) {
    return {
      message:
        billingInfo.plan === "enterprise"
          ? "100% of plan data limit used — ingestion paused until the monthly free allowance resets."
          : "100% of free plan used — ingestion paused until your allowance resets next month.",
      className: "bg-red-300 text-primary-foreground",
    };
  }
  if (billingInfo.data_purchase_spent) {
    return {
      message: "Your usage is limited to free plan limits.",
      className: "bg-orange-300 text-primary-foreground",
    };
  }

  const pct = ((billingInfo.bytes_used ?? 0) / granted) * 100;
  if (pct >= 100) {
    return {
      message: `100% of ${planLabel} used.`,
      className: "bg-red-300 text-primary-foreground",
    };
  }
  if (pct >= 90) {
    return {
      message: `90% of ${planLabel} used.`,
      className: "bg-orange-300 text-primary-foreground",
    };
  }
  if (pct >= 75) {
    return {
      message: `75% of ${planLabel} used.`,
      className: "bg-yellow-300 text-primary-foreground",
    };
  }
  return null;
}

export default function UsageThresholdBanner({
  teamId,
}: UsageThresholdBannerProps) {
  const { data: billingInfo } = useBillingInfoQuery(
    isBillingEnabled() ? teamId : undefined,
  );
  const banner = bannerState(billingInfo);

  if (!banner) {
    return null;
  }

  const isEnterprise = billingInfo?.plan === "enterprise";
  const linkHref = isEnterprise
    ? "mailto:hello@measure.sh"
    : `/${teamId}/usage`;
  const linkText = isEnterprise ? "Contact Us →" : "Upgrade to Pro →";

  return (
    <div
      className={`w-full px-4 py-2 font-body text-sm flex items-center justify-between mb-8 ${banner.className}`}
    >
      <span>{banner.message}</span>
      <Link
        href={linkHref}
        className="font-semibold underline ml-4 whitespace-nowrap"
      >
        {linkText}
      </Link>
    </div>
  );
}
