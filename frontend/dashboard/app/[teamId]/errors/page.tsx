"use client";

import { ErrorsOverview } from "@/app/components/errors_overview";

export default function ErrorsOverviewPage({
  params,
}: {
  params: { teamId: string };
}) {
  return <ErrorsOverview teamId={params.teamId} />;
}
