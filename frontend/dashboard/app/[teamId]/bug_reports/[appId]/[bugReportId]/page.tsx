"use client";

import BugReport from "@/app/components/bug_report";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string; appId: string; bugReportId: string }>;
}

export default function BugReportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <BugReport params={resolvedParams} />;
}
