"use client";

import { UpdateBugReportStatusApiStatus } from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import { buttonVariants } from "@/app/components/button_variants";
import { Skeleton } from "@/app/components/skeleton";
import {
  useBugReportQuery,
  useToggleBugReportStatusMutation,
} from "@/app/query/hooks";
import { cn } from "@/app/utils/shadcn_utils";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { toastNegative, toastPositive } from "@/app/utils/use_toast";
import { DateTime } from "luxon";
import Image from "next/image";
import Link from "next/link";
import { FormEventHandler, useState } from "react";
import Pill from "./pill";

const demoBugReport = {
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  event_id: "f917ce21-9b8e-479d-9daa-888e32c66739",
  status: 0,
  description:
    "When I tap the 'Pay' button on the Checkout, the app crashes immediately. This seems to happen when I go to other app from checkout screen and then come back to finish paying. Reproducible on Pixel 7 Pro. Steps: Open app → go to Checkout → go to another app -> come back to checkout screen -> tap 'Pay'.",
  timestamp: DateTime.now().minus({ minutes: 2 }).toUTC().toISO(),
  updated_at: DateTime.now().minus({ minutes: 2 }).toUTC().toISO(),
  attribute: {
    installation_id: "00000000-0000-0000-0000-000000000000",
    app_version: "2.0.0",
    app_build: "200",
    app_unique_id: "",
    measure_sdk_version: "",
    platform: "",
    thread_name: "",
    user_id: "demo-user-id",
    device_name: "sunfish",
    device_model: "Pixel 7 Pro",
    device_manufacturer: "Google",
    device_type: "",
    device_is_foldable: false,
    device_is_physical: false,
    device_density_dpi: 0,
    device_width_px: 0,
    device_height_px: 0,
    device_density: 0,
    device_locale: "en-US",
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    device_cpu_arch: "",
    os_name: "android",
    os_version: "33",
    os_page_size: 0,
    network_type: "Wifi",
    network_provider: "unknown",
    network_generation: "unknown",
  },
  attachments: [
    {
      id: "f34247a5-f0c1-4808-aa1d-c957e6214743",
      name: "snapshot.svg",
      type: "screenshot",
      key: "f34247a5-f0c1-4808-aa1d-c957e6214743.svg",
      location: "/images/demo_checkout_screenshot.png",
    },
  ],
} as any;

interface BugReportProps {
  params?: { teamId: string; appId: string; bugReportId: string };
  demo?: boolean;
  hideDemoTitle?: boolean;
}

export default function BugReport({
  params = {
    teamId: "demo-team-id",
    appId: "demo-app-id",
    bugReportId: "demo-bug-report-id",
  },
  demo = false,
  hideDemoTitle = false,
}: BugReportProps) {
  const bugReportQuery = useBugReportQuery(
    demo ? "" : params.appId,
    demo ? "" : params.bugReportId,
  );
  const toggleStatusMutation = useToggleBugReportStatusMutation();

  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [demoStatusToggled, setDemoStatusToggled] = useState(false);
  const [demoUpdateStatus, setDemoUpdateStatus] = useState(
    UpdateBugReportStatusApiStatus.Init,
  );

  const displayBugReport = demo
    ? {
        ...demoBugReport,
        status: demoStatusToggled
          ? demoBugReport.status === 0
            ? 1
            : 0
          : demoBugReport.status,
      }
    : bugReportQuery.data;
  const displayBugReportApiStatus = demo
    ? "success"
    : bugReportQuery.isSuccess
      ? "success"
      : bugReportQuery.isError
        ? "error"
        : "loading";
  const displayUpdateStatus = demo
    ? demoUpdateStatus
    : toggleStatusMutation.isPending
      ? UpdateBugReportStatusApiStatus.Loading
      : UpdateBugReportStatusApiStatus.Init;

  const handleImageError = (key: string) => {
    setImageErrors((prev) => new Set(prev).add(key));
  };

  const handleToggleStatus: FormEventHandler = async (event) => {
    event.preventDefault();
    if (demo) {
      setDemoUpdateStatus(UpdateBugReportStatusApiStatus.Loading);
      setTimeout(() => {
        setDemoStatusToggled((prev) => !prev);
        setDemoUpdateStatus(UpdateBugReportStatusApiStatus.Success);
      }, 100);
      return;
    }

    const previousStatus = bugReportQuery.data?.status ?? 0;
    const newStatus = previousStatus === 0 ? 1 : 0;
    try {
      await toggleStatusMutation.mutateAsync({
        appId: params.appId,
        bugReportId: params.bugReportId,
        newStatus,
      });
      toastPositive(
        previousStatus === 0 ? "Bug report closed" : "Bug report re-opened",
      );
    } catch {
      toastNegative("Error updating bug report status. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl">
        {demo ? (hideDemoTitle ? "" : "Bug Reports") : ""}
      </p>
      <div className="py-2" />

      {displayBugReportApiStatus === "loading" && (
        <div className="flex flex-col w-full py-4">
          {/* Pills */}
          <div className="flex flex-wrap gap-2 py-2 pb-12">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          {/* Description */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-2" />
          <Skeleton className="h-4 w-1/2 mt-2" />
          {/* Buttons */}
          <div className="py-8" />
          <div className="flex flex-row gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-40" />
          </div>
          {/* Attachments */}
          <div className="py-4" />
          <div className="flex flex-wrap gap-8">
            <Skeleton className="h-[200px] w-[200px]" />
            <Skeleton className="h-[200px] w-[200px]" />
          </div>
        </div>
      )}

      {displayBugReportApiStatus === "error" && (
        <p className="font-body text-sm">
          Error fetching bug report, please refresh page to try again
        </p>
      )}

      {displayBugReportApiStatus === "success" && displayBugReport && (
        <div>
          <div className="flex flex-wrap gap-2 py-2 pb-12 items-center">
            <p
              className={`w-fit px-2 py-1 rounded-full border text-xs font-body ${displayBugReport.status === 0 ? "border-green-600 dark:border-green-500 text-green-600 dark:text-green-500 bg-green-50 dark:bg-background" : "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-background"}`}
            >
              {displayBugReport.status === 0 ? "Open" : "Closed"}
            </p>
            <Pill
              title={`User ID: ${displayBugReport.attribute.user_id !== "" ? displayBugReport.attribute.user_id : "N/A"}`}
            />
            <Pill
              title={`Time: ${formatDateToHumanReadableDateTime(displayBugReport.timestamp)}`}
            />
            <Pill
              title={`Device: ${displayBugReport.attribute.device_manufacturer + displayBugReport.attribute.device_model}`}
            />
            <Pill
              title={`App version: ${displayBugReport.attribute.app_version} (${displayBugReport.attribute.app_build})`}
            />
            <Pill
              title={`Network type: ${displayBugReport.attribute.network_type}`}
            />
            {displayBugReport.user_defined_attribute !== undefined &&
              displayBugReport.user_defined_attribute !== null && (
                <>
                  {Object.entries(displayBugReport.user_defined_attribute).map(
                    ([attrKey, attrValue]) => (
                      <Pill
                        key={`${attrKey}-${attrValue?.toString()}}`}
                        title={`${attrKey}: ${attrValue?.toString()}`}
                      />
                    ),
                  )}
                </>
              )}
          </div>
          {displayBugReport.description && (
            <p className="font-body text-lg">{displayBugReport.description}</p>
          )}
          <div className="py-8" />
          <div className="flex flex-row">
            {demo ? (
              <div className={cn(buttonVariants({ variant: "outline" }))}>
                View Session Timeline
              </div>
            ) : (
              <Link
                href={`/${params.teamId}/session_timelines/${params.appId}/${displayBugReport.session_id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View Session Timeline
              </Link>
            )}
            <div className="px-2" />
            <Button
              variant="outline"
              className="w-fit"
              disabled={
                displayUpdateStatus === UpdateBugReportStatusApiStatus.Loading
              }
              onClick={handleToggleStatus}
            >
              {displayBugReport.status === 0
                ? "Close Bug Report"
                : "Re-Open Bug Report"}
            </Button>
          </div>

          <div className="py-4" />
          {displayBugReport.attachments !== undefined &&
            displayBugReport.attachments !== null &&
            displayBugReport.attachments.length > 0 && (
              <div className="flex flex-wrap gap-8 items-center">
                {displayBugReport.attachments.map(
                  (
                    attachment: (typeof displayBugReport.attachments)[number],
                    index: number,
                  ) =>
                    !imageErrors.has(attachment.key) && (
                      <div key={attachment.key} className="relative">
                        <Image
                          className="border border-black"
                          src={attachment.location}
                          width={200}
                          height={200}
                          unoptimized={true}
                          alt={`Screenshot ${index}`}
                          onError={() => handleImageError(attachment.key)}
                        />
                      </div>
                    ),
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
