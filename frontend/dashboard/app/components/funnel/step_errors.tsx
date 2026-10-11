"use client";

import { AlertTriangle } from "lucide-react";
import type { FunnelStepErrorsResponse } from "../../api/api_calls";
import { errorGroupPath, errorGroupTitle } from "../../utils/error_utils";
import {
  CountCell,
  OutcomeCells,
  StepList,
  type StepOutcomes,
  type StepListQuery,
  StepRow,
  useDateRangeParams,
} from "./step_list";
import Pill, { PillType } from "../pill";
import { TableHead } from "../table";

type StepError = FunnelStepErrorsResponse["results"][number];

function ErrorPills({ error }: { error: StepError }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-3">
      {error.error_type === "anr" && <Pill type={PillType.Anr} />}
      {error.error_type === "app_hang" && <Pill type={PillType.AppHang} />}
      {error.error_type === "exception" && (
        <Pill
          type={error.severity === "fatal" ? PillType.Crash : PillType.Error}
        />
      )}
      {error.severity === "fatal" && <Pill type={PillType.Fatal} />}
      {error.severity === "unhandled" && <Pill type={PillType.Unhandled} />}
      {error.severity === "handled" && <Pill type={PillType.Handled} />}
    </div>
  );
}

export default function FunnelStepErrors({
  teamId,
  appId,
  query,
  offset,
  outcomes,
  demo = false,
  onOpenItem,
}: {
  teamId: string;
  appId: string;
  query: StepListQuery<FunnelStepErrorsResponse>;
  offset: number;
  outcomes: StepOutcomes;
  demo?: boolean;
  onOpenItem?: () => void;
}) {
  const dateRangeParams = useDateRangeParams();

  const hrefOf = (error: StepError) => {
    if (demo) {
      return undefined;
    }
    const params = new URLSearchParams(dateRangeParams);
    params.set("from", "funnel");
    return `${errorGroupPath(teamId, appId, error)}?${params}`;
  };

  return (
    <StepList
      query={query}
      offset={offset}
      noun="errors"
      icon={AlertTriangle}
      columns={5}
      header={
        <>
          <TableHead className="w-[50%]">Error</TableHead>
          <TableHead className="w-[11%] text-center">Instances</TableHead>
          <TableHead className="w-[11%] text-center">Users</TableHead>
          <TableHead className="w-[14%] text-center">Conversions</TableHead>
          <TableHead className="w-[14%] text-center">Drop-offs</TableHead>
        </>
      }
    >
      {(error) => {
        const href = hrefOf(error);
        const title = errorGroupTitle(error.file_name, error.method_name);
        return (
          <StepRow
            // One fingerprint can be listed both as a crash and as a handled
            // error.
            key={`${error.error_type}:${error.severity}:${error.id}`}
            href={href}
            onOpen={onOpenItem}
            label={title}
            titleClassName="w-[50%]"
            title={
              <>
                <p className="truncate">{title}</p>
                <p className="text-xs truncate text-muted-foreground mt-0.5">
                  {[error.type, error.message]
                    .filter((part) => part !== "")
                    .join(":")}
                </p>
                <ErrorPills error={error} />
              </>
            }
          >
            <CountCell href={href} className="w-[11%]" count={error.count} />
            <CountCell href={href} className="w-[11%]" count={error.users} />
            <OutcomeCells
              href={href}
              className="w-[14%]"
              item={error}
              outcomes={outcomes}
            />
          </StepRow>
        );
      }}
    </StepList>
  );
}
