"use client";

import NetworkDetails from "@/app/components/network_details";
import { track } from "@/app/utils/analytics/track";
import { use, useEffect } from "react";

export default function ExploreUrl({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const resolvedParams = use(params);
  useEffect(() => {
    track("network_call_inspected", {
      team_id: resolvedParams.teamId,
      feature_area: "network",
      entry_point: "direct",
    });
  }, [resolvedParams.teamId]);

  return <NetworkDetails params={resolvedParams} />;
}
