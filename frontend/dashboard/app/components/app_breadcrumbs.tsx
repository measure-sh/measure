"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/breadcrumb";
import InfoTooltip from "@/app/components/info_tooltip";
import { isCloud } from "@/app/utils/env_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  session_replays: "Session Replays",
  journeys: "Journeys",
  errors: "Errors",
  bug_reports: "Bug Reports",
  alerts: "Alerts",
  traces: "Traces",
  network: "Network",
  apps: "Apps",
  builds: "Builds",
  team: "Team",
  notif_prefs: "Notifications",
  usage: "Usage",
};

function resolveSectionTitle(slug: string): string {
  if (slug === "usage" && isCloud()) {
    return "Usage & Billing";
  }
  return sectionTitles[slug] ?? slug;
}

const subrouteTitles: Record<string, string> = {
  details: "Endpoint details",
};

// Helper text shown as an info tooltip beside section titles in the breadcrumb.
const sectionInfo: Record<string, ReactNode> = {
  session_replays: (
    <>
      Replays are captured for Crashes, ANRs, Bug Reports & sampled sessions.{" "}
      <Link href="/docs/session-replay" className={underlineLinkStyle}>
        Learn more
      </Link>
    </>
  ),
  journeys: (
    <>
      Journeys are approximated based on sampled journey events.{" "}
      <Link
        href="/docs/adaptive-capture#journey-sampling"
        className={underlineLinkStyle}
      >
        Learn more
      </Link>
    </>
  ),
};

export default function AppBreadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parts = pathname.split("/").filter(Boolean);
  const teamId = parts[0];
  const sectionSlug = parts[1];
  const rest = parts.slice(2);

  if (!teamId || !sectionSlug) {
    return null;
  }

  const sectionTitle = resolveSectionTitle(sectionSlug);
  const sectionHref = `/${teamId}/${sectionSlug}`;
  const isSectionPage = rest.length === 0;

  const lastSegment = rest[rest.length - 1];
  const lastLabel = (() => {
    if (!lastSegment) {
      return "";
    }
    if (sectionSlug === "network" && lastSegment === "details") {
      const domain = searchParams.get("domain");
      const path = searchParams.get("path");
      if (domain || path) {
        return `${domain ?? ""}${path ?? ""}`;
      }
    }
    return subrouteTitles[lastSegment] ?? decodeURIComponent(lastSegment);
  })();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {isSectionPage ? (
          <BreadcrumbItem>
            <BreadcrumbPage className="font-display">
              {sectionTitle}
            </BreadcrumbPage>
            {sectionInfo[sectionSlug] && (
              <InfoTooltip
                className="h-3.5 w-3.5 text-foreground"
                content={sectionInfo[sectionSlug]}
              />
            )}
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="font-display">
                <Link href={sectionHref}>{sectionTitle}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-display">
                {lastLabel}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
