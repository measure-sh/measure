"use client";

import { Camera, ChevronDown } from "lucide-react";
import { formatToCamelCase } from "../utils/string_utils";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import Pill from "./pill";
import SessionTimelineEventDetails from "./session_timeline_event_details";

type SessionTimelineEventCellProps = {
  teamId: string;
  appId: string;
  demo: boolean;
  eventType: string;
  eventDetails: any;
  threadName: string;
  timestamp: string;
  expanded: boolean;
  onToggle: () => void;
};

export default function SessionTimelineEventCell({
  teamId,
  appId,
  demo,
  eventType,
  eventDetails,
  threadName,
  timestamp,
  expanded,
  onToggle,
}: SessionTimelineEventCellProps) {
  function getPillColorClasses(): string {
    if (
      (eventType === "exception" || eventType === "anr") &&
      eventDetails.user_triggered === true
    ) {
      return "border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-900 dark:text-orange-400 dark:bg-orange-950/40";
    }
    if (
      eventType === "exception" ||
      eventType === "anr" ||
      eventType === "bug_report"
    ) {
      return "border-red-300 text-red-700 bg-red-50 dark:border-red-900 dark:text-red-400 dark:bg-red-950/40";
    }
    if (eventType.includes("gesture")) {
      return "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:bg-emerald-950/40";
    }
    if (eventType === "navigation" || eventType === "screen_view") {
      return "border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50 dark:border-fuchsia-900 dark:text-fuchsia-400 dark:bg-fuchsia-950/40";
    }
    if (eventType === "http") {
      return "border-cyan-300 text-cyan-700 bg-cyan-50 dark:border-cyan-900 dark:text-cyan-400 dark:bg-cyan-950/40";
    }
    if (eventType === "trace") {
      return "border-pink-300 text-pink-700 bg-pink-50 dark:border-pink-900 dark:text-pink-400 dark:bg-pink-950/40";
    }
    if (eventType === "custom") {
      return "border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-900 dark:text-purple-400 dark:bg-purple-950/40";
    }
    return "border-indigo-300 text-indigo-700 bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:bg-indigo-950/40";
  }

  function getPillLabel(): string {
    if (eventType === "exception") {
      return eventDetails.user_triggered === true ? "Exception" : "Crash";
    }
    if (eventType === "anr") return "ANR";
    if (eventType === "bug_report") return "Bug Report";
    if (eventType === "gesture_click") return "Click";
    if (eventType === "gesture_long_click") return "Long Click";
    if (eventType === "gesture_scroll") return "Scroll";
    if (eventType === "http") return "HTTP";
    if (eventType === "lifecycle_activity") return "Activity";
    if (eventType === "lifecycle_fragment") return "Fragment";
    if (eventType === "lifecycle_view_controller") return "View Controller";
    if (eventType === "lifecycle_swift_ui") return "SwiftUI";
    if (eventType === "lifecycle_app") return "App";
    if (eventType === "app_exit") return "App Exit";
    if (eventType === "navigation") return "Navigation";
    if (eventType === "screen_view") return "Screen View";
    if (eventType === "cold_launch") return "Cold Launch";
    if (eventType === "warm_launch") return "Warm Launch";
    if (eventType === "hot_launch") return "Hot Launch";
    if (eventType === "low_memory") return "Low Memory";
    if (eventType === "trim_memory") return "Trim Memory";
    if (eventType === "trace") return "Trace";
    if (eventType === "custom") return "Custom";
    if (eventType === "string") return "Log";
    return eventType;
  }

  function getTitle(): string {
    if (eventType === "exception" || eventType === "anr") {
      return `${eventDetails.type}${eventDetails.message ? `: ${eventDetails.message}` : ""}`;
    }
    if (eventType === "bug_report") {
      return eventDetails.description
        ? eventDetails.description
        : eventDetails.bug_report_id;
    }
    if (eventType === "string") {
      return eventDetails.logLevel
        ? `${formatToCamelCase(eventDetails.logLevel)}: ${eventDetails.string}`
        : eventDetails.string;
    }
    if (
      eventType === "gesture_click" ||
      eventType === "gesture_long_click" ||
      eventType === "gesture_scroll"
    ) {
      return eventDetails.target.includes(".")
        ? eventDetails.target.split(".").pop()!
        : eventDetails.target;
    }
    if (eventType === "http") {
      return `${eventDetails.method.toUpperCase()} ${eventDetails.status_code} ${eventDetails.url}`;
    }
    if (
      eventType === "lifecycle_activity" ||
      eventType === "lifecycle_fragment"
    ) {
      const name = eventDetails.class_name.includes(".")
        ? eventDetails.class_name.split(".").pop()!
        : eventDetails.class_name;
      return `${formatToCamelCase(eventDetails.type)}: ${name}`;
    }
    if (
      eventType === "lifecycle_view_controller" ||
      eventType === "lifecycle_swift_ui"
    ) {
      return `${eventDetails.class_name}: ${eventDetails.type}`;
    }
    if (eventType === "lifecycle_app") {
      return formatToCamelCase(eventDetails.type);
    }
    if (eventType === "app_exit") {
      return eventDetails.reason;
    }
    if (eventType === "navigation") {
      return eventDetails.to;
    }
    if (eventType === "screen_view") {
      return eventDetails.name;
    }
    if (eventType === "trace") {
      return eventDetails.trace_name;
    }
    if (eventType === "custom") {
      return eventDetails.name;
    }
    return "";
  }

  function hasSnapshot(): boolean {
    if (!eventDetails.attachments || eventDetails.attachments.length === 0) {
      return false;
    }
    const isImageEligible =
      (eventType === "exception" && eventDetails.user_triggered === false) ||
      eventType === "anr" ||
      eventType === "bug_report" ||
      eventType.includes("gesture");
    const isJsonEligible = eventType.includes("gesture");
    return eventDetails.attachments.some(
      (a: { type: string }) =>
        (a.type === "layout_snapshot" && isImageEligible) ||
        (a.type === "layout_snapshot_json" && isJsonEligible),
    );
  }

  const title = getTitle();
  const snapshot = hasSnapshot();

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-4 font-display outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-ring/50 focus-visible:ring-[2px] focus-visible:ring-inset"
      >
        <div className="flex flex-row items-center gap-3">
          <Pill className={`${getPillColorClasses()} shrink-0 w-28`}>
            {getPillLabel()}
          </Pill>
          {title && (
            <p className="text-sm line-clamp-2 grow min-w-0 break-words">
              {title}
            </p>
          )}
          {!title && <div className="grow" />}
          <Camera
            className={`size-4 shrink-0 text-muted-foreground ${snapshot ? "" : "invisible"}`}
            aria-label="Has screenshot or snapshot"
            aria-hidden={!snapshot}
          />
          <span className="text-xs text-muted-foreground shrink-0 w-[14ch] truncate ml-2">
            {threadName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {formatDateToHumanReadableDateTime(timestamp)}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {expanded && (
        <div className="px-3 pt-1 pb-3">
          <SessionTimelineEventDetails
            teamId={teamId}
            appId={appId}
            demo={demo}
            eventType={eventType}
            eventDetails={eventDetails}
          />
        </div>
      )}
    </div>
  );
}
