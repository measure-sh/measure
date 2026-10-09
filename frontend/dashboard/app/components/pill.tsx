"use client";

import * as React from "react";
import { cn } from "@/app/utils/shadcn_utils";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export enum PillType {
  // Neutral is for free-form context chips (time, device, app version) and
  // filter chips.
  Neutral = "neutral",
  // Error types
  Crash = "crash",
  Error = "error",
  Anr = "anr",
  // Error severities
  Fatal = "fatal",
  Unhandled = "unhandled",
  Handled = "handled",
  // Bug report statuses
  OpenStatus = "open",
  ClosedStatus = "closed",
  // Trace and span statuses
  StatusUnset = "status-unset",
  StatusOkay = "status-okay",
  StatusError = "status-error",
  // Session events
  SessionEventFatalError = "session_event_fatal_error",
  SessionEventUnhandledError = "session_event_unhandled_error",
  SessionEventHandledError = "session_event_handled_error",
  SessionEventError = "session_event_error",
  SessionEventAnr = "session_event_anr",
  SessionEventAppHang = "session_event_app_hang",
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
  SessionEventNetworkChange = "session_event_network_change",
  SessionEventScreenView = "session_event_screen_view",
  SessionEventColdLaunch = "session_event_cold_launch",
  SessionEventWarmLaunch = "session_event_warm_launch",
  SessionEventHotLaunch = "session_event_hot_launch",
  SessionEventTrimMemory = "session_event_trim_memory",
  SessionEventTrace = "session_event_trace",
  SessionEventCustom = "session_event_custom",
  SessionEventLog = "session_event_log",
  SessionEventLogDebug = "session_event_log_debug",
  SessionEventLogInfo = "session_event_log_info",
  SessionEventLogWarning = "session_event_log_warning",
  SessionEventLogError = "session_event_log_error",
  SessionEventLogFatal = "session_event_log_fatal",
  SessionEventProfile = "session_event_profile",
  SessionEventThread = "session_event_thread",
  SessionEventDefault = "session_event_default",
}

interface PillProps {
  children?: React.ReactNode;
  type?: PillType;
  // true → tooltip with the pill's own text. string → tooltip with that text.
  // Omit or false → no tooltip.
  tooltip?: boolean | string;
  // Click handler for the body. When set, the body becomes a button.
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

// Session event colours. `tint` styles the pill, square-ish (rounded-sm) to
// override the badge's pill shape, and `mark` is the matching solid colour that
// session replay uses to draw the same event as a dot or a thin vertical line.
// Spelled out in full because Tailwind can't see interpolated class names.
const sessionRed = {
  tint: "rounded-sm border-red-400 text-red-700 bg-red-100 dark:border-red-400 dark:text-red-400 dark:bg-red-950/40",
  mark: "bg-red-500",
};
const sessionAmber = {
  tint: "rounded-sm border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-950/40",
  mark: "bg-amber-500",
};
const sessionYellow = {
  tint: "rounded-sm border-yellow-400 text-yellow-700 bg-yellow-100 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-950/40",
  mark: "bg-yellow-500",
};
const sessionEmerald = {
  tint: "rounded-sm border-emerald-400 text-emerald-700 bg-emerald-100 dark:border-emerald-400 dark:text-emerald-400 dark:bg-emerald-950/40",
  mark: "bg-emerald-500",
};
const sessionFuchsia = {
  tint: "rounded-sm border-fuchsia-400 text-fuchsia-700 bg-fuchsia-100 dark:border-fuchsia-400 dark:text-fuchsia-400 dark:bg-fuchsia-950/40",
  mark: "bg-fuchsia-500",
};
const sessionCyan = {
  tint: "rounded-sm border-cyan-400 text-cyan-700 bg-cyan-100 dark:border-cyan-400 dark:text-cyan-400 dark:bg-cyan-950/40",
  mark: "bg-cyan-500",
};
const sessionPink = {
  tint: "rounded-sm border-pink-400 text-pink-700 bg-pink-100 dark:border-pink-400 dark:text-pink-400 dark:bg-pink-950/40",
  mark: "bg-pink-500",
};
const sessionPurple = {
  tint: "rounded-sm border-purple-400 text-purple-700 bg-purple-100 dark:border-purple-400 dark:text-purple-400 dark:bg-purple-950/40",
  mark: "bg-purple-500",
};
const sessionTeal = {
  tint: "rounded-sm border-teal-400 text-teal-700 bg-teal-100 dark:border-teal-400 dark:text-teal-400 dark:bg-teal-950/40",
  mark: "bg-teal-500",
};
const sessionIndigo = {
  tint: "rounded-sm border-indigo-400 text-indigo-700 bg-indigo-100 dark:border-indigo-400 dark:text-indigo-400 dark:bg-indigo-950/40",
  mark: "bg-indigo-500",
};
const sessionZinc = {
  tint: "rounded-sm border-zinc-400 text-zinc-700 bg-zinc-100 dark:border-zinc-400 dark:text-zinc-300 dark:bg-zinc-800/60",
  mark: "bg-zinc-500",
};

const pillDefaults: Record<
  PillType,
  { label?: string; tint: string; mark?: string }
> = {
  [PillType.Neutral]: { tint: "" },
  [PillType.Crash]: {
    label: "Crash",
    tint: "border-sky-400 text-sky-700 bg-sky-100 dark:border-sky-400 dark:text-sky-400 dark:bg-sky-950/40",
  },
  [PillType.Error]: {
    label: "Error",
    tint: "border-slate-400 text-slate-700 bg-slate-100 dark:border-slate-400 dark:text-slate-300 dark:bg-slate-800/60",
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
  [PillType.SessionEventFatalError]: { label: "Fatal Error", ...sessionRed },
  [PillType.SessionEventUnhandledError]: {
    label: "Unhandled Error",
    ...sessionAmber,
  },
  [PillType.SessionEventHandledError]: {
    label: "Handled Error",
    ...sessionYellow,
  },
  [PillType.SessionEventError]: { label: "Error", ...sessionRed },
  [PillType.SessionEventAnr]: { label: "ANR", ...sessionRed },
  [PillType.SessionEventAppHang]: { label: "App Hang", ...sessionRed },
  [PillType.SessionEventBugReport]: { label: "Bug Report", ...sessionRed },
  [PillType.SessionEventGestureClick]: { label: "Click", ...sessionEmerald },
  [PillType.SessionEventGestureLongClick]: {
    label: "Long Click",
    ...sessionEmerald,
  },
  [PillType.SessionEventGestureScroll]: {
    label: "Scroll",
    ...sessionEmerald,
  },
  [PillType.SessionEventHttp]: { label: "HTTP", ...sessionCyan },
  [PillType.SessionEventLifecycleActivity]: {
    label: "Activity",
    ...sessionIndigo,
  },
  [PillType.SessionEventLifecycleFragment]: {
    label: "Fragment",
    ...sessionIndigo,
  },
  [PillType.SessionEventLifecycleViewController]: {
    label: "View Controller",
    ...sessionIndigo,
  },
  [PillType.SessionEventLifecycleSwiftUI]: {
    label: "SwiftUI",
    ...sessionIndigo,
  },
  [PillType.SessionEventLifecycleApp]: { label: "App", ...sessionIndigo },
  [PillType.SessionEventAppExit]: { label: "App Exit", ...sessionIndigo },
  [PillType.SessionEventNavigation]: {
    label: "Navigation",
    ...sessionFuchsia,
  },
  [PillType.SessionEventNetworkChange]: {
    label: "Network Change",
    ...sessionCyan,
  },
  [PillType.SessionEventScreenView]: {
    label: "Screen View",
    ...sessionFuchsia,
  },
  [PillType.SessionEventColdLaunch]: {
    label: "Cold Launch",
    ...sessionIndigo,
  },
  [PillType.SessionEventWarmLaunch]: {
    label: "Warm Launch",
    ...sessionIndigo,
  },
  [PillType.SessionEventHotLaunch]: {
    label: "Hot Launch",
    ...sessionIndigo,
  },
  [PillType.SessionEventTrimMemory]: {
    label: "Trim Memory",
    ...sessionIndigo,
  },
  [PillType.SessionEventTrace]: { label: "Trace", ...sessionPink },
  [PillType.SessionEventCustom]: { label: "Custom", ...sessionPurple },
  [PillType.SessionEventLog]: { label: "Log", ...sessionIndigo },
  [PillType.SessionEventLogDebug]: { ...sessionTeal },
  [PillType.SessionEventLogInfo]: { ...sessionIndigo },
  [PillType.SessionEventLogWarning]: { ...sessionAmber },
  [PillType.SessionEventLogError]: { ...sessionRed },
  [PillType.SessionEventLogFatal]: { ...sessionRed },
  [PillType.SessionEventProfile]: {
    label: "Profile",
    ...sessionTeal,
  },
  [PillType.SessionEventThread]: { ...sessionZinc },
  [PillType.SessionEventDefault]: { ...sessionIndigo },
};

export function pillMark(type: PillType): string {
  return pillDefaults[type].mark ?? "";
}

const tooltipChars = 1000;

const interactiveZone =
  "outline-none transition-colors duration-100 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

const Pill: React.FC<PillProps> = ({
  children,
  type = PillType.Neutral,
  tooltip,
  onClick,
  className,
  "data-testid": testId,
}) => {
  const defaults = pillDefaults[type];
  const body = children ?? defaults.label;
  if (body === undefined || body === null || body === "") {
    return null;
  }

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
          className="font-body max-w-96 text-sm"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    );
  };

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

  return wrapTip(
    <Badge
      variant="outline"
      data-testid={testId}
      className={cn("select-none", defaults.tint, className)}
    >
      {body}
    </Badge>,
  );
};

export default Pill;
