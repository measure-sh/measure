"use client";

import TraceDetails from "@/app/components/trace/details";

interface PageProps {
  params: { teamId: string; appId: string; traceId: string };
}

export default function TraceDetailsPage({ params }: PageProps) {
  return <TraceDetails params={params} />;
}
