"use client"

import BugReport from "@/app/components/bug_report"

interface PageProps {
  params: { teamId: string, appId: string, bugReportId: string }
}

export default function BugReportPage({ params }: PageProps) {
  return <BugReport params={params} />
}