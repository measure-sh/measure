"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/breadcrumb"
import { isCloud } from "@/app/utils/env_utils"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  session_timelines: "Session Timelines",
  journeys: "Journeys",
  crashes: "Crashes",
  anrs: "ANRs",
  bug_reports: "Bug Reports",
  alerts: "Alerts",
  traces: "Traces",
  network: "Network",
  apps: "Apps",
  team: "Team",
  notif_prefs: "Notifications",
  usage: "Usage",
}

function resolveSectionTitle(slug: string): string {
  if (slug === "usage" && isCloud()) {
    return "Usage & Billing"
  }
  return sectionTitles[slug] ?? slug
}

const subrouteTitles: Record<string, string> = {
  details: "Details",
}

export default function AppBreadcrumbs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const parts = pathname.split("/").filter(Boolean)
  const teamId = parts[0]
  const sectionSlug = parts[1]
  const rest = parts.slice(2)

  if (!teamId || !sectionSlug) {
    return null
  }

  const sectionTitle = resolveSectionTitle(sectionSlug)
  const sectionHref = `/${teamId}/${sectionSlug}`
  const isSectionPage = rest.length === 0

  const lastSegment = rest[rest.length - 1]
  const lastLabel = (() => {
    if (sectionSlug === "network" && lastSegment === "details") {
      const domain = searchParams.get("domain") ?? ""
      const path = searchParams.get("path") ?? ""
      if (domain || path) {
        return domain + path
      }
      return "Details"
    }
    if (!lastSegment) {
      return ""
    }
    return subrouteTitles[lastSegment] ?? decodeURIComponent(lastSegment)
  })()

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {isSectionPage ? (
          <BreadcrumbItem>
            <BreadcrumbPage className="font-display">{sectionTitle}</BreadcrumbPage>
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
              <BreadcrumbPage className="font-display">{lastLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
