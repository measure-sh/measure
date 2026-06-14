"use client";

import Overview from "@/app/components/overview";
import { track } from "@/app/utils/analytics/track";
import { use, useEffect } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function OverviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  useEffect(() => {
    track("dashboard_opened", {
      team_id: resolvedParams.teamId,
      feature_area: "overview",
      entry_point: "direct",
    });
  }, [resolvedParams.teamId]);

  return <Overview params={resolvedParams} />;
}
