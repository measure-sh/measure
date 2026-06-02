"use client";

import { ErrorsDetails } from "@/app/components/errors_details";
import { use } from "react";

export default function ErrorGroupDetails({
  params,
}: {
  params: Promise<{
    teamId: string;
    appId: string;
    errorGroupId: string;
    errorGroupName: string;
  }>;
}) {
  const { teamId, appId, errorGroupId, errorGroupName } = use(params);
  return (
    <ErrorsDetails
      teamId={teamId}
      appId={appId}
      errorGroupId={errorGroupId}
      errorGroupName={errorGroupName}
    />
  );
}
