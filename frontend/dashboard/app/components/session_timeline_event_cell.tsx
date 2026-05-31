"use client";

import { Camera, ChevronDown } from "lucide-react";
import { formatToCamelCase } from "../utils/string_utils";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import Pill, { PillType } from "./pill";
import SessionTimelineEventDetails from "./session_timeline_event_details";

// Maps an event type with a fixed label/colour to its pill type. Errors depend
// on severity too, so they're resolved in pillTypeForEvent below rather than
// here.
const eventPillTypes: Record<string, PillType> = {
  anr: PillType.SessionEventAnr,
  bug_report: PillType.SessionEventBugReport,
  gesture_click: PillType.SessionEventGestureClick,
  gesture_long_click: PillType.SessionEventGestureLongClick,
  gesture_scroll: PillType.SessionEventGestureScroll,
  http: PillType.SessionEventHttp,
  lifecycle_activity: PillType.SessionEventLifecycleActivity,
  lifecycle_fragment: PillType.SessionEventLifecycleFragment,
  lifecycle_view_controller: PillType.SessionEventLifecycleViewController,
  lifecycle_swift_ui: PillType.SessionEventLifecycleSwiftUI,
  lifecycle_app: PillType.SessionEventLifecycleApp,
  app_exit: PillType.SessionEventAppExit,
  navigation: PillType.SessionEventNavigation,
  screen_view: PillType.SessionEventScreenView,
  cold_launch: PillType.SessionEventColdLaunch,
  warm_launch: PillType.SessionEventWarmLaunch,
  hot_launch: PillType.SessionEventHotLaunch,
  low_memory: PillType.SessionEventLowMemory,
  trim_memory: PillType.SessionEventTrimMemory,
  trace: PillType.SessionEventTrace,
  custom: PillType.SessionEventCustom,
  string: PillType.SessionEventLog,
};

function pillTypeForEvent(eventType: string, eventDetails: any): PillType {
  if (eventType === "error") {
    if (eventDetails.severity === "unhandled") {
      return PillType.SessionEventUnhandledError;
    }
    if (eventDetails.severity === "handled") {
      return PillType.SessionEventHandledError;
    }
    if (eventDetails.severity === "fatal") {
      return PillType.SessionEventFatalError;
    }
    return PillType.SessionEventError;
  }
  return eventPillTypes[eventType] ?? PillType.SessionEventDefault;
}

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
  function getTitle(): string {
    if (eventType === "error" || eventType === "anr") {
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
      (eventType === "error" && eventDetails.severity === "fatal") ||
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
  const pillType = pillTypeForEvent(eventType, eventDetails);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-4 font-display outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-ring/50 focus-visible:ring-[2px] focus-visible:ring-inset"
      >
        <div className="flex flex-row items-center gap-3">
          <Pill type={pillType} className="shrink-0 w-28">
            {pillType === PillType.SessionEventDefault ? eventType : null}
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
