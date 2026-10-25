"use client";

import JourneysOverview from "@/app/components/journey/overview";
import { use } from "react";

export default function JourneysPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  return <JourneysOverview teamId={teamId} />;
}
