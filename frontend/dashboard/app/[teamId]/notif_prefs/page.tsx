"use client";

import { emptyNotifPrefs } from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import { Checkbox } from "@/app/components/checkbox";
import { Skeleton } from "@/app/components/skeleton";
import {
  useNotifPrefsQuery,
  useSaveNotifPrefsMutation,
} from "@/app/query/hooks";
import { toastNegative, toastPositive } from "@/app/components/toast";
import { isSandboxTeamId } from "@/app/utils/sandbox";
import { use, useState } from "react";

type NotifPrefs = typeof emptyNotifPrefs;

interface NotifRowProps {
  rowTitle: string;
  checked: boolean;
  disabled: boolean;
  handleChange: () => void;
}

function NotifRow({
  rowTitle,
  checked,
  disabled,
  handleChange,
}: NotifRowProps) {
  return (
    <div className="table-row-group">
      <div className="table-cell py-2">{rowTitle}</div>
      <div className="table-cell px-12 py-2">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={handleChange}
        />
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function Notifications({ params }: PageProps) {
  const { teamId } = use(params);
  const readOnly = isSandboxTeamId(teamId);
  const notifPrefsQuery = useNotifPrefsQuery();
  const saveNotifPrefsMutation = useSaveNotifPrefsMutation();

  const notifPrefs = notifPrefsQuery.data ?? emptyNotifPrefs;
  const [updatedNotifPrefs, setUpdatedNotifPrefs] =
    useState<NotifPrefs>(emptyNotifPrefs);

  // Seed the editable copy when prefs load (and re-seed if they refetch).
  const [prevLoadedPrefs, setPrevLoadedPrefs] = useState(notifPrefsQuery.data);
  if (notifPrefsQuery.data && notifPrefsQuery.data !== prevLoadedPrefs) {
    setPrevLoadedPrefs(notifPrefsQuery.data);
    setUpdatedNotifPrefs(notifPrefsQuery.data);
  }

  const togglePref = (key: keyof NotifPrefs) => {
    setUpdatedNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const areNotifPrefsSame =
    notifPrefs.error_spike === updatedNotifPrefs.error_spike &&
    notifPrefs.app_hang_spike === updatedNotifPrefs.app_hang_spike &&
    notifPrefs.bug_report === updatedNotifPrefs.bug_report &&
    notifPrefs.daily_summary === updatedNotifPrefs.daily_summary;

  const handleSave = async () => {
    try {
      await saveNotifPrefsMutation.mutateAsync({
        notifPrefs: updatedNotifPrefs,
      });
      toastPositive("Notification preferences saved");
    } catch (error) {
      toastNegative(
        "Error saving notification preferences",
        error instanceof Error ? error.message : undefined,
      );
    }
  };

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      {notifPrefsQuery.isLoading && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      )}
      {notifPrefsQuery.isError && (
        <p className="font-body text-sm">
          Failed to fetch notification preferences. Please refresh page to try
          again.
        </p>
      )}

      {notifPrefsQuery.isSuccess && (
        <div>
          <p className="font-body text-sm text-muted-foreground">
            Choose which email notifications you want to receive. This setting
            applies only to your personal preferences and does not affect your
            team.
          </p>
          <div className="py-4" />
          <div className="table font-body">
            <div className="table-header-group">
              <div className="table-row">
                <div className="table-cell py-2 font-display">Alert type</div>
                <div className="table-cell px-8 py-2 font-display text-center">
                  Email
                </div>
              </div>
            </div>
            <NotifRow
              rowTitle="Crash Spike email"
              checked={updatedNotifPrefs.error_spike}
              disabled={readOnly}
              handleChange={() => togglePref("error_spike")}
            />
            <NotifRow
              rowTitle="ANR spike email"
              checked={updatedNotifPrefs.app_hang_spike}
              disabled={readOnly}
              handleChange={() => togglePref("app_hang_spike")}
            />
            <NotifRow
              rowTitle="Bug Reports"
              checked={updatedNotifPrefs.bug_report}
              disabled={readOnly}
              handleChange={() => togglePref("bug_report")}
            />
            <NotifRow
              rowTitle="Daily Summary"
              checked={updatedNotifPrefs.daily_summary}
              disabled={readOnly}
              handleChange={() => togglePref("daily_summary")}
            />
          </div>
          <div className="py-4" />
          <Button
            variant="outline"
            disabled={
              readOnly || areNotifPrefsSame || saveNotifPrefsMutation.isPending
            }
            className="flex justify-center font-display border border-black select-none"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
