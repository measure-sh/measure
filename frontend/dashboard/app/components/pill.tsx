"use client";

import { RotateCcw, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/app/utils/shadcn_utils";
import { Badge, badgeVariants } from "./badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export enum PillType {
  // Default — neutral capsule used for free-form context chips
  // (Time, Device, App version, etc.) and filter chips.
  Neutral = "neutral",
  // Errors — type
  Error = "error",
  Anr = "anr",
  // Errors — severity
  Fatal = "fatal",
  Unhandled = "unhandled",
  Handled = "handled",
  // Bug report — status
  OpenStatus = "open",
  ClosedStatus = "closed",
  // Trace / span — status
  StatusUnset = "status-unset",
  StatusOkay = "status-okay",
  StatusError = "status-error",
  // Session timeline events — one type per event, coloured by family and
  // (for errors) severity. Square-ish (rounded-sm) to set them apart from the
  // pill-shaped filter/status chips above.
  SessionEventFatalError = "session_event_fatal_error",
  SessionEventUnhandledError = "session_event_unhandled_error",
  SessionEventHandledError = "session_event_handled_error",
  SessionEventError = "session_event_error",
  SessionEventAnr = "session_event_anr",
  SessionEventBugReport = "session_event_bug_report",
  SessionEventGestureClick = "session_event_gesture_click",
  SessionEventGestureLongClick = "session_event_gesture_long_click",
  SessionEventGestureScroll = "session_event_gesture_scroll",
  SessionEventHttp = "session_event_http",
  SessionEventLifecycleActivity = "session_event_lifecycle_activity",
  SessionEventLifecycleFragment = "session_event_lifecycle_fragment",
  SessionEventLifecycleViewController = "session_event_lifecycle_view_controller",
  SessionEventLifecycleSwiftUI = "session_event_lifecycle_swift_ui",
  SessionEventLifecycleApp = "session_event_lifecycle_app",
  SessionEventAppExit = "session_event_app_exit",
  SessionEventNavigation = "session_event_navigation",
  SessionEventScreenView = "session_event_screen_view",
  SessionEventColdLaunch = "session_event_cold_launch",
  SessionEventWarmLaunch = "session_event_warm_launch",
  SessionEventHotLaunch = "session_event_hot_launch",
  SessionEventLowMemory = "session_event_low_memory",
  SessionEventTrimMemory = "session_event_trim_memory",
  SessionEventTrace = "session_event_trace",
  SessionEventCustom = "session_event_custom",
  SessionEventLog = "session_event_log",
  SessionEventDefault = "session_event_default",
}

// Action button shown on the right half of the pill. "clear" empties the
// underlying filter and removes the pill; "reset" restores a non-empty
// default (and the pill stays visible).
export type PillAction = {
  icon: "clear" | "reset";
  onClick: () => void;
};

interface PillProps {
  children?: React.ReactNode;
  type?: PillType;
  // true → tooltip with the pill's own text. string → tooltip with that text.
  // Omit or false → no tooltip.
  tooltip?: boolean | string;
  // Click handler for the body. When set, the body becomes a button.
  onClick?: () => void;
  // Optional action button (X for clear, ↺ for reset). Pair with onClick to
  // make a two-zone interactive pill.
  action?: PillAction;
  className?: string;
}

// Session-event tints. Shared by colour family across the per-event types
// below, and square-ish (rounded-sm) to override the badge's pill shape.
// Spelled out in full because Tailwind can't see interpolated class names.
const sessionRed =
  "rounded-sm border-red-400 text-red-700 bg-red-100 dark:border-red-400 dark:text-red-400 dark:bg-red-950/40";
const sessionAmber =
  "rounded-sm border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-950/40";
const sessionYellow =
  "rounded-sm border-yellow-400 text-yellow-700 bg-yellow-100 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-950/40";
const sessionEmerald =
  "rounded-sm border-emerald-400 text-emerald-700 bg-emerald-100 dark:border-emerald-400 dark:text-emerald-400 dark:bg-emerald-950/40";
const sessionFuchsia =
  "rounded-sm border-fuchsia-400 text-fuchsia-700 bg-fuchsia-100 dark:border-fuchsia-400 dark:text-fuchsia-400 dark:bg-fuchsia-950/40";
const sessionCyan =
  "rounded-sm border-cyan-400 text-cyan-700 bg-cyan-100 dark:border-cyan-400 dark:text-cyan-400 dark:bg-cyan-950/40";
const sessionPink =
  "rounded-sm border-pink-400 text-pink-700 bg-pink-100 dark:border-pink-400 dark:text-pink-400 dark:bg-pink-950/40";
const sessionPurple =
  "rounded-sm border-purple-400 text-purple-700 bg-purple-100 dark:border-purple-400 dark:text-purple-400 dark:bg-purple-950/40";
// Indigo is the catch-all for lifecycle, launches, memory, logs and any
// otherwise-unmapped event.
const sessionIndigo =
  "rounded-sm border-indigo-400 text-indigo-700 bg-indigo-100 dark:border-indigo-400 dark:text-indigo-400 dark:bg-indigo-950/40";

// Typed defaults: each PillType carries its display label (when no children
// are passed) and its colour tint.
const pillDefaults: Record<PillType, { label?: string; tint: string }> = {
  [PillType.Neutral]: { tint: "" },
  [PillType.Error]: {
    label: "Error",
    tint: "border-sky-400 text-sky-700 bg-sky-100 dark:border-sky-400 dark:text-sky-400 dark:bg-sky-950/40",
  },
  [PillType.Anr]: {
    label: "ANR",
    tint: "border-violet-400 text-violet-700 bg-violet-100 dark:border-violet-400 dark:text-violet-400 dark:bg-violet-950/40",
  },
  [PillType.Fatal]: {
    label: "Fatal",
    tint: "border-red-400 text-red-700 bg-red-100 dark:border-red-400 dark:text-red-400 dark:bg-red-950/40",
  },
  [PillType.Unhandled]: {
    label: "Unhandled",
    tint: "border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-950/40",
  },
  [PillType.Handled]: {
    label: "Handled",
    tint: "border-yellow-400 text-yellow-700 bg-yellow-100 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-950/40",
  },
  [PillType.OpenStatus]: {
    label: "Open",
    tint: "border-green-400 text-green-700 bg-green-100 dark:border-green-400 dark:text-green-400 dark:bg-green-950/40",
  },
  [PillType.ClosedStatus]: {
    label: "Closed",
    tint: "border-indigo-400 text-indigo-700 bg-indigo-100 dark:border-indigo-400 dark:text-indigo-400 dark:bg-indigo-950/40",
  },
  [PillType.StatusUnset]: { label: "Unset", tint: "" },
  [PillType.StatusOkay]: {
    label: "Okay",
    tint: "border-green-400 text-green-700 bg-green-100 dark:border-green-400 dark:text-green-400 dark:bg-green-950/40",
  },
  [PillType.StatusError]: {
    label: "Error",
    tint: "border-red-400 text-red-700 bg-red-100 dark:border-red-400 dark:text-red-400 dark:bg-red-950/40",
  },
  [PillType.SessionEventFatalError]: { label: "Fatal Error", tint: sessionRed },
  [PillType.SessionEventUnhandledError]: {
    label: "Unhandled Error",
    tint: sessionAmber,
  },
  [PillType.SessionEventHandledError]: {
    label: "Handled Error",
    tint: sessionYellow,
  },
  [PillType.SessionEventError]: { label: "Error", tint: sessionRed },
  [PillType.SessionEventAnr]: { label: "ANR", tint: sessionRed },
  [PillType.SessionEventBugReport]: { label: "Bug Report", tint: sessionRed },
  [PillType.SessionEventGestureClick]: { label: "Click", tint: sessionEmerald },
  [PillType.SessionEventGestureLongClick]: {
    label: "Long Click",
    tint: sessionEmerald,
  },
  [PillType.SessionEventGestureScroll]: {
    label: "Scroll",
    tint: sessionEmerald,
  },
  [PillType.SessionEventHttp]: { label: "HTTP", tint: sessionCyan },
  [PillType.SessionEventLifecycleActivity]: {
    label: "Activity",
    tint: sessionIndigo,
  },
  [PillType.SessionEventLifecycleFragment]: {
    label: "Fragment",
    tint: sessionIndigo,
  },
  [PillType.SessionEventLifecycleViewController]: {
    label: "View Controller",
    tint: sessionIndigo,
  },
  [PillType.SessionEventLifecycleSwiftUI]: {
    label: "SwiftUI",
    tint: sessionIndigo,
  },
  [PillType.SessionEventLifecycleApp]: { label: "App", tint: sessionIndigo },
  [PillType.SessionEventAppExit]: { label: "App Exit", tint: sessionIndigo },
  [PillType.SessionEventNavigation]: {
    label: "Navigation",
    tint: sessionFuchsia,
  },
  [PillType.SessionEventScreenView]: {
    label: "Screen View",
    tint: sessionFuchsia,
  },
  [PillType.SessionEventColdLaunch]: {
    label: "Cold Launch",
    tint: sessionIndigo,
  },
  [PillType.SessionEventWarmLaunch]: {
    label: "Warm Launch",
    tint: sessionIndigo,
  },
  [PillType.SessionEventHotLaunch]: {
    label: "Hot Launch",
    tint: sessionIndigo,
  },
  [PillType.SessionEventLowMemory]: {
    label: "Low Memory",
    tint: sessionIndigo,
  },
  [PillType.SessionEventTrimMemory]: {
    label: "Trim Memory",
    tint: sessionIndigo,
  },
  [PillType.SessionEventTrace]: { label: "Trace", tint: sessionPink },
  [PillType.SessionEventCustom]: { label: "Custom", tint: sessionPurple },
  [PillType.SessionEventLog]: { label: "Log", tint: sessionIndigo },
  // No label: the cell passes the raw event type as children for unknown
  // events, mirroring the old `return eventType` fallback.
  [PillType.SessionEventDefault]: { tint: sessionIndigo },
};

const tooltipChars = 1000;

const interactiveZone =
  "outline-none transition-colors duration-100 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

const Pill: React.FC<PillProps> = ({
  children,
  type = PillType.Neutral,
  tooltip,
  onClick,
  action,
  className,
}) => {
  const defaults = pillDefaults[type];
  const body = children ?? defaults.label;
  if (body === undefined || body === null || body === "") {
    return null;
  }

  // Resolve the tooltip text. true uses the body when it's a string; explicit
  // strings always win.
  const tooltipText =
    typeof tooltip === "string"
      ? tooltip
      : tooltip === true && typeof body === "string"
        ? body
        : undefined;
  const trimmedTooltip =
    tooltipText && tooltipText.length > tooltipChars
      ? tooltipText.slice(0, tooltipChars) + "..."
      : tooltipText;

  // Wraps any element in a tooltip when one was requested.
  const wrapTip = (
    node: React.ReactElement,
    explicitContent?: string,
  ): React.ReactElement => {
    const content = explicitContent ?? trimmedTooltip;
    if (!content) {
      return node;
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="font-display max-w-96 text-sm"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Two-zone interactive pill: clickable body + clear/reset action button.
  // Outer span carries the badge shell with padding zeroed out so the inner
  // halves own their padding and fill the capsule edge-to-edge on hover.
  if (action) {
    const ariaPrefix = action.icon === "reset" ? "Reset" : "Clear";
    const ariaBody = typeof body === "string" ? body.split(":")[0] : "";
    return (
      <span
        className={cn(
          badgeVariants({ variant: "outline" }),
          "p-0 items-stretch select-none",
          defaults.tint,
          className,
        )}
      >
        {wrapTip(
          <button
            type="button"
            onClick={onClick}
            className={cn("rounded-l-full px-2 py-1", interactiveZone)}
          >
            {body}
          </button>,
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${ariaPrefix} ${ariaBody}`.trim()}
              onClick={action.onClick}
              className={cn(
                "inline-flex items-center justify-center rounded-r-full pr-2 pl-1",
                interactiveZone,
              )}
            >
              {action.icon === "reset" ? (
                <RotateCcw className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {action.icon === "reset" ? "Reset to defaults" : "Clear"}
          </TooltipContent>
        </Tooltip>
      </span>
    );
  }

  // Single interactive pill: clickable body, no separate action.
  if (onClick) {
    return wrapTip(
      <Badge
        asChild
        variant="outline"
        className={cn("select-none", defaults.tint, interactiveZone, className)}
      >
        <button type="button" onClick={onClick}>
          {body}
        </button>
      </Badge>,
    );
  }

  // Static pill: just a Badge.
  return wrapTip(
    <Badge
      variant="outline"
      className={cn("select-none", defaults.tint, className)}
    >
      {body}
    </Badge>,
  );
};

export default Pill;
