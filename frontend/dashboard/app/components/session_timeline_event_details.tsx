"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { cn } from "../utils/shadcn_utils";
import {
  formatDateToHumanReadableDateTime,
  formatMillisToHumanReadable,
} from "../utils/time_utils";
import { buttonVariants } from "./button_variants";
import CodeBlock from "./code_block";
import LayoutSnapshot from "./layout_snapshot";

// Text size matches the attribute rows so the stacktrace doesn't visually
// dominate the rest of the event detail.
const stacktraceClassName =
  "font-code text-xs leading-relaxed rounded-sm overflow-hidden [&_pre]:p-4 [&_pre]:overflow-x-auto";

function renderAttributeRow(key: string, value: unknown): ReactNode {
  const isObject = typeof value === "object" && value !== null;
  return (
    <div
      key={key}
      className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/40 last:border-b-0"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
        {key}
      </p>
      {isObject ? (
        <pre className="text-xs font-code whitespace-pre-wrap break-words m-0">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="text-xs break-words font-code">{String(value)}</p>
      )}
    </div>
  );
}

type SessionTimelineEventDetailsProps = {
  teamId: string;
  appId: string;
  eventType: string;
  eventDetails: any;
  demo?: boolean;
};

export default function SessionTimelineEventDetails({
  teamId,
  appId,
  eventType,
  eventDetails,
  demo = false,
}: SessionTimelineEventDetailsProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (key: string) => {
    setImageErrors((prev) => new Set(prev).add(key));
  };

  function getBodyFromEventDetails(): ReactNode {
    // Pulled out so the stacktrace renders as a syntax-highlighted Java
    // CodeBlock — keeping it inline with the attribute rows would lose
    // newlines and make frames unreadable.
    const stacktrace =
      typeof eventDetails.stacktrace === "string" &&
      eventDetails.stacktrace !== ""
        ? eventDetails.stacktrace
        : null;

    const entries: Array<[string, unknown]> = [];
    Object.entries(eventDetails).forEach(([key, value]) => {
      if (key === "stacktrace") {
        return;
      }
      // Attachments are already rendered as the snapshot images above.
      if (key === "attachments") {
        return;
      }
      // For http events, start_time and end_time are uptime ms, not timestamps.
      if (
        eventType === "http" &&
        (key === "start_time" || key === "end_time")
      ) {
        return;
      }
      if (value === "" || value === null || value === undefined) {
        return;
      }
      if (
        key === "error" &&
        typeof value === "object" &&
        value !== null &&
        (value as Record<string, unknown>).numcode === 0 &&
        (value as Record<string, unknown>).code === "" &&
        (value as Record<string, unknown>).meta === null
      ) {
        return;
      }
      if (typeof value === "object") {
        entries.push([key, value]);
        return;
      }
      let display: string | number | boolean = value as
        | string
        | number
        | boolean;
      if (key === "timestamp" || key === "start_time" || key === "end_time") {
        display = formatDateToHumanReadableDateTime(value.toString());
      } else if (key === "duration") {
        display = formatMillisToHumanReadable(parseInt(value.toString()));
      }
      entries.push([key, display]);
    });

    return (
      <div className="flex flex-col">
        {entries.map(([k, v]) => renderAttributeRow(k, v))}
        {stacktrace && (
          <div className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/40 last:border-b-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
              STACKTRACE
            </p>
            <CodeBlock
              language="java"
              className={stacktraceClassName}
              code={stacktrace}
            />
          </div>
        )}
      </div>
    );
  }

  function getJsonLayoutSnapshotsFromEventDetails(): ReactNode {
    if (
      eventDetails.attachments !== undefined &&
      eventDetails.attachments !== null &&
      eventDetails.attachments.length > 0
    ) {
      if (
        eventType === "gesture_click" ||
        eventType === "gesture_long_click" ||
        eventType === "gesture_scroll"
      ) {
        return (
          <div className="flex flex-wrap gap-4 items-start">
            {eventDetails.attachments
              .filter(
                (attachment: { key: string; location: string; type: string }) =>
                  attachment.type === "layout_snapshot_json",
              )
              .map((attachment: { key: string; location: string }) => (
                <LayoutSnapshot
                  key={attachment.key}
                  width={350}
                  height={350}
                  layoutUrl={attachment.location}
                />
              ))}
          </div>
        );
      }
    }
  }

  function getImageLayoutSnapshotsFromEventDetails(): ReactNode {
    if (
      eventDetails.attachments !== undefined &&
      eventDetails.attachments !== null &&
      eventDetails.attachments.length > 0
    ) {
      if (
        eventType === "error" ||
        eventType === "anr" ||
        eventType === "gesture_click" ||
        eventType === "gesture_long_click" ||
        eventType === "gesture_scroll" ||
        eventType === "bug_report"
      ) {
        const imageAttachments = eventDetails.attachments.filter(
          (attachment: { key: string; location: string; type: string }) =>
            attachment.type === "layout_snapshot" &&
            !imageErrors.has(attachment.key),
        );

        if (imageAttachments.length === 0) {
          return null;
        }

        return (
          <div className="flex flex-wrap gap-4 items-start">
            {imageAttachments.map(
              (
                attachment: { key: string; location: string },
                index: number,
              ) => (
                <Image
                  key={attachment.key}
                  className="border border-black"
                  src={attachment.location}
                  width={150}
                  height={150}
                  unoptimized={true}
                  alt={`Screenshot ${index}`}
                  onError={() => handleImageError(attachment.key)}
                />
              ),
            )}
          </div>
        );
      }
    }
  }

  function getDetailsLinkFromEventDetails(): ReactNode {
    const linkStyle = cn(
      buttonVariants({ variant: "secondary" }),
      "justify-center w-fit",
    );
    if (eventType === "error" || eventType === "anr") {
      const label = `View ${eventType === "error" ? "Error" : "ANR"} Details`;
      return (
        <div>
          {demo ? (
            <div className={linkStyle}>{label}</div>
          ) : (
            <Link
              key={eventDetails.id}
              href={`/${teamId}/errors/${appId}/${eventDetails.group_id}/${eventDetails.type + "@" + eventDetails.file_name}`}
              className={linkStyle}
            >
              {label}
            </Link>
          )}
        </div>
      );
    }
    if (eventType === "trace") {
      const label = "View Trace Details";
      return (
        <div>
          {demo ? (
            <div className={linkStyle}>{label}</div>
          ) : (
            <Link
              key={eventDetails.id}
              href={`/${teamId}/traces/${appId}/${eventDetails.trace_id}`}
              className={linkStyle}
            >
              {label}
            </Link>
          )}
        </div>
      );
    }
    if (eventType === "bug_report") {
      const label = "View Bug Report Details";
      return (
        <div>
          {demo ? (
            <div className={linkStyle}>{label}</div>
          ) : (
            <Link
              key={eventDetails.id}
              href={`/${teamId}/bug_reports/${appId}/${eventDetails.bug_report_id}`}
              className={linkStyle}
            >
              {label}
            </Link>
          )}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 font-display break-words">
      {getJsonLayoutSnapshotsFromEventDetails()}
      {getImageLayoutSnapshotsFromEventDetails()}
      {getBodyFromEventDetails()}
      {getDetailsLinkFromEventDetails()}
    </div>
  );
}
