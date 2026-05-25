"use client";

import Overview from "@/app/components/overview";
import { track } from "@/app/utils/analytics/track";
import { useEffect } from "react";

interface PageProps {
  params: { teamId: string };
}

export default function OverviewPage({ params }: PageProps) {
  useEffect(() => {
    track("dashboard_opened", {
      team_id: params.teamId,
      feature_area: "overview",
      entry_point: "direct",
    });
  }, [params.teamId]);

  return <Overview params={params} />;
}
