"use client";

import { ErrorsOverview } from "@/app/components/errors_overview";
import { use } from "react";

export default function ErrorsOverviewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  return <ErrorsOverview teamId={teamId} />;
}
