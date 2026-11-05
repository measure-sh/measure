import { DateTime } from "luxon";

const gestureTypes = [
  "gesture_click",
  "gesture_long_click",
  "gesture_scroll",
] as const;

export function isGesture(eventType: string): boolean {
  return (gestureTypes as readonly string[]).includes(eventType);
}

// Every event which can carry a layout snapshot or a screenshot, since those
// are the ones which put something new on the screen. An event type which
// starts carrying one belongs here too.
const activityEventTypes = [
  ...gestureTypes,
  "error",
  "anr",
  "app_hang",
  "bug_report",
  "screen_view",
  "lifecycle_activity",
  "lifecycle_app",
] as const;

export function isActivityEvent(eventType: string): boolean {
  return (activityEventTypes as readonly string[]).includes(eventType);
}

export type ReplayEvent = {
  key: string;
  eventType: string;
  thread: string;
  timestamp: string;
  timeAbsMs: number;
  details: any;
};

export function replayEventsFrom(session: any): ReplayEvent[] {
  const collectedEvents: Omit<ReplayEvent, "key">[] = [];

  Object.keys(session.threads ?? {}).forEach((thread) => {
    session.threads[thread].forEach((event: any) => {
      collectedEvents.push({
        eventType: event.event_type,
        thread,
        timestamp: event.timestamp,
        timeAbsMs: DateTime.fromISO(event.timestamp, {
          zone: "utc",
        }).toMillis(),
        details: event,
      });
    });
  });

  // Events arrive from the API grouped under the thread that recorded them, so
  // an event's thread is the key of the group it came in. A trace instead names
  // its own thread and may name none at all, and "unknown" below is the same
  // word the SDKs use for a thread they could not name.
  if (Array.isArray(session.traces)) {
    session.traces.forEach((trace: any) => {
      collectedEvents.push({
        eventType: "trace",
        thread: String(trace.thread_name ?? "unknown"),
        timestamp: trace.start_time,
        timeAbsMs: DateTime.fromISO(trace.start_time, {
          zone: "utc",
        }).toMillis(),
        details: trace,
      });
    });
  }

  collectedEvents.sort((a, b) => a.timeAbsMs - b.timeAbsMs);

  return collectedEvents.map((event, index) => ({
    ...event,
    key: `${event.eventType}|${event.thread}|${event.timestamp}|${index}`,
  }));
}

export type AttachmentRef = {
  eventIndex: number;
  eventKey: string;
  orderIndex: number;
  id: string;
  atOffsetMs: number;
  url: string;
  format: "layout" | "svg" | "raster";
  type: "layout_snapshot_json" | "layout_snapshot" | "screenshot";
};

// Attachments are returned in the order the stage offers them, so the order
// they are pushed in below is the order the switcher lists them in.
export function replayableAttachmentsOf(details: any): {
  id: string;
  location: string;
  format: AttachmentRef["format"];
  type: AttachmentRef["type"];
}[] {
  const attachments = details?.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  // An attachment is fetched from its location and cached under its id, so one
  // arriving from the API without either cannot be drawn and is left out.
  const sources = attachments.filter(
    (attachment: any) =>
      typeof attachment?.location === "string" &&
      typeof attachment?.id === "string" &&
      attachment.id !== "",
  );
  const attachmentsOfType = (type: string) =>
    sources.filter((attachment: any) => attachment.type === type);

  const replayable: {
    id: string;
    location: string;
    format: AttachmentRef["format"];
    type: AttachmentRef["type"];
  }[] = [];

  attachmentsOfType("layout_snapshot_json").forEach((attachment: any) =>
    replayable.push({
      id: attachment.id,
      location: attachment.location,
      format: "layout",
      type: "layout_snapshot_json",
    }),
  );

  // The layout_snapshot type covers a wireframe on some SDKs and a plain image
  // on others, and nothing in the attachment says which, so the file name and
  // the URL are read to tell them apart.
  attachmentsOfType("layout_snapshot").forEach((attachment: any) => {
    const isSvg =
      String(attachment.name ?? "")
        .toLowerCase()
        .endsWith(".svg") || attachment.location.toLowerCase().includes(".svg");
    replayable.push({
      id: attachment.id,
      location: attachment.location,
      format: isSvg ? "svg" : "raster",
      type: "layout_snapshot",
    });
  });

  // Screenshots are collected from every event type, not only gestures, since
  // crashes and ANRs carry them too.
  attachmentsOfType("screenshot").forEach((attachment: any) =>
    replayable.push({
      id: attachment.id,
      location: attachment.location,
      format: "raster",
      type: "screenshot",
    }),
  );

  return replayable;
}
