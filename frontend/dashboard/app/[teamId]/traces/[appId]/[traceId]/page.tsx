"use client";

import TraceDetails from "@/app/components/trace/details";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string; appId: string; traceId: string }>;
}

export default function TraceDetailsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <TraceDetails params={resolvedParams} />;
}
