"use client";

import NetworkDetails from "@/app/components/network_details";
import { track } from "@/app/utils/analytics/track";
import { useEffect } from "react";

export default function ExploreUrl({ params }: { params: { teamId: string } }) {
  useEffect(() => {
    track("network_call_inspected", {
      team_id: params.teamId,
      feature_area: "network",
      entry_point: "direct",
    });
  }, [params.teamId]);

  return <NetworkDetails params={params} />;
}
