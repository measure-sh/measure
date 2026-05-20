"use client";

import { ErrorsDetails } from "@/app/components/errors_details";

export default function ErrorGroupDetails({
  params,
}: {
  params: {
    teamId: string;
    appId: string;
    errorGroupId: string;
    errorGroupName: string;
  };
}) {
  return (
    <ErrorsDetails
      teamId={params.teamId}
      appId={params.appId}
      errorGroupId={params.errorGroupId}
      errorGroupName={params.errorGroupName}
    />
  );
}
