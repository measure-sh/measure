"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { DateTime } from "luxon";
import posthog from "posthog-js";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  and,
  assertEvent,
  assign,
  raise,
  setup,
  type ActorRefFrom,
} from "xstate";
import {
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";
import { useActorRef, useSelector } from "@xstate/react";
import { kilobytesToMegabytes } from "../utils/number_utils";
import { openTraceInPerfetto } from "../utils/perfetto_utils";
import { cn } from "../utils/shadcn_utils";
import { useChartColor, useChartColors } from "../utils/shared_styles";
import { formatToCamelCase } from "../utils/string_utils";
import {
  formatChartFormatTimestampToHumanReadable,
  formatDateToHumanReadableDateTime,
  formatMillisToHumanReadable,
  formatTimestampToChartFormat,
} from "../utils/time_utils";
import { toastNegative } from "./toast";
import { buttonVariants } from "./button_variants";
import CodeBlock, { CODE_BLOCK_CARD_CLASS } from "./code_block";
import Pill, { PillType } from "./pill";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import { Switch } from "./switch";

type Tilt = { xDegrees: number; yDegrees: number };

type HoverLabel = { label: string; x: number; y: number; flip: boolean };

type DragOrigin = {
  pointerX: number;
  pointerY: number;
  tiltX: number;
  tiltY: number;
  screenScale: number;
};

type AttachmentSwitcher = {
  eventKey: string | null;
  shownIndex: number;
};

type MachineContext = {
  session: unknown;
  replay: Replay | null;
  playheadOffsetMs: number;
  sliceIndex: number;
  playbackSpeed: number;
  idleSkipEnabled: boolean;
  skippedIdleMs: number | null;
  attachmentSwitcher: AttachmentSwitcher;
  tilt: Tilt;
  hoverLabel: HoverLabel | null;
  dragOrigin: DragOrigin | null;
};

type MachineEvent =
  | { type: "user.toggle" }
  | { type: "user.seek"; toOffsetMs: number }
  | { type: "user.setSpeed"; playbackSpeed: number }
  | { type: "user.toggleIdleSkip" }
  | { type: "user.selectAttachment"; index: number }
  | {
      type: "user.pointerDown";
      x: number;
      y: number;
      button: number;
      screenScale: number;
    }
  | {
      type: "user.pointerMove";
      x: number;
      y: number;
      buttons: number;
      hoverLabel: HoverLabel | null;
    }
  | { type: "user.pointerUp" }
  | { type: "user.pointerCancel" }
  | { type: "user.pointerLeave" }
  | { type: "user.doubleClick" }
  | { type: "clock.tick"; clockOffsetMs: number }
  | { type: "slice.changed" }
  | { type: "skip.performed" }
  | { type: "replay.received"; session: unknown };

export const sessionReplayMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
  },
  guards: {
    isPrimaryPointerButton: ({ event }) => {
      assertEvent(event, "user.pointerDown");
      return event.button === 0;
    },
    isShownAttachmentTiltable: ({ context }) =>
      shownAttachmentRefOf(context)?.format === "layout",
    isEveryPointerButtonReleased: ({ event }) => {
      assertEvent(event, "user.pointerMove");
      return event.buttons === 0;
    },
    isIdleSkipEnabled: ({ context }) => context.idleSkipEnabled,
    isClockAtEnd: ({ context, event }) => {
      assertEvent(event, "clock.tick");
      return event.clockOffsetMs >= (context.replay?.durationMs ?? 0);
    },
    isSliceSkippable: ({ context }) => {
      const targetOffsetMs = sliceOf(context)?.skipToOffsetMs;
      return (
        targetOffsetMs != null && targetOffsetMs > context.playheadOffsetMs
      );
    },
    isPlayheadAtEnd: ({ context }) =>
      context.replay !== null &&
      context.playheadOffsetMs >= context.replay.durationMs,
    isCrossingSlice: ({ context, event }) => {
      assertEvent(event, "clock.tick");
      return sliceIndexOf(context, event.clockOffsetMs) !== context.sliceIndex;
    },
  },
  actions: {
    setPlayheadFromSeek: assign(({ context, event }) => {
      assertEvent(event, "user.seek");
      return playheadAt(context, event.toOffsetMs);
    }),
    setPlayheadFromClock: assign(({ context, event }) => {
      assertEvent(event, "clock.tick");
      return playheadAt(context, event.clockOffsetMs);
    }),
    setPlayheadToStart: assign(({ context }) => playheadAt(context, 0)),
    setPlayheadToEnd: assign(({ context }) =>
      playheadAt(context, context.replay?.durationMs ?? 0),
    ),
    skipIdleGap: assign(({ context, event }) => {
      assertEvent(event, "clock.tick");
      const targetOffsetMs = sliceOf(context)!.skipToOffsetMs!;
      return {
        ...playheadAt(context, targetOffsetMs),
        skippedIdleMs: targetOffsetMs - event.clockOffsetMs,
      };
    }),
    clearSkippedIdle: assign({ skippedIdleMs: null }),
    setReplayFromSession: assign(({ context, event }) => {
      assertEvent(event, "replay.received");
      const replay = replayFrom(event.session);
      return {
        session: event.session,
        replay,
        sliceIndex: sliceIndexAt(replay.slices, context.playheadOffsetMs),
      };
    }),
    setPlaybackSpeed: assign(({ event }) => {
      assertEvent(event, "user.setSpeed");
      return { playbackSpeed: event.playbackSpeed };
    }),
    toggleIdleSkip: assign(({ context }) => ({
      idleSkipEnabled: !context.idleSkipEnabled,
    })),
    // Which attachment the viewer picked is remembered against the event it was
    // picked on, so moving to an event carrying attachments of its own starts at
    // the first of those rather than at the same position in the list.
    setShownAttachment: assign(({ context, event }) => {
      assertEvent(event, "user.selectAttachment");
      return {
        attachmentSwitcher: {
          eventKey: shownAttachmentRefGroupOf(context)?.key ?? null,
          shownIndex: event.index,
        },
      };
    }),
    setDragOrigin: assign(({ context, event }) => {
      assertEvent(event, "user.pointerDown");
      return {
        dragOrigin: {
          pointerX: event.x,
          pointerY: event.y,
          tiltX: context.tilt.xDegrees,
          tiltY: context.tilt.yDegrees,
          screenScale: event.screenScale,
        },
      };
    }),
    clearDragOrigin: assign({ dragOrigin: null }),
    setTiltFromDrag: assign(({ context, event }) => {
      assertEvent(event, "user.pointerMove");
      return {
        tilt: tiltFromDrag(context.dragOrigin!, event.x, event.y),
      };
    }),
    setTiltToRest: assign(() => ({ tilt: restingTilt })),
    setHoverLabel: assign(({ event }) => {
      assertEvent(event, "user.pointerMove");
      return { hoverLabel: event.hoverLabel };
    }),
    clearHoverLabel: assign({ hoverLabel: null }),
    raiseSkipPerformed: raise({ type: "skip.performed" }),
    raiseSliceChanged: raise({ type: "slice.changed" }),
  },
  delays: {
    noticeDelay: 2500,
  },
}).createMachine({
  id: "sessionReplay",
  initial: "ready",
  context: () => ({
    session: null,
    replay: null,
    playheadOffsetMs: 0,
    sliceIndex: 0,
    playbackSpeed: 1,
    idleSkipEnabled: false,
    skippedIdleMs: null,
    attachmentSwitcher: { eventKey: null, shownIndex: 0 },
    tilt: restingTilt,
    hoverLabel: null,
    dragOrigin: null,
  }),
  on: {
    // The page hands over a fresh session whenever the query refetches, so
    // ready is re-entered to rebuild the replay around the newly signed
    // attachment URLs it carries.
    "replay.received": {
      target: ".ready",
      reenter: true,
      actions: "setReplayFromSession",
    },
  },
  states: {
    ready: {
      type: "parallel",
      on: {
        "user.setSpeed": { actions: "setPlaybackSpeed" },
        "user.toggleIdleSkip": { actions: "toggleIdleSkip" },
        "user.selectAttachment": { actions: "setShownAttachment" },
      },
      // The three regions run at once, sharing the context and receiving every
      // event. Each region sees its own transitions, so playback announces a
      // skip and a slice change as events for the others to act on.
      states: {
        playback: {
          // The history node restores whichever of paused, playing and ended
          // was active last, so a session refetched and rebuilt underneath the
          // viewer leaves them where they were. On first arrival there is no
          // history to restore and it falls to paused.
          initial: "history",
          states: {
            history: { type: "history", target: "paused" },
            paused: {
              on: {
                // Seeking to the end and pressing play rewinds, the same as
                // pressing play on a replay that ran to its end.
                "user.toggle": [
                  {
                    guard: "isPlayheadAtEnd",
                    target: "playing",
                    actions: "setPlayheadToStart",
                  },
                  { target: "playing" },
                ],
                "user.seek": {
                  target: "paused",
                  reenter: true,
                  actions: "setPlayheadFromSeek",
                },
              },
            },
            playing: {
              on: {
                "user.toggle": { target: "paused" },
                "user.seek": {
                  target: "playing",
                  reenter: true,
                  actions: "setPlayheadFromSeek",
                },
                "clock.tick": [
                  { guard: "isClockAtEnd", target: "ended" },
                  {
                    guard: and(["isIdleSkipEnabled", "isSliceSkippable"]),
                    actions: [
                      "skipIdleGap",
                      "raiseSkipPerformed",
                      "raiseSliceChanged",
                    ],
                  },
                  {
                    guard: "isCrossingSlice",
                    actions: ["setPlayheadFromClock", "raiseSliceChanged"],
                  },
                  { actions: "setPlayheadFromClock" },
                ],
              },
            },
            ended: {
              entry: "setPlayheadToEnd",
              on: {
                "user.toggle": {
                  target: "playing",
                  actions: "setPlayheadToStart",
                },
                "user.seek": {
                  target: "paused",
                  actions: "setPlayheadFromSeek",
                },
              },
            },
          },
        },
        inspection: {
          initial: "idle",
          states: {
            idle: {
              on: {
                "user.pointerDown": {
                  guard: and([
                    "isPrimaryPointerButton",
                    "isShownAttachmentTiltable",
                  ]),
                  target: "dragging",
                  actions: "setDragOrigin",
                },
                "user.pointerMove": { actions: "setHoverLabel" },
                "user.pointerLeave": { actions: "clearHoverLabel" },
                "user.doubleClick": { actions: "setTiltToRest" },
              },
            },
            dragging: {
              entry: "clearHoverLabel",
              exit: "clearDragOrigin",
              on: {
                "user.pointerMove": [
                  { guard: "isEveryPointerButtonReleased", target: "idle" },
                  { actions: "setTiltFromDrag" },
                ],
                "user.pointerUp": { target: "idle" },
                "user.pointerCancel": { target: "idle" },
                "user.seek": { target: "idle" },
                "slice.changed": { target: "idle" },
              },
            },
          },
        },
        notice: {
          initial: "hidden",
          states: {
            hidden: {
              on: { "skip.performed": { target: "visible" } },
            },
            visible: {
              on: { "skip.performed": { target: "visible", reenter: true } },
              after: {
                noticeDelay: { target: "hidden", actions: "clearSkippedIdle" },
              },
            },
          },
        },
      },
    },
  },
});

type SessionReplayActor = ActorRefFrom<typeof sessionReplayMachine>;

// ==========================================================================
// The machine's computations
// ==========================================================================

function playheadAt(
  context: MachineContext,
  offsetMs: number,
): { playheadOffsetMs: number; sliceIndex: number } {
  const replay = context.replay;
  if (replay === null) {
    return { playheadOffsetMs: 0, sliceIndex: 0 };
  }
  const playheadOffsetMs = Math.max(0, Math.min(replay.durationMs, offsetMs));
  return {
    playheadOffsetMs,
    sliceIndex: sliceIndexAt(replay.slices, playheadOffsetMs),
  };
}

function sliceIndexOf(context: MachineContext, offsetMs: number): number {
  return playheadAt(context, offsetMs).sliceIndex;
}

function carriedForward(
  attachmentRefGroupIndexByEventIndex: (number | undefined)[],
  eventCount: number,
): (number | undefined)[] {
  // Each event carries forward the last attachment recorded before it, so the
  // stage keeps drawing that screen until a newer attachment arrives.
  const carried: (number | undefined)[] = new Array(eventCount);
  let latest: number | undefined = undefined;
  for (let index = 0; index < eventCount; index += 1) {
    const own = attachmentRefGroupIndexByEventIndex[index];
    if (own !== undefined) {
      latest = own;
    }
    carried[index] = latest;
  }
  return carried;
}

function sliceOf(context: MachineContext): ReplaySlice | null {
  return context.replay?.slices[context.sliceIndex] ?? null;
}

function shownAttachmentRefGroupOf(
  context: MachineContext,
): AttachmentRefGroup | null {
  const slice = sliceOf(context);
  const replay = context.replay;
  if (slice === null || replay === null) {
    return null;
  }
  const groupIndex =
    replay.shownAttachmentRefGroupIndexByEventIndex[slice.eventIndex];
  return groupIndex === undefined
    ? null
    : replay.attachmentRefGroups[groupIndex];
}

function shownIndexOf(
  switcher: AttachmentSwitcher,
  group: AttachmentRefGroup | null,
): number {
  if (group === null) {
    return 0;
  }
  return switcher.eventKey === group.key
    ? Math.min(switcher.shownIndex, group.attachmentRefs.length - 1)
    : 0;
}

// The attachment the playhead calls for, whether or not it has been fetched.
export function shownAttachmentRefOf(
  context: MachineContext,
): AttachmentRef | null {
  const group = shownAttachmentRefGroupOf(context);
  if (group === null) {
    return null;
  }
  return group.attachmentRefs[shownIndexOf(context.attachmentSwitcher, group)];
}

const gestureTypes = [
  "gesture_click",
  "gesture_long_click",
  "gesture_scroll",
] as const;

function isGesture(eventType: string): boolean {
  return (gestureTypes as readonly string[]).includes(eventType);
}

const activityEventTypes = [
  ...gestureTypes,
  "error",
  "anr",
  "bug_report",
] as const;

function isActivityEvent(eventType: string): boolean {
  return (activityEventTypes as readonly string[]).includes(eventType);
}

// The longest stretch of real time one frame may stand for. Frames come about
// every 16ms, so only a gap the browser left, such as a tab in the background,
// reaches this.
const maxPlaybackStepMs = 250;

// Where the playhead stands after a frame worth `elapsedMs` of real time. The
// step is capped first, so a replay left in a background tab carries on from
// close to where it reached rather than from the far side of the gap.
export function tickOffsetMs(
  playheadOffsetMs: number,
  elapsedMs: number,
  playbackSpeed: number,
  durationMs: number,
): number {
  const stepMs = Math.min(elapsedMs, maxPlaybackStepMs);
  return Math.min(durationMs, playheadOffsetMs + stepMs * playbackSpeed);
}

export const idleSkipThresholdMs = 5000;

const idleSkipLeadMs = 500;

const dragDegreesPerPixel = 0.5;

const restingTilt: Tilt = { xDegrees: -8, yDegrees: 24 };

const maxTiltDegrees = 55;

function tiltFromDrag(
  origin: DragOrigin,
  clientX: number,
  clientY: number,
): Tilt {
  const clamp = (value: number) =>
    Math.max(-maxTiltDegrees, Math.min(maxTiltDegrees, value));
  const deltaX = (clientX - origin.pointerX) * origin.screenScale;
  const deltaY = (clientY - origin.pointerY) * origin.screenScale;
  return {
    xDegrees: clamp(origin.tiltX - deltaY * dragDegreesPerPixel),
    yDegrees: clamp(origin.tiltY + deltaX * dragDegreesPerPixel),
  };
}

// ==========================================================================
// Collecting: a session becomes events and attachment refs
// ==========================================================================

type ReplayEvent = {
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

type AttachmentRef = {
  eventIndex: number;
  eventKey: string;
  orderIndex: number;
  id: string;
  atOffsetMs: number;
  url: string;
  format: "layout" | "svg" | "raster";
};

// Attachments are returned in the order the stage offers them, so the order
// they are pushed in below is the order the switcher lists them in.
function replayableAttachmentsOf(
  details: any,
): { id: string; location: string; format: AttachmentRef["format"] }[] {
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
  }[] = [];

  attachmentsOfType("layout_snapshot_json").forEach((attachment: any) =>
    replayable.push({
      id: attachment.id,
      location: attachment.location,
      format: "layout",
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
    });
  });

  // Screenshots are collected from every event type, not only gestures, since
  // crashes and ANRs carry them too.
  attachmentsOfType("screenshot").forEach((attachment: any) =>
    replayable.push({
      id: attachment.id,
      location: attachment.location,
      format: "raster",
    }),
  );

  return replayable;
}

// ==========================================================================
// Loading: attachment refs become attachments
// ==========================================================================

type FrameContent =
  | { kind: "svg"; markup: string }
  | { kind: "image" }
  | { kind: "layout"; root: LayoutElement };

// A fetched attachment, carrying the id of the attachment ref it came from.
export type Attachment = {
  id: string;
  sourceSize: Size;
  layerCount: number | null;
  content: FrameContent;
};

export type AttachmentFit = {
  sourceSize: Size;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type LayoutElement = {
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highlighted: boolean;
  children: LayoutElement[];
};

const attachmentFetchTimeoutMs = 30_000;

// An attachment is fetched once and does not change, so its query is left
// fresh. Nothing observes an attachment until the playhead reaches it, so this
// has to
// outlast a viewing of the whole session. Any shorter and the query cache
// would drop what the window fetched ahead, only for it to be fetched again.
const attachmentGcTimeMs = 30 * 60 * 1000;

const attachmentFetchConcurrency = 8;

// An attachment gets one more try, which covers a fetch lost to a blip in the
// network without holding a fetch slot for long. React Query counts the
// attempts, so a failure arriving with none left is the last word on that
// attachment.
const attachmentFetchRetries = 1;

// Attachments within the first radius of the playhead are fetched, and those
// within the second are kept, so the query cache holds at most 500 at once. The
// gap between the two radii stops a playhead sitting on a boundary from
// dropping and refetching the same attachment.
const attachmentFetchRadius = 225;

const attachmentKeepRadius = 250;

// The window is worked out afresh every time the playhead crosses this many
// attachments.
const attachmentWindowStride = 25;

// Playing a session moves the playhead past attachments that have not been
// fetched yet, and most fetches finish well inside this time, so the stage
// waits this long before saying it is loading. Without the wait the message
// would flash on screen at nearly every attachment.
const stageMessageDelayMs = 200;

// Presigned URLs are signed afresh on every session refetch, so the query is
// keyed by the id the attachment carries and takes its URL from whichever
// attachment ref the caller holds at the time.
function attachmentQueryOptions(
  sessionId: string,
  attachmentRef: AttachmentRef | null,
  sessionAttributes: any,
) {
  return {
    queryKey: ["session-attachment", sessionId, attachmentRef?.id ?? "none"],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const deadline = deadlineOn(signal);
      try {
        return await loadFrame(
          attachmentRef!,
          sessionAttributes,
          deadline.signal,
        );
      } finally {
        deadline.clear();
      }
    },
    enabled: attachmentRef !== null,
    staleTime: Infinity,
    gcTime: attachmentGcTimeMs,
    // An attachment that failed stays failed until a re-signed session brings
    // new URLs, so the stage drawing it again does not set off another fetch.
    retryOnMount: false,
    // Both the window fetching ahead and the stage drawing an attachment ask for
    // the same query, so reporting from either of them would count some
    // failures twice. Reporting from here, where a fetch runs out of attempts,
    // counts each failure once no matter which of the two asked for it.
    retry: (failureCount: number, error: unknown) => {
      if (isCancellation(error)) {
        return false;
      }
      if (failureCount < attachmentFetchRetries) {
        return true;
      }
      reportAttachmentFailure(attachmentRef!, error);
      return false;
    },
  };
}

// Leaving the replay aborts the fetches in flight, and a window that moves on
// drops the attachments it no longer covers, so those rejections say nothing
// about the attachment.
function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function reportAttachmentFailure(
  attachmentRef: AttachmentRef,
  error: unknown,
): void {
  console.error(
    `session replay could not load attachment ${attachmentRef.id}`,
    error,
  );
  posthog.captureException(
    new Error("session replay failed to load an attachment"),
    {
      attachment_id: attachmentRef.id,
      attachment_format: attachmentRef.format,
    },
  );
}

// A response that never arrives would hold one of the eight fetch slots for
// good, so every fetch carries a deadline of its own alongside the signal the
// query cancels with. The caller gets back a clear() to stop the timer once the
// fetch has finished, whichever way it finished. jsdom has neither
// AbortSignal.any nor AbortSignal.timeout, which would leave the tests running
// without any deadline at all, so the two signals are combined by hand.
function deadlineOn(signal: AbortSignal): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new Error("attachment fetch timed out")),
    attachmentFetchTimeoutMs,
  );
  const onAbort = () => {
    window.clearTimeout(timer);
    controller.abort(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

// The index of the attachment at the given offset into the replay, or of the
// next one after it. This is the centre the window is measured from.
export function attachmentRefIndexAt(
  attachmentRefs: AttachmentRef[],
  atOffsetMs: number,
): number {
  let low = 0;
  let high = attachmentRefs.length - 1;
  let index = attachmentRefs.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (attachmentRefs[mid].atOffsetMs >= atOffsetMs) {
      index = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return index;
}

// The attachments the window covers, nearest to the centre first, so a seek
// fetches the screen the viewer is looking at before the ones around it.
export function windowedAttachmentRefs(
  attachmentRefs: AttachmentRef[],
  centerIndex: number,
  radius: number,
): AttachmentRef[] {
  const first = Math.max(0, centerIndex - radius);
  const last = Math.min(attachmentRefs.length - 1, centerIndex + radius);
  const windowed: AttachmentRef[] = [];
  let ahead = Math.min(Math.max(centerIndex, first), last + 1);
  let behind = ahead - 1;
  while (ahead <= last || behind >= first) {
    if (ahead <= last) {
      windowed.push(attachmentRefs[ahead]);
      ahead += 1;
    }
    if (behind >= first) {
      windowed.push(attachmentRefs[behind]);
      behind -= 1;
    }
  }
  return windowed;
}

// Brings the query cache in line with where the playhead is: attachments beyond
// the keep radius are dropped, and the ones the window covers are fetched a few
// at a time. An attachment already cached needs no request.
async function reconcileAttachmentWindow(
  client: QueryClient,
  sessionId: string,
  attachmentRefs: AttachmentRef[],
  sessionAttributes: any,
  centerIndex: number,
  cancelled: () => boolean,
): Promise<void> {
  // The attachments worth keeping are named up front and the rest dropped in one
  // pass. Asking after each attachment in turn would search the whole query cache
  // every time, and that cache holds every session the viewer has opened.
  const kept = new Set(
    windowedAttachmentRefs(
      attachmentRefs,
      centerIndex,
      attachmentKeepRadius,
    ).map((attachmentRef) => attachmentRef.id),
  );
  const beyondTheWindow = {
    predicate: (query: Query) =>
      query.queryKey[0] === "session-attachment" &&
      query.queryKey[1] === sessionId &&
      !kept.has(query.queryKey[2] as string),
  };
  client.cancelQueries(beyondTheWindow);
  client.removeQueries(beyondTheWindow);

  // A query that holds no data counts as stale however long it is kept fresh
  // for, so an attachment that failed would be fetched and reported again on every
  // pass. It is left as it is until a re-signed session brings new URLs.
  const failed = new Set(
    client
      .getQueryCache()
      .getAll()
      .filter(
        (query) =>
          query.queryKey[0] === "session-attachment" &&
          query.queryKey[1] === sessionId &&
          query.state.status === "error",
      )
      .map((query) => query.queryKey[2]),
  );
  const wanted = windowedAttachmentRefs(
    attachmentRefs,
    centerIndex,
    attachmentFetchRadius,
  ).filter((attachmentRef) => !failed.has(attachmentRef.id));
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < wanted.length && !cancelled()) {
      const attachmentRef = wanted[nextIndex];
      nextIndex += 1;
      try {
        await client.fetchQuery(
          attachmentQueryOptions(sessionId, attachmentRef, sessionAttributes),
        );
      } catch {
        // The failure has already been reported by the query's retry handler.
        // An attachment that could not be fetched leaves its own screen blank,
        // and the rest of the window is still worth fetching.
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(attachmentFetchConcurrency, wanted.length) },
      worker,
    ),
  );
}

async function loadFrame(
  attachmentRef: AttachmentRef,
  sessionAttributes: any,
  signal: AbortSignal,
): Promise<Attachment> {
  if (attachmentRef.format === "layout") {
    const root = await fetchAttachment(attachmentRef.url, signal).then(
      (response) => response.json(),
    );
    if (!isLayoutElement(root)) {
      throw new Error(
        `layout snapshot ${attachmentRef.id} is not a tree of elements`,
      );
    }
    return {
      id: attachmentRef.id,
      sourceSize: { width: root.width, height: root.height },
      layerCount: layerCountOf(root),
      content: { kind: "layout", root },
    };
  }

  // Wireframe markup is kept as text rather than handed to the browser as an
  // image, because the stage rewrites the SDK's highlight colour to the team's
  // accent in the markup before drawing it.
  if (attachmentRef.format === "svg") {
    const svg = await fetchAttachment(attachmentRef.url, signal).then(
      (response) => response.text(),
    );
    const box = viewBoxOf(svg);
    if (box === null) {
      throw new Error(
        `wireframe ${attachmentRef.id} has no viewBox to size it by`,
      );
    }
    return {
      id: attachmentRef.id,
      sourceSize: box,
      layerCount: null,
      content: { kind: "svg", markup: svg },
    };
  }

  // Only a screenshot's size is worth keeping. Its pixels are fetched by the
  // img that draws it, from whichever URL the attachment ref holds at the time,
  // so a session refetched with newly signed URLs needs nothing dropped from
  // the query cache.
  const size = await imageSizeOf(attachmentRef.url, signal);
  return {
    id: attachmentRef.id,
    sourceSize: sourceSizeOf(size, sessionAttributes),
    layerCount: null,
    content: { kind: "image" },
  };
}

async function fetchAttachment(
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`fetching ${url} returned ${response.status}`);
  }
  return response;
}

// A raster is drawn at the size the device recorded it at, which only the
// decoded image knows, so it is measured before the stage places it.
export function imageSizeOf(url: string, signal: AbortSignal): Promise<Size> {
  return new Promise<Size>((resolve, reject) => {
    const image = new Image();
    const settle = (outcome: () => void) => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
      outcome();
    };
    // Rejecting with the abort's own reason is what lets isCancellation above
    // tell the two kinds of abort apart. Leaving the replay aborts with an
    // AbortError and is passed over in silence, while the deadline aborts with
    // a plain Error and is reported as an attachment that could not be fetched.
    const onAbort = () =>
      settle(() => {
        // Clearing the source is what tells the browser to stop downloading.
        // Rejecting alone would release this fetch's place among the eight that
        // run at once while the transfer carried on, so against a slow origin
        // the abandoned downloads would pile up and take bandwidth from the
        // attachments the playhead is heading towards.
        image.src = "";
        reject(signal.reason);
      });
    signal.addEventListener("abort", onAbort, { once: true });
    image.onload = () =>
      settle(() =>
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? resolve({
              width: image.naturalWidth,
              height: image.naturalHeight,
            })
          : reject(new Error(`${url} decoded to an empty image`)),
      );
    image.onerror = () =>
      settle(() => reject(new Error(`${url} did not load`)));
    image.src = url;
  });
}

// The size a wireframe is drawn at comes from its viewBox, which the SDKs write
// as four numbers, the last two being the width and height.
export function viewBoxOf(
  svg: string,
): { width: number; height: number } | null {
  const match = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (!match) {
    return null;
  }
  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function isLayoutElement(value: any): value is LayoutElement {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

// ==========================================================================
// Building: a session becomes slices, rows and touches
// ==========================================================================

type Size = { width: number; height: number };

type DevicePoint = { x: number; y: number };

type ReplayTouch = {
  pressOffsetMs: number;
  releaseOffsetMs: number;
  from: DevicePoint;
  to: DevicePoint;
};

type ReplayRow = {
  atOffsetLabel: string;
  title: string;
  pillType: PillType;
  pillText: string | null;
  threadName: string;
  tintClass: string;
};

type ReplaySlice = {
  startOffsetMs: number;
  eventIndex: number;
  touchIndex: number | null;
  skipToOffsetMs: number | null;
};

type Replay = {
  startAbsMs: number;
  durationMs: number;
  events: ReplayEvent[];
  rows: ReplayRow[];
  slices: ReplaySlice[];
  touches: ReplayTouch[];
  attachmentRefs: AttachmentRef[];
  attachmentRefGroups: AttachmentRefGroup[];
  shownAttachmentRefGroupIndexByEventIndex: (number | undefined)[];
};

type AttachmentRefGroup = {
  key: string;
  eventIndex: number;
  attachmentRefs: AttachmentRef[];
};

const touchHoldMs = 220;

const swipeTravelMs = 320;

type GestureTouch = {
  pressX: number;
  pressY: number;
  liftX: number;
  liftY: number;
  releaseAbsMs: number;
};

function gestureTouchOf(event: ReplayEvent): GestureTouch | null {
  if (!isGesture(event.eventType)) {
    return null;
  }
  const pressX = Number(event.details?.x);
  const pressY = Number(event.details?.y);
  if (!Number.isFinite(pressX) || !Number.isFinite(pressY)) {
    return null;
  }
  const endX = Number(event.details?.end_x);
  const endY = Number(event.details?.end_y);
  const travelled =
    Number.isFinite(endX) &&
    Number.isFinite(endY) &&
    (endX !== pressX || endY !== pressY);
  return {
    pressX,
    pressY,
    liftX: travelled ? endX : pressX,
    liftY: travelled ? endY : pressY,
    releaseAbsMs: event.timeAbsMs + (travelled ? swipeTravelMs : touchHoldMs),
  };
}

function replayRowFrom(event: ReplayEvent, atOffsetMs: number): ReplayRow {
  const severity = logSeverity(event.details);
  const pillType = pillTypeForEvent(event.eventType, event.details);
  return {
    atOffsetLabel: formatOffset(atOffsetMs),
    title: sessionEventTitle(event.eventType, event.details),
    pillType,
    threadName: event.thread,
    pillText:
      severity !== ""
        ? `Log: ${formatToCamelCase(severity)}`
        : pillType === PillType.SessionEventDefault
          ? event.eventType
          : null,
    tintClass: tintForEvent(event),
  };
}

type SliceBoundary = {
  startOffsetMs: number;
  eventIndex: number | null;
  pressedTouchIndex: number | null;
  releasedTouchIndex: number | null;
};

// One walk over the events works out everything playback needs, so a replay
// that is running only reads these arrays by index and never searches them.
// Time is cut into slices at every event and at every touch release, and the
// slice the playhead is in names the active row, the touch ring and the
// attachment to draw.
export function replayFrom(session: any): Replay {
  const events = replayEventsFrom(session);
  if (events.length === 0) {
    return {
      startAbsMs: 0,
      durationMs: 0,
      events,
      rows: [],
      slices: [],
      touches: [],
      attachmentRefs: [],
      attachmentRefGroups: [],
      shownAttachmentRefGroupIndexByEventIndex: [],
    };
  }

  const startAbsMs = events[0].timeAbsMs;
  const rows: ReplayRow[] = [];
  const touches: ReplayTouch[] = [];
  const attachmentRefs: AttachmentRef[] = [];
  const activityOffsetsMs: number[] = [];
  const boundaries: SliceBoundary[] = [];
  let endOffsetMs = 0;

  events.forEach((event, eventIndex) => {
    const atOffsetMs = event.timeAbsMs - startAbsMs;
    rows.push(replayRowFrom(event, atOffsetMs));
    const eventBoundary: SliceBoundary = {
      startOffsetMs: atOffsetMs,
      eventIndex,
      pressedTouchIndex: null,
      releasedTouchIndex: null,
    };
    boundaries.push(eventBoundary);
    endOffsetMs = Math.max(endOffsetMs, atOffsetMs);

    if (isActivityEvent(event.eventType)) {
      activityOffsetsMs.push(atOffsetMs);
    }

    const gesture = gestureTouchOf(event);
    if (gesture !== null) {
      const releaseOffsetMs = gesture.releaseAbsMs - startAbsMs;
      const touchIndex = touches.length;
      touches.push({
        pressOffsetMs: atOffsetMs,
        releaseOffsetMs,
        from: { x: gesture.pressX, y: gesture.pressY },
        to: { x: gesture.liftX, y: gesture.liftY },
      });
      eventBoundary.pressedTouchIndex = touchIndex;
      boundaries.push({
        startOffsetMs: releaseOffsetMs,
        eventIndex: null,
        pressedTouchIndex: null,
        releasedTouchIndex: touchIndex,
      });
      endOffsetMs = Math.max(endOffsetMs, releaseOffsetMs);
    }

    replayableAttachmentsOf(event.details).forEach((attachment, orderIndex) => {
      attachmentRefs.push({
        eventIndex,
        eventKey: event.key,
        orderIndex,
        id: attachment.id,
        atOffsetMs,
        url: attachment.location,
        format: attachment.format,
      });
    });
  });

  boundaries.sort((a, b) => a.startOffsetMs - b.startOffsetMs);

  // A slice that begins at a touch release keeps naming the event the slice
  // before it named, so its row stays highlighted while the touch ring fades.
  const slices: ReplaySlice[] = [];
  let eventIndex = 0;
  let touchIndex: number | null = null;
  boundaries.forEach((boundary) => {
    if (boundary.eventIndex !== null) {
      eventIndex = boundary.eventIndex;
      if (boundary.pressedTouchIndex !== null) {
        touchIndex = boundary.pressedTouchIndex;
      }
    }
    if (
      boundary.releasedTouchIndex !== null &&
      boundary.releasedTouchIndex === touchIndex
    ) {
      touchIndex = null;
    }
    const previous = slices[slices.length - 1];
    if (previous && previous.startOffsetMs === boundary.startOffsetMs) {
      previous.eventIndex = eventIndex;
      previous.touchIndex = touchIndex;
      return;
    }
    slices.push({
      startOffsetMs: boundary.startOffsetMs,
      eventIndex,
      touchIndex,
      skipToOffsetMs: null,
    });
  });

  const durationMs = Math.max(1, endOffsetMs);
  fillIdleSkipTargets(slices, activityOffsetsMs, durationMs);

  // The refs were collected event by event, and within an event in the order
  // the switcher lists them, so appending to each group as they are walked
  // keeps both orders without any sorting.
  const attachmentRefGroups: AttachmentRefGroup[] = [];
  const attachmentRefGroupIndexByEventIndex: (number | undefined)[] = [];
  attachmentRefs.forEach((attachmentRef) => {
    const at = attachmentRefGroupIndexByEventIndex[attachmentRef.eventIndex];
    if (at === undefined) {
      attachmentRefGroupIndexByEventIndex[attachmentRef.eventIndex] =
        attachmentRefGroups.length;
      attachmentRefGroups.push({
        key: attachmentRef.eventKey,
        eventIndex: attachmentRef.eventIndex,
        attachmentRefs: [attachmentRef],
      });
    } else {
      attachmentRefGroups[at].attachmentRefs.push(attachmentRef);
    }
  });

  return {
    startAbsMs,
    durationMs,
    events,
    rows,
    slices,
    touches,
    attachmentRefs,
    attachmentRefGroups,
    shownAttachmentRefGroupIndexByEventIndex: carriedForward(
      attachmentRefGroupIndexByEventIndex,
      events.length,
    ),
  };
}

function fillIdleSkipTargets(
  slices: ReplaySlice[],
  activityOffsetsMs: number[],
  durationMs: number,
): void {
  let nextActivity = 0;
  slices.forEach((slice) => {
    while (
      nextActivity < activityOffsetsMs.length &&
      activityOffsetsMs[nextActivity] <= slice.startOffsetMs
    ) {
      nextActivity += 1;
    }
    const nextActivityOffsetMs =
      nextActivity < activityOffsetsMs.length
        ? activityOffsetsMs[nextActivity]
        : null;
    const idleEndOffsetMs = nextActivityOffsetMs ?? durationMs;
    if (idleEndOffsetMs - slice.startOffsetMs <= idleSkipThresholdMs) {
      return;
    }
    const targetOffsetMs =
      nextActivityOffsetMs === null
        ? durationMs
        : nextActivityOffsetMs - idleSkipLeadMs;
    // Skipping stops short of the next activity by a lead time, so the viewer
    // sees a moment of stillness before whatever happens next. The lead is
    // shorter than the gap that counts as idle, so the target always lands
    // ahead of where this slice began. It can still land past slices in
    // between, since slices are cut at every event while only gestures, errors
    // and bug reports count as activity, and a log or an http call inside the
    // gap starts a slice the skip carries straight over. Those slices hold no
    // attachment of their own, so nothing that would be drawn is missed.
    slice.skipToOffsetMs = targetOffsetMs;
  });
}

export function sliceIndexAt(
  slices: ReplaySlice[],
  playheadOffsetMs: number,
): number {
  let low = 0;
  let high = slices.length - 1;
  let index = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (slices[mid].startOffsetMs <= playheadOffsetMs) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return index;
}

export function fitInto(
  sourceSize: Size,
  stageWidth: number,
  stageHeight: number,
): AttachmentFit {
  // The attachment keeps its aspect ratio and takes the largest box that fits
  // the stage once room is left for the overlays: the attachment switcher and
  // the skip notice along the top, the turn hint along the bottom.
  const boxWidth = Math.max(1, stageWidth - stageInsetXPx * 2);
  const boxHeight = Math.max(
    1,
    stageHeight - stageInsetTopPx - stageInsetBottomPx,
  );
  const scale = Math.min(
    boxWidth / sourceSize.width,
    boxHeight / sourceSize.height,
  );
  const drawnWidth = sourceSize.width * scale;
  const drawnHeight = sourceSize.height * scale;
  const width = Math.max(1, stageWidth);
  const height = Math.max(1, stageHeight);
  return {
    sourceSize,
    leftPercent: ((width - drawnWidth) / 2 / width) * 100,
    topPercent:
      ((stageInsetTopPx + (boxHeight - drawnHeight) / 2) / height) * 100,
    widthPercent: (drawnWidth / width) * 100,
    heightPercent: (drawnHeight / height) * 100,
  };
}

export function sourceSizeOf(
  intrinsicSize: Size,
  sessionAttributes: any,
): Size {
  // On iOS and iPadOS a screenshot is recorded in device pixels while gestures
  // and layout nodes are recorded in points, so the screenshot is divided by
  // the screen density to bring all three into the same coordinates.
  const osName = String(sessionAttributes?.os_name ?? "").toLowerCase();
  if (osName !== "ios" && osName !== "ipados") {
    return intrinsicSize;
  }
  const density = Number(sessionAttributes?.device_density);
  if (!Number.isFinite(density) || density <= 0) {
    return intrinsicSize;
  }
  return {
    width: intrinsicSize.width / density,
    height: intrinsicSize.height / density,
  };
}

export function layerCountOf(root: LayoutElement): number {
  return Math.min(treeDepth(root) - 1, maxLayerDepth);
}

function treeDepth(node: LayoutElement): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(treeDepth));
}

const sdkAccent = /#fef08a/gi;

export const defaultReplayAccent = "oklch(79.2% 0.209 151.711)";

function accentedWireframe(markup: string, accent: string): string {
  return markup.replace(sdkAccent, accent);
}

const replayOutlineWidthProperty = "--msr-outline-width";

const treeOutlineDevicePx = 2.5;

// The browser rounds a border down to whole device pixels, and a one pixel
// border comes out broken and gappy once the tilt resamples it. Asking for the
// width in device pixels, with enough over two that the rounding still leaves
// two, keeps the outline solid at any tilt.
export function treeOutlineWidthPx(
  devicePixelRatio: number,
  containerScale: number,
): number {
  return Math.max(
    1,
    treeOutlineDevicePx / Math.max(0.01, devicePixelRatio * containerScale),
  );
}

// How much a document has been shrunk by whatever contains it. The marketing
// page runs the player inside an iframe that CSS scales down, and that scaling
// is visible on the iframe element rather than inside the document, so every
// frame up the chain is measured by its rendered width against its layout
// width.
export function containerScaleOf(view: Window): number {
  let scale = 1;
  try {
    let frame = view.frameElement as HTMLElement | null;
    while (frame && frame.offsetWidth > 0) {
      scale *= frame.getBoundingClientRect().width / frame.offsetWidth;
      frame = frame.ownerDocument.defaultView
        ?.frameElement as HTMLElement | null;
    }
  } catch {
    return scale;
  }
  return scale;
}

const layerGapRatio = 0.09;

const perspectiveRatio = 4.7;

const maxLayerDepth = 16;

const fullTiltDegrees = 40;

function tiltProgress(tilt: Tilt): number {
  return Math.min(
    1,
    Math.max(Math.abs(tilt.xDegrees), Math.abs(tilt.yDegrees)) /
      fullTiltDegrees,
  );
}

type ProjectedExtent = Size & {
  centreX: number;
  centreY: number;
};

export function projectedExtent(
  box: { width: number; height: number; depth: number },
  tilt: Tilt,
  perspective: number,
): ProjectedExtent {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const xRadians = toRadians(tilt.xDegrees);
  const yRadians = toRadians(tilt.yDegrees);
  const cosX = Math.cos(xRadians);
  const sinX = Math.sin(xRadians);
  const cosY = Math.cos(yRadians);
  const sinY = Math.sin(yRadians);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const x of [-box.width / 2, box.width / 2]) {
    for (const y of [-box.height / 2, box.height / 2]) {
      for (const z of [0, box.depth]) {
        const turnedX = x * cosY + z * sinY;
        const zAfterYTurn = -x * sinY + z * cosY;
        const turnedY = y * cosX - zAfterYTurn * sinX;
        const turnedZ = y * sinX + zAfterYTurn * cosX;

        const magnification =
          perspective / Math.max(perspective * 0.05, perspective - turnedZ);
        minX = Math.min(minX, turnedX * magnification);
        maxX = Math.max(maxX, turnedX * magnification);
        minY = Math.min(minY, turnedY * magnification);
        maxY = Math.max(maxY, turnedY * magnification);
      }
    }
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
  };
}

// ==========================================================================
// The stage
// ==========================================================================

export function ringPositionAt(
  touch: ReplayTouch,
  playheadOffsetMs: number,
): DevicePoint {
  const travelMs = Math.min(
    swipeTravelMs,
    touch.releaseOffsetMs - touch.pressOffsetMs,
  );
  const progress =
    travelMs <= 0
      ? 1
      : Math.min(1, (playheadOffsetMs - touch.pressOffsetMs) / travelMs);
  return {
    x: touch.from.x + (touch.to.x - touch.from.x) * progress,
    y: touch.from.y + (touch.to.y - touch.from.y) * progress,
  };
}

export function stagePointFrom(
  point: DevicePoint,
  fit: AttachmentFit,
): { xPercent: number; yPercent: number } {
  return {
    xPercent:
      fit.leftPercent + (point.x / fit.sourceSize.width) * fit.widthPercent,
    yPercent:
      fit.topPercent + (point.y / fit.sourceSize.height) * fit.heightPercent,
  };
}

export function ringOnStageAt(
  touch: ReplayTouch,
  playheadOffsetMs: number,
  fit: AttachmentFit,
): { xPercent: number; yPercent: number } {
  return stagePointFrom(ringPositionAt(touch, playheadOffsetMs), fit);
}

export function tiltScaleFor(
  layerCount: number | null,
  fit: AttachmentFit,
  tilt: Tilt,
): number {
  // Once the layers are tilted they paint outside the box the attachment was
  // fitted into, so the whole stack is scaled down far enough to stay on the
  // stage. Untilted layers need no scaling and the attachment draws full size.
  if (layerCount === null) {
    return 1;
  }
  // The lift between layers and the perspective they are drawn with are both a
  // share of the attachment's drawn width, so both are measured against the
  // width the attachment was given rather than against the whole stage.
  const bounds = projectedExtent(
    {
      width: fit.widthPercent,
      height: fit.heightPercent,
      depth: layerCount * layerGapRatio * fit.widthPercent * tiltProgress(tilt),
    },
    tilt,
    perspectiveRatio * fit.widthPercent,
  );
  const halfWidth = Math.abs(bounds.centreX) + bounds.width / 2;
  const halfHeight = Math.abs(bounds.centreY) + bounds.height / 2;
  return Math.min(1, 50 / Math.max(halfWidth, 1), 50 / Math.max(halfHeight, 1));
}

// Each node is lifted towards the viewer by its depth in the layout tree,
// multiplied by the --msr-depth CSS variable that the stage ramps from 0 to 1
// as the view is turned. At 0 every node is flat against the others, and the
// tree fans out into separate layers as an angle appears.
//
// The SDK records each node's box in device pixels, and the scale converts it
// to the pixels the stage draws it at. The nodes are laid out at their drawn
// size rather than drawn full size under a scale transform, because a scale
// transform above the perspective makes Chrome's compositor leave the flat
// layers painted after the tree unrasterised, and the controls and the event
// list go blank whenever the tree mounts or repaints.
function layoutNodeViews(
  root: LayoutElement,
  scale: number,
  liftPerDepth: number,
) {
  const nodes: React.ReactElement[] = [];
  const visit = (node: LayoutElement, depth: number, path: string) => {
    const lift = Math.min(depth, maxLayerDepth) * liftPerDepth;
    const isTarget = node.highlighted;
    const isText = !isTarget && node.type === "text";
    nodes.push(
      <div
        key={path}
        className={cn(
          "absolute box-border border-solid hover:border-primary",
          isTarget && "border-primary bg-primary/30",
          isText && "border-transparent bg-foreground/20",
          !isTarget && !isText && "border-foreground/50",
        )}
        data-label={node.label ? `${node.label} (${node.type})` : node.type}
        style={{
          left: node.x * scale,
          top: node.y * scale,
          width: node.width * scale,
          height: node.height * scale,
          borderWidth: isTarget
            ? `calc(var(${replayOutlineWidthProperty}, 1px) * 2)`
            : `var(${replayOutlineWidthProperty}, 1px)`,
          transform: `translateZ(calc(var(--msr-depth, 0) * ${lift}px))`,
        }}
      />,
    );
    (node.children ?? []).forEach((child, index) =>
      visit(child, depth + 1, `${path}.${index}`),
    );
  };
  visit(root, 0, "0");
  return nodes;
}

export const StageAttachment = memo(function StageAttachment({
  attachment,
  imageUrl,
  onImageError,
  hidden,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
}: {
  attachment: Attachment;
  imageUrl: string;
  onImageError?: () => void;
  hidden: boolean;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
}) {
  if (attachment.content.kind !== "layout") {
    const src =
      attachment.content.kind === "svg"
        ? `data:image/svg+xml;utf8,${encodeURIComponent(accentedWireframe(attachment.content.markup, accent))}`
        : imageUrl;
    return (
      <div className="absolute inset-0" hidden={hidden}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          onError={onImageError}
          className="absolute block object-contain"
          alt=""
          style={{
            left: `${fit.leftPercent}%`,
            top: `${fit.topPercent}%`,
            width: `${fit.widthPercent}%`,
            height: `${fit.heightPercent}%`,
          }}
        />
      </div>
    );
  }

  // The tree fills the box the attachment was fitted into, and the lift
  // between layers and the perspective are both a share of that box's width,
  // so the fanned-out tree looks the same whatever size the stage is.
  const drawnWidthPx = (stageWidthPx * fit.widthPercent) / 100;
  const scale = drawnWidthPx / fit.sourceSize.width;
  const liftPerDepth = drawnWidthPx * layerGapRatio;
  const perspective = drawnWidthPx * perspectiveRatio;
  return (
    <div className="absolute inset-0" hidden={hidden}>
      <div
        className="absolute"
        style={{
          left: `${fit.leftPercent}%`,
          top: `${fit.topPercent}%`,
          width: `${fit.widthPercent}%`,
          height: `${fit.heightPercent}%`,
          perspective: `${perspective}px`,
        }}
      >
        <div
          ref={tiltLayer}
          className="absolute inset-0 transform-3d origin-center transition-transform duration-300 ease-out"
        >
          {layoutNodeViews(attachment.content.root, scale, liftPerDepth)}
        </div>
      </div>
    </div>
  );
});

const StageFrame = memo(function StageFrame({
  group,
  sessionId,
  sessionAttributes,
  shownIndex,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
  onDrawFailed,
}: {
  group: AttachmentRefGroup;
  sessionId: string;
  sessionAttributes: any;
  shownIndex: number;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
  onDrawFailed: (attachmentRef: AttachmentRef) => void;
}) {
  return (
    <>
      {group.attachmentRefs.map((attachmentRef, index) => (
        // Every attachment the switcher offers stays mounted, hidden until it is
        // picked, so switching to one draws it at once.
        <StageAttachmentLoader
          key={attachmentRef.id}
          attachmentRef={attachmentRef}
          sessionId={sessionId}
          sessionAttributes={sessionAttributes}
          hidden={index !== shownIndex}
          accent={accent}
          fit={fit}
          stageWidthPx={stageWidthPx}
          tiltLayer={index === shownIndex ? tiltLayer : undefined}
          onDrawFailed={onDrawFailed}
        />
      ))}
    </>
  );
});

// Draws one attachment, and only once it has been fetched.
const StageAttachmentLoader = memo(function StageAttachmentLoader({
  attachmentRef,
  sessionId,
  sessionAttributes,
  hidden,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
  onDrawFailed,
}: {
  attachmentRef: AttachmentRef;
  sessionId: string;
  sessionAttributes: any;
  hidden: boolean;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
  onDrawFailed: (attachmentRef: AttachmentRef) => void;
}) {
  const { data: attachment } = useQuery(
    attachmentQueryOptions(sessionId, attachmentRef, sessionAttributes),
  );
  // A screenshot is measured once and drawn from its URL every time, so the
  // browser can drop the pixels and come back to a URL that has since expired.
  // The frame goes blank, which the viewer sees, and this is what says why.
  const onImageError = useCallback(() => {
    reportAttachmentFailure(
      attachmentRef,
      new Error(`drawing ${attachmentRef.url} failed`),
    );
    onDrawFailed(attachmentRef);
  }, [attachmentRef, onDrawFailed]);
  if (attachment === undefined) {
    return null;
  }
  return (
    <StageAttachment
      attachment={attachment}
      imageUrl={attachmentRef.url}
      onImageError={onImageError}
      hidden={hidden}
      accent={accent}
      fit={fit}
      stageWidthPx={stageWidthPx}
      tiltLayer={tiltLayer}
    />
  );
});

const TouchRing = memo(function TouchRing({
  actor,
  touch,
  fit,
  ringPercent,
  stageWidthPx,
}: {
  actor: SessionReplayActor;
  touch: ReplayTouch | null;
  fit: AttachmentFit | null;
  ringPercent: number;
  stageWidthPx: number;
}) {
  const ring = useSelector(
    actor,
    (snapshot) =>
      touch === null || fit === null
        ? null
        : ringOnStageAt(touch, snapshot.context.playheadOffsetMs, fit),
    (a, b) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.xPercent === b.xPercent &&
        a.yPercent === b.yPercent),
  );
  if (ring === null) {
    return null;
  }
  return (
    <div
      data-testid="session-replay-touch-ring"
      className="absolute box-border rounded-full border-solid border-primary pointer-events-none"
      style={{
        left: `${ring.xPercent}%`,
        top: `${ring.yPercent}%`,
        width: `${ringPercent}%`,
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        // A border-width given as a percentage is ignored by CSS, so the ring's
        // is worked out in pixels from the stage's measured width.
        borderWidth: `${Math.max(1, (stageWidthPx * ringPercent) / 100 / 12)}px`,
      }}
    />
  );
});

// ==========================================================================
// Event rows and details
// ==========================================================================

export function formatOffset(ms: number): string {
  const rounded = Math.round(ms);
  const minutes = Math.floor(rounded / 60000);
  const seconds = Math.floor((rounded % 60000) / 1000);
  const millis = rounded % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

const logSeverities = ["debug", "info", "warning", "error", "fatal"];

function logSeverity(eventDetails: any): string {
  const raw = eventDetails.severity_text;
  const normalized = typeof raw === "string" ? raw.toLowerCase() : "";
  return logSeverities.includes(normalized) ? normalized : "";
}

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
  network_change: PillType.SessionEventNetworkChange,
  screen_view: PillType.SessionEventScreenView,
  cold_launch: PillType.SessionEventColdLaunch,
  warm_launch: PillType.SessionEventWarmLaunch,
  hot_launch: PillType.SessionEventHotLaunch,
  low_memory: PillType.SessionEventLowMemory,
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

function sessionEventTitle(eventType: string, eventDetails: any): string {
  if (eventType === "error" || eventType === "anr") {
    return titleFrom([eventDetails?.type, eventDetails?.message], ": ");
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
    return String(eventDetails?.reason ?? "");
  }
  return "";
}

const eventTint: Record<string, string> = {
  error: "bg-red-500",
  anr: "bg-red-500",
  bug_report: "bg-red-500",
  gesture_click: "bg-emerald-500",
  gesture_long_click: "bg-emerald-500",
  gesture_scroll: "bg-emerald-500",
  http: "bg-cyan-500",
  navigation: "bg-fuchsia-500",
  screen_view: "bg-fuchsia-500",
  trace: "bg-pink-500",
  custom: "bg-purple-500",
  profile: "bg-teal-500",
};

const logTint: Record<string, string> = {
  debug: "bg-teal-500",
  info: "bg-indigo-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  fatal: "bg-red-500",
};

function tintForEvent(event: ReplayEvent): string {
  if (event.eventType === "log" || event.eventType === "string") {
    return logTint[logSeverity(event.details)] ?? "bg-indigo-500";
  }
  return eventTint[event.eventType] ?? "bg-indigo-500";
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
        )}`,
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
              {attachment.type === "perfetto_trace" &&
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

const ReplayEventRow = memo(function ReplayEventRow({
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
            className={cn("size-1.5 rounded-full shrink-0", row.tintClass)}
          />
          <span className="text-[11px] font-code text-muted-foreground tabular-nums shrink-0 w-[8ch]">
            {row.atOffsetLabel}
          </span>
          {/* A fixed width most event names fit inside, with longer ones
              truncated. The Pill component supplies its own text, so
              truncating it needs the block display set here. */}
          <Pill
            type={row.pillType}
            className="shrink-0 w-20 text-[10px] px-1 py-0 block truncate text-center"
          >
            {row.pillText}
          </Pill>
          {/* A fixed width that fits "main" and the numbered threads, with
              longer names truncated. An event with no thread name keeps an
              empty span of the same width so the titles beside it stay in a
              column. */}
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

// ==========================================================================
// Metric lanes
// ==========================================================================

const laneHeight = 34;

const plotWidth = 1000;
const plotHeight = 100;

type Series = { label: string; color: string; values: number[] };

type MetricStrip = {
  key: string;
  title: string;
  unit: string;
  max: number;
  times: { absMs: number; iso: string }[];
  series: Series[];
};

function roundUpToNiceMemoryValue(memory: number): number {
  if (memory < 1000) {
    return Math.ceil(memory / 100) * 100;
  }
  if (memory < 1_000_000) {
    return Math.ceil(memory / 1000) * 1000;
  }
  if (memory < 1_000_000_000) {
    return Math.ceil(memory / 1_000_000) * 1_000_000;
  }
  return Math.ceil(memory / 1_000_000_000) * 1_000_000_000;
}

type StripSpec = {
  key: string;
  title: string;
  unit: string;
  samples: any[] | null;
  read: (sample: any) => { label: string; color: string; value: number }[];
  max?: number;
};

function buildStrip(
  spec: StripSpec,
  startAbsMs: number,
  endAbsMs: number,
): MetricStrip | null {
  if (!Array.isArray(spec.samples) || spec.samples.length === 0) {
    return null;
  }

  const times: MetricStrip["times"] = [];
  const columns: number[][] = [];
  let labels: { label: string; color: string }[] = [];
  let peak = 0;

  spec.samples.forEach((sample) => {
    const absMs = DateTime.fromISO(sample.timestamp, {
      zone: "utc",
    }).toMillis();
    if (!Number.isFinite(absMs) || absMs < startAbsMs || absMs > endAbsMs) {
      return;
    }
    const readings = spec.read(sample);
    if (labels.length === 0) {
      labels = readings.map(({ label, color }) => ({ label, color }));
    }
    times.push({ absMs, iso: sample.timestamp });
    columns.push(readings.map((reading) => reading.value));
    readings.forEach((reading) => {
      peak = Math.max(peak, reading.value);
    });
  });

  if (times.length === 0) {
    return null;
  }

  const last = times[times.length - 1];
  if (last.absMs < endAbsMs) {
    times.push({
      absMs: endAbsMs,
      iso: DateTime.fromMillis(endAbsMs, { zone: "utc" }).toISO() ?? last.iso,
    });
    columns.push(columns[columns.length - 1]);
  }

  return {
    key: spec.key,
    title: spec.title,
    unit: spec.unit,
    max: spec.max ?? Math.max(1, roundUpToNiceMemoryValue(peak)),
    times,
    series: labels.map((label, index) => ({
      ...label,
      values: columns.map((column) => column[index]),
    })),
  };
}

function useSessionMetricStrips(
  session: any,
  startAbsMs: number,
  endAbsMs: number,
): MetricStrip[] {
  const chartColor = useChartColor();
  const chartColors = useChartColors();

  return useMemo(() => {
    const megabytes =
      (fields: [label: string, color: string, field: string][]) =>
      (sample: any) =>
        fields.map(([label, color, field]) => ({
          label,
          color,
          value: kilobytesToMegabytes(sample[field]),
        }));

    const specs: StripSpec[] = [
      {
        key: "cpu",
        title: "CPU",
        unit: "%",
        samples: session.cpu_usage,
        read: (sample) => [
          { label: "Cpu Usage", color: chartColors[0], value: sample.value },
        ],
        max: 100,
      },
      {
        key: "memory",
        title: "Memory",
        unit: "MB",
        samples: session.memory_usage,
        read: megabytes([
          ["Java Free Heap", chartColor.violet, "java_free_heap"],
          ["Java Max Heap", chartColor.red, "java_max_heap"],
          ["Java Total Heap", chartColor.yellow, "java_total_heap"],
          ["Native Free Heap", chartColor.amber, "native_free_heap"],
          ["Native Total Heap", chartColor.teal, "native_total_heap"],
          ["RSS", chartColor.green, "rss"],
          ["Total PSS", chartColor.pink, "total_pss"],
        ]),
      },
      {
        key: "memory-absolute",
        title: "Memory",
        unit: "MB",
        samples: session.memory_usage_absolute,
        read: megabytes([
          ["Max Memory", chartColor.violet, "max_memory"],
          ["Used Memory", chartColor.red, "used_memory"],
        ]),
      },
    ];
    return specs
      .map((spec) => buildStrip(spec, startAbsMs, endAbsMs))
      .filter((strip): strip is MetricStrip => strip !== null);
  }, [session, startAbsMs, endAbsMs, chartColor, chartColors]);
}

function MetricsPlayheadLine({
  actor,
  startAbsMs,
  xFor,
}: {
  actor: SessionReplayActor;
  startAbsMs: number;
  xFor: (absMs: number) => number;
}) {
  const x = useSelector(actor, (snapshot) =>
    xFor(startAbsMs + snapshot.context.playheadOffsetMs),
  );
  return (
    <line
      x1={x}
      x2={x}
      y1={0}
      y2={plotHeight}
      stroke="currentColor"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      className="text-foreground"
    />
  );
}

const SessionReplayMetrics = memo(function SessionReplayMetrics({
  strips,
  startAbsMs,
  durationMs,
  actor,
  onSeek,
}: {
  strips: MetricStrip[];
  startAbsMs: number;
  durationMs: number;
  actor: SessionReplayActor;
  onSeek: (offsetMs: number) => void;
}) {
  const [hover, setHover] = useState<{
    key: string;
    index: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const xFor = useCallback(
    (absMs: number) => ((absMs - startAbsMs) / durationMs) * plotWidth,
    [startAbsMs, durationMs],
  );

  const seriesLines = useMemo(
    () =>
      new Map(
        strips.map((strip) => [
          strip.key,
          strip.series.map((series) => (
            <polyline
              key={series.label}
              fill="none"
              stroke={series.color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              points={series.values
                .map(
                  (value, index) =>
                    `${xFor(strip.times[index].absMs)},${plotHeight - (Math.min(value, strip.max) / strip.max) * plotHeight}`,
                )
                .join(" ")}
            />
          )),
        ]),
      ),
    [strips, xFor],
  );

  if (strips.length === 0) {
    return null;
  }

  const nearestTo = (strip: MetricStrip, fraction: number) => {
    const wanted = startAbsMs + fraction * durationMs;
    let nearest = 0;
    for (let index = 1; index < strip.times.length; index++) {
      if (
        Math.abs(strip.times[index].absMs - wanted) <
        Math.abs(strip.times[nearest].absMs - wanted)
      ) {
        nearest = index;
      }
    }
    return nearest;
  };

  const fractionFrom = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
  };

  return (
    <div className="flex flex-col gap-1 select-none">
      {strips.map((strip) => {
        const hovered =
          hover !== null && hover.key === strip.key ? hover : null;
        return (
          <div
            key={strip.key}
            role="img"
            aria-label={`${strip.title} usage`}
            className="relative rounded-md border border-border cursor-pointer touch-none"
            style={{ height: laneHeight }}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(event) =>
              setHover({
                key: strip.key,
                index: nearestTo(strip, fractionFrom(event)),
                clientX: event.clientX,
                clientY: event.clientY,
              })
            }
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              onSeek(fractionFrom(event) * durationMs);
            }}
          >
            <svg
              viewBox={`0 0 ${plotWidth} ${plotHeight}`}
              preserveAspectRatio="none"
              className="block w-full h-full"
            >
              {seriesLines.get(strip.key)}
              {hovered !== null && (
                <line
                  x1={xFor(strip.times[hovered.index].absMs)}
                  x2={xFor(strip.times[hovered.index].absMs)}
                  y1={0}
                  y2={plotHeight}
                  stroke="currentColor"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className="text-foreground/40"
                />
              )}
              <MetricsPlayheadLine
                actor={actor}
                startAbsMs={startAbsMs}
                xFor={xFor}
              />
            </svg>

            <p className="absolute top-0.5 left-1.5 text-[10px] leading-none text-muted-foreground pointer-events-none">
              {strip.title}
            </p>

            {hovered !== null && (
              <div
                className="fixed z-50 pointer-events-none"
                style={{
                  left: hovered.clientX,
                  top: hovered.clientY,
                  translate: "-50% -100%",
                }}
              >
                <PlotTooltipShell className="py-2 mb-3">
                  <p>
                    Time:{" "}
                    {formatChartFormatTimestampToHumanReadable(
                      formatTimestampToChartFormat(
                        strip.times[hovered.index].iso,
                      ),
                    )}
                  </p>
                  {strip.series.map((series) => (
                    <div
                      key={series.label}
                      className="flex flex-row items-center gap-2 mt-2"
                    >
                      <PlotTooltipSwatch color={series.color} />
                      <p>
                        {series.label}:{" "}
                        {series.values[hovered.index].toFixed(2)}
                        {strip.unit === "%" ? "%" : ` ${strip.unit}`}
                      </p>
                    </div>
                  ))}
                </PlotTooltipShell>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ==========================================================================
// The stage chrome
// ==========================================================================

export function formatSkipped(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

const speeds = [0.5, 1, 2, 4];

const stageHeight = 600;

const minimumPlayerHeight = 420;

const viewportBottomGap = 8;

const touchRingRatio = 0.13;

// The bands the stage's overlays are drawn in. The attachment is fitted below
// the switcher and the notice and above the turn hint, so it clears all three.
const stageInsetTopPx = 64;

const stageInsetBottomPx = 40;

const stageInsetXPx = 28;

const hoverLabelRoom = 220;

function readAccent(): string {
  if (typeof window === "undefined") {
    return defaultReplayAccent;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  return value || defaultReplayAccent;
}

const SessionAttributePills = memo(function SessionAttributePills({
  session,
}: {
  session: any;
}) {
  const attribute = session.attribute;
  return (
    <div className="flex flex-wrap gap-2 py-2 pb-4 items-center">
      <Pill
        tooltip
      >{`User ID: ${attribute.user_id !== "" ? attribute.user_id : "N/A"}`}</Pill>
      <Pill
        tooltip
      >{`Duration: ${formatMillisToHumanReadable(session.duration as unknown as number)}`}</Pill>
      <Pill
        tooltip
      >{`Device: ${attribute.device_manufacturer + attribute.device_model}`}</Pill>
      <Pill
        tooltip
      >{`App version: ${attribute.app_version} (${attribute.app_build})`}</Pill>
      <Pill tooltip>{`Network type: ${attribute.network_type}`}</Pill>
    </div>
  );
});

const ReplayTimeLabel = memo(function ReplayTimeLabel({
  actor,
  durationMs,
}: {
  actor: SessionReplayActor;
  durationMs: number;
}) {
  const playheadOffsetMs = useSelector(
    actor,
    (snapshot) => snapshot.context.playheadOffsetMs,
  );
  return (
    <span className="text-[11px] font-code text-muted-foreground tabular-nums whitespace-nowrap">
      {formatOffset(playheadOffsetMs)} / {formatOffset(durationMs)}
    </span>
  );
});

const ReplayScrubber = memo(function ReplayScrubber({
  actor,
  durationMs,
  markers,
  scrubRef,
  seekFromPointer,
  dragSeekFromPointer,
  seekFromKey,
}: {
  actor: SessionReplayActor;
  durationMs: number;
  markers: React.ReactNode;
  scrubRef: React.RefObject<HTMLDivElement | null>;
  seekFromPointer: (clientX: number) => void;
  dragSeekFromPointer: (clientX: number) => void;
  seekFromKey: (event: React.KeyboardEvent) => void;
}) {
  const playheadOffsetMs = useSelector(
    actor,
    (snapshot) => snapshot.context.playheadOffsetMs,
  );
  const progress = Math.max(
    0,
    Math.min(1, playheadOffsetMs / Math.max(1, durationMs)),
  );
  return (
    <div
      ref={scrubRef}
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs)}
      aria-valuenow={Math.round(playheadOffsetMs)}
      aria-valuetext={`${formatOffset(playheadOffsetMs)} of ${formatOffset(durationMs)}`}
      className="relative h-8 cursor-pointer touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onPointerDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          dragSeekFromPointer(e.clientX);
        }
      }}
      onKeyDown={seekFromKey}
    >
      {markers}
      <div className="absolute inset-x-0 bottom-2 h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div
        className="absolute bottom-0 w-0.5 h-6 bg-foreground rounded-full pointer-events-none"
        style={{ left: `${progress * 100}%` }}
      />
    </div>
  );
});

// ==========================================================================
// The demo session
// ==========================================================================

const demoLastEventTime = DateTime.now().toUTC();
export const demoSession = {
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  attribute: {
    installation_id: "1fefa265-9e6b-45d8-aa83-23b03070c06e",
    app_version: "2.0.0",
    app_build: "200",
    app_unique_id: "sh.measure.demo",
    measure_sdk_version: "1.0.0",
    platform: "android",
    thread_name: "msr-default",
    user_id: "demo-user-id",
    device_name: "sunfish",
    device_model: "Pixel 7 Pro",
    device_manufacturer: "Google",
    device_type: "phone",
    device_is_foldable: false,
    device_is_physical: true,
    device_density_dpi: 440,
    device_width_px: 1080,
    device_height_px: 2138,
    device_density: 2.75,
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
  cpu_usage: [
    {
      timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
      value: 5,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
      value: 15.625,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
      value: 12.314,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
      value: 35.742,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
      value: 38.923,
    },
  ],
  duration: 13000,
  memory_usage: [
    {
      java_max_heap: 262144,
      java_total_heap: 262144,
      java_free_heap: 259685,
      total_pss: 10846,
      rss: 105040,
      native_total_heap: 12612,
      native_free_heap: 1170,
      interval: 0,
      timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58687,
      total_pss: 57496,
      rss: 135104,
      native_total_heap: 17752,
      native_free_heap: 1259,
      interval: 2056,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58391,
      total_pss: 57572,
      rss: 135240,
      native_total_heap: 17752,
      native_free_heap: 1229,
      interval: 2043,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57931,
      total_pss: 59015,
      rss: 136396,
      native_total_heap: 18520,
      native_free_heap: 1314,
      interval: 2055,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57162,
      total_pss: 59904,
      rss: 137996,
      native_total_heap: 19544,
      native_free_heap: 1307,
      interval: 2032,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
    },
  ],
  memory_usage_absolute: null,
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  threads: {
    main: [
      {
        event_type: "cold_launch",
        user_defined_attribute: null,
        thread_name: "main",
        duration: 785,
        timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
        attachments: [
          {
            id: "6c566550-19be-43e8-978f-affb560f9bb6",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_splash",
            location: "/snapshots/demo_snapshot_splash.json",
          },
        ],
      },
      {
        event_type: "lifecycle_app",
        user_defined_attribute: null,
        thread_name: "main",
        type: "foreground",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 43 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.MainActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 91 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Home",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 120 })
          .toISO(),
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "debug",
        string: "Rendered product grid (24 items)",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 960 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.card.MaterialCardView",
        target_id: "card_product_1",
        label: "Runner Sneakers",
        semantic_label: "Runner Sneakers",
        width: 125,
        height: 200,
        x: 102,
        y: 428,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1600 })
          .toISO(),
        attachments: [
          {
            id: "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_home_click",
            location: "/snapshots/demo_snapshot_home_click.json",
          },
        ],
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.MainActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1740 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.ProductDetailActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1755 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "ProductDetail",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1780 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_size_l",
        label: "Size L",
        semantic_label: "Size L",
        width: 52,
        height: 48,
        x: 170,
        y: 530,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 2700 })
          .toISO(),
        attachments: [
          {
            id: "3c9a1f47-52d0-4a8b-9f61-2d7e4c05b8a3",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_size_click",
            location: "/snapshots/demo_snapshot_size_click.json",
          },
        ],
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_add_to_cart",
        label: "Add to cart",
        semantic_label: "Add to cart",
        width: 125,
        height: 200,
        x: 196,
        y: 716,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3400 })
          .toISO(),
        attachments: [
          {
            id: "2b7c9e14-5a83-4d61-8f0c-9e3a1d47b25f",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_add_to_cart_click",
            location: "/snapshots/demo_snapshot_add_to_cart_click.json",
          },
        ],
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "info",
        string: "Added runner-sneakers to cart (qty 1)",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3450 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.ProductDetailActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4700 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.CartActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4715 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Cart",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4740 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_checkout",
        label: "Proceed to checkout",
        semantic_label: "Proceed to checkout",
        width: 125,
        height: 200,
        x: 196,
        y: 760,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5600 })
          .toISO(),
        attachments: [
          {
            id: "7d41a0c6-3e92-4b58-a17d-6c05f8e29431",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_cart_click",
            location: "/snapshots/demo_snapshot_cart_click.json",
          },
        ],
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.CartActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5740 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.CheckoutActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5755 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Checkout",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5780 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_discount_1",
        label: "Apply discount",
        semantic_label: "Apply discount",
        width: 125,
        height: 200,
        x: 70,
        y: 252,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6000 })
          .toISO(),
        attachments: [
          {
            id: "9e206b3f-8c47-4a15-b0d9-42f7e5c81a6d",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_discount_click",
            location: "/snapshots/demo_snapshot_discount_click.json",
          },
        ],
      },
      {
        event_type: "custom",
        user_defined_attribute: { reward: "$0 off" },
        thread_name: "main",
        user_triggered: true,
        name: "Reward Applied",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6400 })
          .toISO(),
      },
      {
        event_type: "trim_memory",
        user_defined_attribute: null,
        thread_name: "main",
        level: "TRIM_MEMORY_RUNNING_LOW",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 7800 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Payment",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 8940 })
          .toISO(),
      },
      {
        event_type: "custom",
        user_defined_attribute: {
          payment_methods:
            '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        },
        thread_name: "main",
        user_triggered: true,
        name: "Payment Methods Fetched",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9400 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_pay",
        label: "Pay now",
        semantic_label: "Pay now",
        width: 125,
        height: 200,
        x: 196,
        y: 760,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9600 })
          .toISO(),
        attachments: [
          {
            id: "4f8d3125-6b07-49ea-9c73-1a5e0b28df94",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_pay_click",
            location: "/snapshots/demo_snapshot_pay_click.json",
          },
        ],
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "warning",
        string: "Payment validation failed: no payment method selected",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9850 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_payment_type",
        label: "Payment method",
        semantic_label: "Payment method",
        width: 360,
        height: 68,
        x: 196,
        y: 122,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 11200 })
          .toISO(),
        attachments: [
          {
            id: "8d5b0e93-7c14-4f26-a3d8-61b9f0472ce5",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_payment_type_click",
            location: "/snapshots/demo_snapshot_payment_type_click.json",
          },
        ],
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_pay",
        label: "Pay now",
        semantic_label: "Pay now",
        width: 645,
        height: 70,
        x: 359,
        y: 1259,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 13000 })
          .toISO(),
        attachments: [
          {
            id: "6f3d1c2a-4b6e-4c1d-9a2f-0e5b7c8d9a1b",
            name: "screenshot.webp",
            type: "screenshot",
            key: "demo_checkout_screenshot",
            location: "/images/demo_checkout_screenshot.webp",
          },
        ],
      },
      {
        event_type: "error",
        severity: "fatal",
        user_defined_attribute: null,
        user_triggered: false,
        group_id: "9b71282275e88a68b38fe69a1bda0ea7",
        type: "java.lang.IllegalStateException",
        message: "Payment method must be specified",
        method_name: "onClick",
        file_name: "CheckoutActivity.kt",
        line_number: 102,
        thread_name: "main",
        handled: false,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 13 })
          .toISO(),
        stacktrace:
          "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)\n\tat android.view.View.performClick(View.java:6294)\n\tat android.view.View$PerformClick.run(View.java:24774)\n\tat android.os.Handler.handleCallback(Handler.java:790)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loop(Looper.java:164)\n\tat android.app.ActivityThread.main(ActivityThread.java:6518)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.IllegalStateException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:448)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)",
      },
    ],
    okhttp: [
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/products",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 412,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 700 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/products/runner-sneakers",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 238,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1900 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/cart",
        method: "POST",
        status_code: 201,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 187,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3520 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/cart",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 205,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4750 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/rewards",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 557,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5798 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/inventory/check",
        method: "POST",
        status_code: 503,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 185,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6398 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/discounts/apply",
        method: "POST",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 176,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6350 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://payments.demo-provider.com/demo-user-id/payment-methods",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body:
          '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 742,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9100 })
          .toISO(),
      },
    ],
  },
  traces: [
    {
      trace_id: "14f94d4e346a4bb36cf7eb06dae727ff",
      trace_name: "MainActivity Time to Full Display",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 43 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 1230 })
        .toISO(),
      duration: 1187,
    },
    {
      trace_id: "a3c7db90d18966d5c40a4a464b63ca69",
      trace_name: "checkout_full_display",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 5755 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6985 })
        .toISO(),
      duration: 1230,
    },
    {
      trace_id: "2c9ce6a1b0d94f2e8a6d0c3b5e7f9a1c",
      trace_name: "cart.sync",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 4750 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 5060 })
        .toISO(),
      duration: 310,
    },
    {
      trace_id: "8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d",
      trace_name: "checkout.apply_reward",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6350 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6526 })
        .toISO(),
      duration: 176,
    },
  ],
} as any;

// ==========================================================================
// The component
// ==========================================================================

const emptyReplayEvents: ReplayEvent[] = [];

const emptyAttachmentRefs: AttachmentRef[] = [];

const emptyReplayRows: ReplayRow[] = [];

type SessionReplayProps = {
  teamId?: string;
  appId?: string;
  session?: any;
  demo?: boolean;
  hideDemoTitle?: boolean;
};

// Keeps the query cache stocked with the attachments around the playhead. The
// window is worked out again each time the playhead crosses a stride of
// attachments, and each run stops fetching when the next one takes over.
function useAttachmentWindow(
  actor: SessionReplayActor,
  sessionId: string,
  replay: Replay | null,
  sessionAttributes: any,
) {
  const client = useQueryClient();
  const attachmentRefs = replay?.attachmentRefs ?? emptyAttachmentRefs;
  // The playhead's attachment index, rounded down to a stride, so this changes
  // once per stride of attachments crossed rather than on every clock tick.
  const windowCenterIndex = useSelector(
    actor,
    (snapshot) =>
      Math.floor(
        attachmentRefIndexAt(
          attachmentRefs,
          snapshot.context.playheadOffsetMs,
        ) / attachmentWindowStride,
      ) * attachmentWindowStride,
  );
  // A refetched session carries newly signed URLs, which is what an attachment
  // rejected with a 403 needs, so its query is dropped and the window below
  // fetches it again.
  useEffect(() => {
    client.removeQueries({
      predicate: (query: Query) =>
        query.queryKey[0] === "session-attachment" &&
        query.queryKey[1] === sessionId &&
        query.state.status === "error",
    });
  }, [client, sessionId, attachmentRefs]);

  useEffect(() => {
    if (attachmentRefs.length === 0) {
      return;
    }
    let moved = false;
    reconcileAttachmentWindow(
      client,
      sessionId,
      attachmentRefs,
      sessionAttributes,
      windowCenterIndex,
      () => moved,
    );
    // The next window takes over the fetching and keeps whatever is in flight
    // that it still covers, so this stops the loop and leaves the cache alone.
    return () => {
      moved = true;
    };
  }, [client, sessionId, attachmentRefs, sessionAttributes, windowCenterIndex]);

  // Leaving the replay cancels the downloads it started and drops what they
  // brought in, so the window's attachments are released on the way out instead
  // of waiting for the query cache to drop them.
  useEffect(() => {
    return () => {
      const queryKey = ["session-attachment", sessionId];
      client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    };
  }, [client, sessionId]);
}

export default function SessionReplay({
  teamId = "demo-team",
  appId = "demo-app",
  session = demoSession,
  demo = false,
  hideDemoTitle = false,
}: SessionReplayProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const actor = useActorRef(sessionReplayMachine);
  const send = actor.send;
  const sessionId = String((session as any)?.session_id ?? "");
  const sessionAttributes = (session as any)?.attribute;

  useEffect(() => {
    actor.send({ type: "replay.received", session });
  }, [actor, session]);
  // This component re-renders whenever a value selected from the machine below
  // changes. The playhead is deliberately not one of them: the time label, the
  // scrubber's fill, the touch ring and the metric charts each select it
  // themselves, so a clock tick sixty times a second redraws only those four
  // and not the whole player.
  const playing = useSelector(actor, (snapshot) =>
    snapshot.matches({ ready: { playback: "playing" } }),
  );
  const dragging = useSelector(actor, (snapshot) =>
    snapshot.matches({ ready: { inspection: "dragging" } }),
  );
  const noticeVisible = useSelector(actor, (snapshot) =>
    snapshot.matches({ ready: { notice: "visible" } }),
  );
  const replay = useSelector(actor, (snapshot) => snapshot.context.replay);
  const switcher = useSelector(
    actor,
    (snapshot) => snapshot.context.attachmentSwitcher,
  );
  const tilt = useSelector(actor, (snapshot) => snapshot.context.tilt);
  const hoverLabel = useSelector(
    actor,
    (snapshot) => snapshot.context.hoverLabel,
  );
  const playbackSpeed = useSelector(
    actor,
    (snapshot) => snapshot.context.playbackSpeed,
  );
  const idleSkipEnabled = useSelector(
    actor,
    (snapshot) => snapshot.context.idleSkipEnabled,
  );
  const skippedIdleMs = useSelector(
    actor,
    (snapshot) => snapshot.context.skippedIdleMs,
  );
  const sliceIndex = useSelector(
    actor,
    (snapshot) => snapshot.context.sliceIndex,
  );

  const events = replay?.events ?? emptyReplayEvents;
  const replayRows = replay?.rows ?? emptyReplayRows;
  const durationMs = replay?.durationMs ?? 0;
  const startAbsMs = replay?.startAbsMs ?? 0;
  const slice = replay?.slices[sliceIndex] ?? null;
  const metricStrips = useSessionMetricStrips(
    session,
    startAbsMs,
    startAbsMs + durationMs,
  );

  const attachmentCount = replay?.attachmentRefs.length ?? 0;
  const accent = useMemo(() => readAccent(), []);
  useAttachmentWindow(actor, sessionId, replay, sessionAttributes);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [viewportRoom, setViewportRoom] = useState(0);
  const [pagePadBelow, setPagePadBelow] = useState(0);
  const [sideBySide, setSideBySide] = useState(false);
  useEffect(() => {
    const measure = () => {
      const node = rootRef.current!;
      let padding = 0;
      for (
        let ancestor = node.parentElement, hops = 0;
        ancestor && hops < 4;
        ancestor = ancestor.parentElement, hops++
      ) {
        const value = parseFloat(getComputedStyle(ancestor).paddingBottom) || 0;
        if (value > 0) {
          padding = value;
          break;
        }
      }
      setPagePadBelow(padding);
      setViewportRoom(
        window.innerHeight -
          node.getBoundingClientRect().top -
          viewportBottomGap,
      );
      setSideBySide(
        window.matchMedia?.("(min-width: 64rem)").matches ??
          window.innerWidth >= 1024,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const fitsViewport =
    !demo && sideBySide && viewportRoom >= minimumPlayerHeight;

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const currentAttachmentRefGroup = useMemo(() => {
    if (slice === null || replay === null) {
      return null;
    }
    const groupIndex =
      replay.shownAttachmentRefGroupIndexByEventIndex[slice.eventIndex];
    return groupIndex === undefined
      ? null
      : replay.attachmentRefGroups[groupIndex];
  }, [replay, slice]);

  const shownIndex = currentAttachmentRefGroup
    ? Math.min(
        switcher.eventKey === currentAttachmentRefGroup.key
          ? switcher.shownIndex
          : 0,
        currentAttachmentRefGroup.attachmentRefs.length - 1,
      )
    : 0;
  const currentTouch =
    slice?.touchIndex != null ? replay!.touches[slice.touchIndex] : null;
  const shownAttachmentRef =
    currentAttachmentRefGroup?.attachmentRefs[shownIndex] ?? null;
  const {
    data: shownAttachment = null,
    status: shownAttachmentStatus,
    error: shownAttachmentError,
  } = useQuery(
    attachmentQueryOptions(sessionId, shownAttachmentRef, sessionAttributes),
  );
  const inspecting = shownAttachment?.layerCount != null;

  // An attachment can be fetched successfully and still fail to draw, because
  // the browser drops the decoded pixels and comes back to a URL that has
  // expired since. The fetch succeeded, so nothing about it says the viewer is
  // looking at a blank stage, and this is where that is remembered.
  //
  // Every attachment an event carries stays mounted so the switcher can show it
  // at once, and a hidden one is fetched and can fail like any other. Each
  // failed URL is therefore kept, rather than only the last: with one slot a
  // hidden attachment failing after the shown one would clear the message and
  // leave a blank stage saying nothing. URLs are the identity and not
  // attachment ids because a refetched session signs a fresh URL for the same
  // attachment, and that fresh URL is worth trying to draw.
  const [drawFailedUrls, setDrawFailedUrls] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const onDrawFailed = useCallback(
    (attachmentRef: AttachmentRef) =>
      setDrawFailedUrls((failed) =>
        failed.has(attachmentRef.url)
          ? failed
          : new Set(failed).add(attachmentRef.url),
      ),
    [],
  );

  const tiltLayerRef = useRef<HTMLDivElement | null>(null);
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  // Everything drawn on the stage is positioned from this fit, and the tilt
  // effect further down depends on it, so it is memoised and stays the same
  // object while the size behind it does. Building a new one on every render
  // would redraw the whole layout tree sixty times a second during playback.
  const shownSourceSize = shownAttachment?.sourceSize ?? null;
  const shownFit = useMemo(
    () =>
      shownSourceSize === null
        ? null
        : fitInto(shownSourceSize, stageBox.width, stageBox.height),
    [shownSourceSize, stageBox.width, stageBox.height],
  );
  const ringPercent = shownFit ? shownFit.widthPercent * touchRingRatio : 0;
  const fitStage = useCallback(() => {
    const stage = stageRef.current!;
    // The stage is sized by the layout around it rather than by anything here,
    // so its measured width and height are read back into state for the shown
    // attachment to be fitted into.
    setStageBox((box) =>
      box.width === stage.clientWidth && box.height === stage.clientHeight
        ? box
        : { width: stage.clientWidth, height: stage.clientHeight },
    );
    const view = stage.ownerDocument.defaultView ?? window;
    stage.style.setProperty(
      replayOutlineWidthProperty,
      `${treeOutlineWidthPx(view.devicePixelRatio, containerScaleOf(view))}px`,
    );
  }, [stageRef]);

  const applyTiltDom = useCallback(() => {
    const layer = tiltLayerRef.current;
    if (!layer) {
      return;
    }
    const scale = tiltScaleFor(
      shownAttachment?.layerCount ?? null,
      shownFit ?? fitInto({ width: 1, height: 1 }, 1, 1),
      tilt,
    );
    layer.style.transition = dragging ? "none" : "transform 300ms ease-out";
    layer.style.transform = `scale(${scale}) rotateX(${tilt.xDegrees}deg) rotateY(${tilt.yDegrees}deg)`;
    layer.style.setProperty("--msr-depth", String(tiltProgress(tilt)));
  }, [dragging, tilt, shownAttachment, shownFit]);

  // The one place playback time advances. Real time elapsed since the last
  // frame, scaled by the playback speed, is sent to the machine as a tick, and
  // the machine holds the resulting position. Everything on the stage is then
  // worked out from that one position, which is what makes seeking nothing more
  // than setting it. A hidden tab or a blocked main thread stops the frames
  // while real time carries on, so each step is capped and a replay left in a
  // background tab resumes near where it stopped rather than jumping forward by
  // the whole gap.
  useEffect(() => {
    if (!playing) {
      return;
    }
    let lastTickAt = performance.now();
    let frameId = 0;
    const loop = () => {
      const now = performance.now();
      const { playheadOffsetMs, playbackSpeed, replay } =
        actor.getSnapshot().context;
      send({
        type: "clock.tick",
        clockOffsetMs: tickOffsetMs(
          playheadOffsetMs,
          now - lastTickAt,
          playbackSpeed,
          replay?.durationMs ?? 0,
        ),
      });
      lastTickAt = now;
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [playing, actor, send]);

  useEffect(() => {
    fitStage();
    applyTiltDom();
  }, [switcher, currentAttachmentRefGroup, fitStage, applyTiltDom]);

  const fitStageLatest = useRef(fitStage);
  useEffect(() => {
    fitStageLatest.current = fitStage;
  }, [fitStage]);

  useEffect(() => {
    const observer = new ResizeObserver(() => fitStageLatest.current());
    observer.observe(stageRef.current!);
    return () => observer.disconnect();
  }, [stageRef]);

  const seek = useCallback(
    (toOffsetMs: number) => {
      send({ type: "user.seek", toOffsetMs });
    },
    [send],
  );

  const activeIndex = slice?.eventIndex ?? -1;

  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const list = listRef.current;
    const row = rowRefs.current[activeIndex];
    if (activeIndex < 0 || !list || !row) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < listRect.top) {
      list.scrollTo({
        top: list.scrollTop + rowRect.top - listRect.top,
        behavior: "smooth",
      });
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTo({
        top: list.scrollTop + rowRect.bottom - listRect.bottom,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  const registerRow = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      rowRefs.current[index] = el;
    },
    [],
  );

  const selectRow = useCallback(
    (index: number, key: string) => {
      seek(events[index].timeAbsMs - startAbsMs);
      setExpandedKey((expanded) => (expanded === key ? null : key));
    },
    [seek, events, startAbsMs],
  );

  const markersLayer = useMemo(
    () => (
      <div className="absolute inset-x-0 top-0 h-3">
        {replayRows.map((row, index) => (
          <div
            key={events[index].key}
            title={`${row.atOffsetLabel}  ${events[index].eventType}`}
            className={cn("absolute top-0 w-px h-full", row.tintClass)}
            style={{
              left: `${((events[index].timeAbsMs - startAbsMs) / Math.max(1, durationMs)) * 100}%`,
            }}
          />
        ))}
      </div>
    ),
    [replayRows, events, startAbsMs, durationMs],
  );

  const eventList = useMemo(
    () => (
      <div
        ref={listRef}
        data-testid="session-replay-events"
        style={{ height: fitsViewport ? undefined : stageHeight }}
        className="w-full lg:w-140 shrink-0 min-h-0 overflow-y-auto rounded-md border border-border divide-y divide-border/60"
      >
        {replayRows.map((row, index) => (
          <ReplayEventRow
            key={events[index].key}
            row={row}
            event={events[index]}
            index={index}
            isActive={index === activeIndex}
            isPast={index < activeIndex}
            expanded={expandedKey === events[index].key}
            teamId={teamId}
            appId={appId}
            demo={demo}
            onSelect={selectRow}
            registerRow={registerRow}
          />
        ))}
      </div>
    ),
    [
      replayRows,
      events,
      activeIndex,
      expandedKey,
      teamId,
      appId,
      demo,
      selectRow,
      registerRow,
      fitsViewport,
    ],
  );

  const scrubRef = useRef<HTMLDivElement | null>(null);
  const seekFromPointer = useCallback(
    (clientX: number) => {
      const rect = scrubRef.current!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
      );
      seek(ratio * durationMs);
    },
    [seek, durationMs],
  );

  const scrubFrameId = useRef(0);
  const scrubClientX = useRef(0);
  const dragSeekFromPointer = useCallback(
    (clientX: number) => {
      scrubClientX.current = clientX;
      cancelAnimationFrame(scrubFrameId.current);
      scrubFrameId.current = requestAnimationFrame(() =>
        seekFromPointer(scrubClientX.current),
      );
    },
    [seekFromPointer],
  );
  useEffect(() => {
    return () => cancelAnimationFrame(scrubFrameId.current);
  }, []);

  const seekFromKey = useCallback(
    (event: React.KeyboardEvent) => {
      const { playheadOffsetMs, replay } = actor.getSnapshot().context;
      const replayDurationMs = replay?.durationMs ?? 0;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        seek(playheadOffsetMs - 1000);
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        seek(playheadOffsetMs + 1000);
      } else if (event.key === "Home") {
        seek(0);
      } else if (event.key === "End") {
        seek(replayDurationMs);
      } else {
        return;
      }
      event.preventDefault();
    },
    [seek, actor],
  );

  const onStagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!inspecting || event.button !== 0) {
        return;
      }
      event.preventDefault();
      // Pointer moves are held back until the next animation frame. One left
      // waiting when the press arrives would reach the machine after it,
      // reporting no buttons held, and end the drag the moment it began.
      cancelAnimationFrame(stageMoveFrameId.current);
      event.currentTarget.setPointerCapture(event.pointerId);
      // A drag is measured in this document's pixels, and inside a container
      // that CSS has scaled down those are smaller than the pixels the hand
      // actually moved across. The scale travels with the press so the machine
      // can undo it before turning the distance into an angle.
      const screenScale = containerScaleOf(
        event.currentTarget.ownerDocument.defaultView!,
      );
      send({
        type: "user.pointerDown",
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        screenScale,
      });
    },
    [inspecting, send],
  );

  const stageMoveFrameId = useRef(0);
  const onStagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const { clientX, clientY, buttons } = event;
      // On the marketing page the player is drawn inside an iframe, and an
      // element from there is not an instance of this document's HTMLElement,
      // so the cast cannot be relied on and every step is guarded.
      const label = (event.target as HTMLElement | null)?.dataset?.label ?? "";
      cancelAnimationFrame(stageMoveFrameId.current);
      stageMoveFrameId.current = requestAnimationFrame(() => {
        let nextHoverLabel: HoverLabel | null = null;
        if (label) {
          const stageRect = stageRef.current!.getBoundingClientRect();
          const x = clientX - stageRect.left;
          nextHoverLabel = {
            label,
            x,
            y: clientY - stageRect.top,
            flip: x > stageRect.width - hoverLabelRoom,
          };
        }
        send({
          type: "user.pointerMove",
          x: clientX,
          y: clientY,
          buttons,
          hoverLabel: nextHoverLabel,
        });
      });
    },
    [send, stageRef],
  );
  useEffect(() => {
    return () => cancelAnimationFrame(stageMoveFrameId.current);
  }, []);

  // A fetch is also aborted when the viewer leaves the replay and when the
  // window of attachments being held moves past this one. Neither means the
  // attachment could not be fetched, so neither is shown to the viewer.
  const attachmentFailed =
    (shownAttachmentStatus === "error" &&
      !isCancellation(shownAttachmentError)) ||
    (shownAttachmentRef !== null && drawFailedUrls.has(shownAttachmentRef.url));
  // Sessions commonly open on events recorded before the app took its first
  // attachment, and there the query is switched off, which reads as pending
  // although nothing is being fetched. Requiring an attachment to be named keeps
  // the stage silent then: it is blank because there is nothing yet to draw,
  // not because the viewer is waiting on anything.
  const pendingAttachmentUrl = shownAttachmentRef?.url ?? null;
  const attachmentPending =
    !attachmentFailed &&
    pendingAttachmentUrl !== null &&
    shownAttachmentStatus === "pending";
  // Naming what is being waited for, instead of only recording that a wait
  // finished, is what makes the next attachment wait the full delay of its own. A
  // plain flag left over from an earlier wait would show the message the moment
  // the playhead reached an attachment that had yet to be fetched.
  const [waitedForAttachmentUrl, setWaitedForAttachmentUrl] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (!attachmentPending) {
      return;
    }
    const timer = window.setTimeout(
      () => setWaitedForAttachmentUrl(pendingAttachmentUrl),
      stageMessageDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [attachmentPending, pendingAttachmentUrl]);

  const stageMessage =
    replay === null
      ? null
      : attachmentCount === 0
        ? "No captures in this session"
        : attachmentFailed
          ? "Error loading captures here. Refresh page to try again."
          : attachmentPending && waitedForAttachmentUrl === pendingAttachmentUrl
            ? "Captures loading..."
            : null;
  const movedFromRest =
    tilt.xDegrees !== restingTilt.xDegrees ||
    tilt.yDegrees !== restingTilt.yDegrees;

  const demoTitle = demo && !hideDemoTitle && (
    <>
      <p className="font-display text-4xl max-w-6xl text-start">
        Session Replay
      </p>
      <div className="py-2" />
    </>
  );

  return (
    <>
      {demoTitle}
      <div
        ref={rootRef}
        style={
          fitsViewport
            ? { height: viewportRoom, marginBottom: -pagePadBelow }
            : undefined
        }
        className="flex flex-col w-full gap-4 font-body"
      >
        <SessionAttributePills session={session} />
        <div className="flex flex-col lg:flex-row gap-4 items-stretch flex-1 min-h-0">
          <div className="flex flex-col grow min-w-0 gap-3 min-h-0">
            <div
              ref={stageRef}
              style={{
                height: fitsViewport ? undefined : stageHeight,
                cursor: inspecting
                  ? dragging
                    ? "grabbing"
                    : "grab"
                  : undefined,
                touchAction: inspecting ? "none" : undefined,
              }}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={() => send({ type: "user.pointerUp" })}
              onPointerCancel={() => send({ type: "user.pointerCancel" })}
              onPointerLeave={() => send({ type: "user.pointerLeave" })}
              onDoubleClick={() => send({ type: "user.doubleClick" })}
              className={`relative flex w-full min-h-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card select-none ${fitsViewport ? "flex-1" : ""}`}
            >
              {replay && (
                <div className="absolute inset-0">
                  {currentAttachmentRefGroup && shownFit && (
                    <StageFrame
                      group={currentAttachmentRefGroup}
                      sessionId={sessionId}
                      sessionAttributes={sessionAttributes}
                      shownIndex={shownIndex}
                      accent={accent}
                      fit={shownFit}
                      stageWidthPx={stageBox.width}
                      tiltLayer={tiltLayerRef}
                      onDrawFailed={onDrawFailed}
                    />
                  )}
                  <TouchRing
                    actor={actor}
                    touch={currentTouch}
                    fit={shownFit}
                    ringPercent={ringPercent}
                    stageWidthPx={stageBox.width}
                  />
                </div>
              )}
              {noticeVisible && (
                <span
                  role="status"
                  className="absolute top-2 left-2 z-10 inline-flex flex-row items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card/90 backdrop-blur-sm text-[11px] font-display text-muted-foreground pointer-events-none"
                >
                  <SkipForward className="size-3" />
                  Skipped {formatSkipped(skippedIdleMs!)} of idle time
                </span>
              )}
              {hoverLabel && (
                <span
                  className="absolute z-10 px-1.5 py-0.5 rounded-sm bg-popover text-popover-foreground border border-border text-[11px] leading-tight whitespace-nowrap pointer-events-none shadow-sm"
                  style={{
                    left: hoverLabel.x + 14,
                    top: hoverLabel.y + 14,
                    transform: hoverLabel.flip
                      ? "translateX(-100%) translateX(-28px)"
                      : undefined,
                  }}
                >
                  {hoverLabel.label}
                </span>
              )}
              {currentAttachmentRefGroup &&
                currentAttachmentRefGroup.attachmentRefs.length > 1 && (
                  <div
                    role="group"
                    aria-label="Attachments"
                    onPointerDown={(event) => event.stopPropagation()}
                    className="absolute top-2 right-2 z-10 flex flex-row items-center gap-0.5 rounded-md border border-border bg-card/90 p-0.5 backdrop-blur-sm"
                  >
                    {Array.from(
                      {
                        length: currentAttachmentRefGroup.attachmentRefs.length,
                      },
                      (_, index) => (
                        <button
                          key={index}
                          type="button"
                          aria-pressed={index === shownIndex}
                          onClick={() =>
                            send({ type: "user.selectAttachment", index })
                          }
                          className={cn(
                            "rounded-sm px-2 py-0.5 text-[11px] font-display transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            index === shownIndex
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          {`Attachment ${index + 1}`}
                        </button>
                      ),
                    )}
                  </div>
                )}
              {stageMessage && (
                <p
                  role="status"
                  className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted-foreground pointer-events-none select-none"
                >
                  {stageMessage}
                </p>
              )}
              {inspecting && (
                <span className="absolute bottom-1.5 right-2 text-[10px] leading-none text-muted-foreground/70 pointer-events-none select-none">
                  {movedFromRest ? "Double-click to reset" : "Drag to turn"}
                </span>
              )}
            </div>

            <SessionReplayMetrics
              strips={metricStrips}
              startAbsMs={startAbsMs}
              durationMs={durationMs}
              actor={actor}
              onSeek={seek}
            />

            <div className="flex flex-col gap-1 select-none">
              <ReplayScrubber
                actor={actor}
                durationMs={durationMs}
                markers={markersLayer}
                scrubRef={scrubRef}
                seekFromPointer={seekFromPointer}
                dragSeekFromPointer={dragSeekFromPointer}
                seekFromKey={seekFromKey}
              />

              <div className="flex flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => send({ type: "user.toggle" })}
                  aria-label={playing ? "Pause" : "Play"}
                  className="inline-flex items-center justify-center size-9 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {playing ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => seek(0)}
                  aria-label="Restart"
                  className="inline-flex items-center justify-center size-9 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <RotateCcw className="size-4" />
                </button>

                <ReplayTimeLabel actor={actor} durationMs={durationMs} />

                <div className="grow" />

                <div
                  role="group"
                  aria-label="Playback speed"
                  className="flex flex-row items-center gap-0.5"
                >
                  {speeds.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={playbackSpeed === option}
                      onClick={() =>
                        send({ type: "user.setSpeed", playbackSpeed: option })
                      }
                      className={cn(
                        "px-1.5 py-1 rounded-md text-xs font-display transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        playbackSpeed === option
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {option}x
                    </button>
                  ))}
                </div>

                <label className="flex flex-row items-center gap-1.5 text-xs font-display text-muted-foreground cursor-pointer whitespace-nowrap">
                  <Switch
                    checked={idleSkipEnabled}
                    onCheckedChange={() =>
                      send({ type: "user.toggleIdleSkip" })
                    }
                    aria-label="Skip idle"
                  />
                  Skip idle
                </label>
              </div>
            </div>
          </div>
          {eventList}
        </div>
      </div>
    </>
  );
}
