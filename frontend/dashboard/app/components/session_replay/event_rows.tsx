"use client";

import Link from "next/link";
import { memo } from "react";
import { openTraceInPerfetto } from "@/app/utils/perfetto_utils";
import { cn } from "@/app/utils/shadcn_utils";
import { formatToCamelCase } from "@/app/utils/string_utils";
import {
  formatDateToHumanReadableDateTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import { toastNegative } from "@/app/components/toast";
import { buttonVariants } from "@/app/components/button_variants";
import CodeBlock, { CODE_BLOCK_CARD_CLASS } from "@/app/components/code_block";
import Pill, { PillType } from "@/app/components/pill";
import {
  isGesture,
  type ReplayEvent,
} from "@/app/components/session_replay/events";
import { type ReplayRow } from "@/app/components/session_replay/replay";

export function formatOffset(ms: number): string {
  const rounded = Math.round(ms);
  const minutes = Math.floor(rounded / 60000);
  const seconds = Math.floor((rounded % 60000) / 1000);
  const millis = rounded % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

const logSeverities = ["debug", "info", "warning", "error", "fatal"];

export function logSeverity(eventDetails: any): string {
  const raw = eventDetails.severity_text;
  const normalized = typeof raw === "string" ? raw.toLowerCase() : "";
  return logSeverities.includes(normalized) ? normalized : "";
}

const eventPillTypes: Record<string, PillType> = {
  anr: PillType.SessionEventAnr,
  app_hang: PillType.SessionEventAppHang,
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
  network_change: PillType.SessionEventNetworkChange,
  screen_view: PillType.SessionEventScreenView,
  cold_launch: PillType.SessionEventColdLaunch,
  warm_launch: PillType.SessionEventWarmLaunch,
  hot_launch: PillType.SessionEventHotLaunch,
  trim_memory: PillType.SessionEventTrimMemory,
  trace: PillType.SessionEventTrace,
  custom: PillType.SessionEventCustom,
  string: PillType.SessionEventLog,
  log: PillType.SessionEventLog,
  profile: PillType.SessionEventProfile,
};

const logPillTypes: Record<string, PillType> = {
  debug: PillType.SessionEventLogDebug,
  info: PillType.SessionEventLogInfo,
  warning: PillType.SessionEventLogWarning,
  error: PillType.SessionEventLogError,
  fatal: PillType.SessionEventLogFatal,
};

export function pillTypeForEvent(
  eventType: string,
  eventDetails: any,
): PillType {
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
  if (eventType === "log" || eventType === "string") {
    return logPillTypes[logSeverity(eventDetails)] ?? PillType.SessionEventLog;
  }
  return eventPillTypes[eventType] ?? PillType.SessionEventDefault;
}

function titleFrom(parts: unknown[], separator: string): string {
  return parts
    .map((part) => String(part ?? ""))
    .filter(Boolean)
    .join(separator);
}

function appHangTitle(eventDetails: any): string {
  const ms = Number(eventDetails?.duration);
  const duration = Number.isFinite(ms) && ms > 0 ? formatHangDuration(ms) : "";
  const recovered = eventDetails?.state !== "killed";

  if (!duration) {
    return recovered
      ? "Main thread blocked"
      : "Main thread blocked, app killed";
  }

  return recovered
    ? `Main thread blocked for ${duration}`
    : `Main thread blocked for ${duration}, app killed`;
}

function formatHangDuration(ms: number): string {
  const seconds = ms / 1000;
  const rounded =
    seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `${rounded}s`;
}

export function sessionEventTitle(
  eventType: string,
  eventDetails: any,
): string {
  if (eventType === "error" || eventType === "anr") {
    return titleFrom([eventDetails?.type, eventDetails?.message], ": ");
  }
  if (eventType === "app_hang") {
    return appHangTitle(eventDetails);
  }
  if (eventType === "bug_report") {
    return String(
      eventDetails?.description || eventDetails?.bug_report_id || "",
    );
  }
  if (eventType === "string") {
    return String(eventDetails?.string ?? "");
  }
  if (eventType === "log") {
    return String(eventDetails?.body ?? "");
  }
  if (isGesture(eventType)) {
    return titleFrom(
      [
        String(eventDetails?.target ?? "")
          .split(".")
          .pop(),
        eventDetails?.label ||
          eventDetails?.semantic_label ||
          eventDetails?.target_id,
      ],
      ": ",
    );
  }
  if (eventType === "http") {
    return titleFrom(
      [
        String(eventDetails?.method ?? "").toUpperCase(),
        eventDetails?.status_code,
        eventDetails?.url,
      ],
      " ",
    );
  }
  if (
    eventType === "lifecycle_activity" ||
    eventType === "lifecycle_fragment"
  ) {
    return titleFrom(
      [
        formatToCamelCase(String(eventDetails?.type ?? "")),
        String(eventDetails?.class_name ?? "")
          .split(".")
          .pop(),
      ],
      ": ",
    );
  }
  if (
    eventType === "lifecycle_view_controller" ||
    eventType === "lifecycle_swift_ui"
  ) {
    return titleFrom([eventDetails?.class_name, eventDetails?.type], ": ");
  }
  if (eventType === "lifecycle_app") {
    return formatToCamelCase(String(eventDetails?.type ?? ""));
  }
  if (eventType === "app_exit") {
    return String(eventDetails?.reason ?? "");
  }
  if (eventType === "navigation") {
    return String(eventDetails?.to ?? "");
  }
  if (eventType === "network_change") {
    const named = (type: unknown, generation: unknown) => {
      const name = String(type ?? "") || "unknown";
      const band = String(generation ?? "");
      return band === "" || band === "unknown" ? name : `${name} (${band})`;
    };
    return titleFrom(
      [
        named(
          eventDetails?.previous_network_type,
          eventDetails?.previous_network_generation,
        ),
        named(eventDetails?.network_type, eventDetails?.network_generation),
      ],
      " to ",
    );
  }
  if (eventType === "screen_view" || eventType === "custom") {
    return String(eventDetails?.name ?? "");
  }
  if (
    eventType === "cold_launch" ||
    eventType === "warm_launch" ||
    eventType === "hot_launch"
  ) {
    const durationMs = Number(eventDetails?.duration);
    return Number.isFinite(durationMs) && durationMs > 0
      ? formatMillisToHumanReadable(durationMs)
      : "";
  }
  if (eventType === "trace") {
    return String(eventDetails?.trace_name ?? "");
  }
  if (eventType === "profile") {
    return String(eventDetails?.trigger ?? "");
  }
  return "";
}

const detailLinkClass = cn(
  buttonVariants({ variant: "secondary" }),
  "justify-center w-fit",
);

function detailRows(eventType: string, eventDetails: any): [string, unknown][] {
  const rows: [string, unknown][] = [];
  Object.entries(eventDetails).forEach(([key, value]) => {
    if (key === "stacktrace" || key === "attachments") {
      return;
    }
    if (eventType === "http" && (key === "start_time" || key === "end_time")) {
      return;
    }
    if (value === "" || value === null || value === undefined) {
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      key === "error" &&
      typeof value === "object" &&
      record.numcode === 0 &&
      record.code === "" &&
      record.meta === null
    ) {
      return;
    }
    if (
      key === "user_defined_attribute" &&
      typeof value === "object" &&
      Object.keys(record).length === 0
    ) {
      return;
    }
    if (typeof value === "object") {
      rows.push([key, value]);
      return;
    }
    if (key === "timestamp" || key === "start_time" || key === "end_time") {
      rows.push([key, formatDateToHumanReadableDateTime(String(value))]);
      return;
    }
    if (key === "duration") {
      rows.push([key, formatMillisToHumanReadable(parseInt(String(value)))]);
      return;
    }
    rows.push([key, value]);
  });
  return rows;
}

function ReplayEventDetails({
  teamId,
  appId,
  eventType,
  eventDetails,
  demo,
}: {
  teamId: string;
  appId: string;
  eventType: string;
  eventDetails: any;
  demo: boolean;
}) {
  const stacktrace =
    typeof eventDetails.stacktrace === "string" &&
    eventDetails.stacktrace !== ""
      ? eventDetails.stacktrace
      : null;

  const link = (() => {
    if (eventType === "error" || eventType === "anr") {
      return {
        label: `View ${eventType === "error" ? "Error" : "ANR"} Details`,
        href: `/${teamId}/errors/${appId}/${eventDetails.group_id}/${encodeURIComponent(
          `${eventDetails.type}${eventDetails.file_name ? `@${eventDetails.file_name}` : ""}`,
        )}?from=session_replay_details`,
      };
    }
    if (eventType === "app_hang") {
      return {
        label: "View App Hang Details",
        href: `/${teamId}/errors/${appId}/${eventDetails.group_id}/${encodeURIComponent(
          eventDetails.file_name || "unknown_file",
        )}?from=session_replay_details`,
      };
    }
    if (eventType === "trace") {
      return {
        label: "View Trace Details",
        href: `/${teamId}/traces/${appId}/${eventDetails.trace_id}`,
      };
    }
    if (eventType === "bug_report") {
      return {
        label: "View Bug Report Details",
        href: `/${teamId}/bug_reports/${appId}/${eventDetails.bug_report_id}`,
      };
    }
    return null;
  })();

  const attachments =
    eventType === "profile" && Array.isArray(eventDetails.attachments)
      ? eventDetails.attachments
      : [];

  return (
    <div className="flex flex-col gap-3 font-display wrap-break-word">
      <div className="flex flex-col">
        {detailRows(eventType, eventDetails).map(([key, value]) => (
          <div
            key={key}
            className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/40 last:border-b-0"
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
              {key}
            </p>
            {typeof value === "object" && value !== null ? (
              <pre className="text-xs font-code whitespace-pre-wrap wrap-break-word m-0">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <p className="text-xs wrap-break-word font-code">
                {String(value)}
              </p>
            )}
          </div>
        ))}
        {stacktrace && (
          <div className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/40 last:border-b-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
              STACKTRACE
            </p>
            <CodeBlock
              language="java"
              className={cn(CODE_BLOCK_CARD_CLASS, "text-xs leading-relaxed")}
              code={stacktrace}
            />
          </div>
        )}
      </div>

      {link &&
        (demo ? (
          <div className={detailLinkClass}>{link.label}</div>
        ) : (
          <Link href={link.href} className={detailLinkClass}>
            {link.label}
          </Link>
        ))}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {attachments.map((attachment: any) => (
            <div key={attachment.key} className="flex flex-wrap gap-3">
              {attachment.type.startsWith("perfetto_") &&
                (demo ? (
                  <div className={detailLinkClass}>Open in Perfetto</div>
                ) : (
                  <button
                    type="button"
                    className={detailLinkClass}
                    onClick={() =>
                      openTraceInPerfetto(
                        attachment.location,
                        attachment.name,
                      ).catch((error) =>
                        toastNegative(
                          "Failed to open trace in Perfetto",
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                    }
                  >
                    Open in Perfetto
                  </button>
                ))}
              {demo ? (
                <div className={detailLinkClass}>Download</div>
              ) : (
                <a
                  href={attachment.location}
                  download={attachment.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={detailLinkClass}
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ReplayEventRow = memo(function ReplayEventRow({
  row,
  event,
  index,
  isActive,
  isPast,
  expanded,
  teamId,
  appId,
  demo,
  onSelect,
  registerRow,
}: {
  row: ReplayRow;
  event: ReplayEvent;
  index: number;
  isActive: boolean;
  isPast: boolean;
  expanded: boolean;
  teamId: string;
  appId: string;
  demo: boolean;
  onSelect: (index: number, key: string) => void;
  registerRow: (index: number, el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={(el) => registerRow(index, el)}>
      <button
        type="button"
        data-event-type={event.eventType}
        aria-expanded={expanded}
        onClick={() => onSelect(index, event.key)}
        className={cn(
          "w-full text-left px-3 py-2 font-display outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
          isActive && "bg-accent",
          !isActive && !isPast && "opacity-55",
        )}
      >
        <div className="flex flex-row items-center gap-2">
          <span
            className={cn("size-1.5 rounded-full shrink-0", row.markClass)}
          />
          <span className="text-[11px] font-code text-muted-foreground tabular-nums shrink-0 w-[8ch]">
            {row.atOffsetLabel}
          </span>
          {/* Most event names fit in this fixed width; longer ones are
              truncated. Pill supplies its own text, so this needs block
              display for truncation to work. */}
          <Pill
            type={row.pillType}
            className="shrink-0 w-20 text-[10px] px-1 py-0 block truncate text-center"
          >
            {row.pillText}
          </Pill>
          {/* This width fits "main" and numbered thread names; longer names
              are truncated. Events without a thread name keep an empty span
              of the same width so adjacent titles stay aligned. */}
          {row.threadName === "" ? (
            <span className="shrink-0 w-14" />
          ) : (
            <Pill
              type={PillType.SessionEventThread}
              className="shrink-0 w-14 text-[10px] px-1 py-0"
            >
              <span className="truncate">{row.threadName}</span>
            </Pill>
          )}
          {row.title && (
            <span className="text-xs line-clamp-1 grow min-w-0 break-all">
              {row.title}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div data-testid="session-replay-event-details" className="px-3 pb-3">
          <ReplayEventDetails
            teamId={teamId}
            appId={appId}
            demo={demo}
            eventType={event.eventType}
            eventDetails={event.details}
          />
        </div>
      )}
    </div>
  );
});
