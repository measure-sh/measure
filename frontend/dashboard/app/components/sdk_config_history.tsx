"use client";

import { SdkConfig, SdkConfigChange } from "@/app/api/api_calls";
import { Skeleton } from "@/app/components/skeleton";
import EmptyState from "@/app/components/empty_state";
import Paginator from "@/app/components/paginator";
import {
  SDK_CONFIG_HISTORY_LIMIT,
  useSdkConfigHistoryQuery,
} from "@/app/query/hooks";
import { sdkConfigFieldLabels } from "@/app/utils/sdk_config_labels";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { History } from "lucide-react";
import { useState } from "react";

type FieldChange = { old: any; new: any };

function formatValue(field: keyof SdkConfig, value: any): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "none";
  }
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }
  const { unit, valueLabels } = sdkConfigFieldLabels[field];
  if (valueLabels) {
    return valueLabels[String(value)] ?? String(value);
  }
  return `${value}${unit ?? ""}`;
}

const muted = "text-muted-foreground";

function ValueChange({
  field,
  change,
}: {
  field: keyof SdkConfig;
  change: FieldChange;
}) {
  return (
    <>
      <span className={muted}>changed from </span>
      <span className="font-display">{formatValue(field, change.old)}</span>
      <span className={muted}> to </span>
      <span className="font-display">{formatValue(field, change.new)}</span>
    </>
  );
}

function ChangeEntry({ change }: { change: SdkConfigChange }) {
  // The keys of change.changes are not in the order the configurator shows
  // the settings, so the fields are listed in sdkConfigFieldLabels order.
  const fields = (
    Object.keys(sdkConfigFieldLabels) as (keyof SdkConfig)[]
  ).filter((field) => field in change.changes);

  return (
    <div className="py-5 first:pt-0 border-b">
      <p className="font-display text-base">
        {change.changed_by_email ?? "Unknown user"}
      </p>
      <p className="font-body text-xs text-muted-foreground mt-0.5">
        {formatDateToHumanReadableDateTime(change.changed_at)}
      </p>
      <ul className="mt-3 space-y-1.5 font-body text-sm wrap-anywhere">
        {fields.map((field) => (
          <li key={field}>
            {sdkConfigFieldLabels[field].label}{" "}
            <ValueChange field={field} change={change.changes[field]!} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SdkConfigHistory({ appId }: { appId: string }) {
  const [paginationOffset, setPaginationOffset] = useState(0);
  const query = useSdkConfigHistoryQuery(appId, paginationOffset);

  if (query.status === "pending") {
    return (
      <div className="flex flex-col gap-3 w-full">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <p className="font-body text-sm">
        Error fetching data collection history, please try again
      </p>
    );
  }

  const { results, meta } = query.data;

  if (results.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No changes yet"
        description="Changes to data collection settings will show up here"
        className="h-64"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {(meta.next || meta.previous) && (
        <div className="self-end mb-6">
          <Paginator
            prevEnabled={!query.isFetching && meta.previous}
            nextEnabled={!query.isFetching && meta.next}
            displayText=""
            onNext={() =>
              setPaginationOffset((offset) => offset + SDK_CONFIG_HISTORY_LIMIT)
            }
            onPrev={() =>
              setPaginationOffset((offset) =>
                Math.max(0, offset - SDK_CONFIG_HISTORY_LIMIT),
              )
            }
          />
        </div>
      )}
      <div>
        {results.map((change: SdkConfigChange) => (
          <ChangeEntry key={change.id} change={change} />
        ))}
      </div>
    </div>
  );
}
