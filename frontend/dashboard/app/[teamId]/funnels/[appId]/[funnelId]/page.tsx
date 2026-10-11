"use client";

import FunnelDetails from "@/app/components/funnel/details";
import { use } from "react";

export default function FunnelDetailsPage({
  params,
}: {
  params: Promise<{
    teamId: string;
    appId: string;
    funnelId: string;
  }>;
}) {
  const { teamId, appId, funnelId } = use(params);
  return <FunnelDetails teamId={teamId} appId={appId} funnelId={funnelId} />;
}
