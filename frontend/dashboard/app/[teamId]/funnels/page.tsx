"use client";

import FunnelsOverview from "@/app/components/funnel/overview";
import { use } from "react";

export default function FunnelsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  return <FunnelsOverview teamId={teamId} />;
}
