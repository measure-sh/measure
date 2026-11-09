import { formatToCamelCase } from "@/app/utils/string_utils";
import { pillMark, PillType } from "@/app/components/pill";
import {
  isGesture,
  isActivityEvent,
  type ReplayEvent,
  replayEventsFrom,
  type AttachmentRef,
  replayableAttachmentsOf,
} from "@/app/components/session_replay/events";
import {
  formatOffset,
  logSeverity,
  pillTypeForEvent,
  sessionEventTitle,
} from "@/app/components/session_replay/event_rows";

export type DevicePoint = { x: number; y: number };

export type ReplayTouch = {
  eventIndex: number;
  pressOffsetMs: number;
  releaseOffsetMs: number;
  from: DevicePoint;
  to: DevicePoint;
};

export type ReplayRow = {
  atOffsetLabel: string;
  title: string;
  pillType: PillType;
  pillText: string | null;
  threadName: string;
  markClass: string;
};

export type ReplaySlice = {
  startOffsetMs: number;
  eventIndex: number;
  touchIndex: number | null;
  skipToOffsetMs: number | null;
};

export type Replay = {
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

export type AttachmentRefGroup = {
  key: string;
  eventIndex: number;
  attachmentRefs: AttachmentRef[];
};

const touchHoldMs = 220;

export const swipeTravelMs = 320;

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
    markClass: pillMark(pillType),
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
        eventIndex,
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
        type: attachment.type,
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

  const shownAttachmentRefGroupIndexByEventIndex = carriedForward(
    attachmentRefGroupIndexByEventIndex,
    events.length,
  );

  // Scrolls, long presses, and throttled taps may have no snapshot of their own.
  // Use the snapshot displayed at the gesture's timestamp, and clear the touch
  // indicator when the displayed capture changes.
  slices.forEach((slice) => {
    if (slice.touchIndex === null) {
      return;
    }
    const gestureGroupIndex =
      shownAttachmentRefGroupIndexByEventIndex[
        touches[slice.touchIndex].eventIndex
      ];
    if (
      shownAttachmentRefGroupIndexByEventIndex[slice.eventIndex] !==
      gestureGroupIndex
    ) {
      slice.touchIndex = null;
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
    shownAttachmentRefGroupIndexByEventIndex,
  };
}

export const idleSkipThresholdMs = 5000;

const idleSkipLeadMs = 500;

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
    // Skipping stops a lead time before the next activity, giving the viewer
    // a moment of stillness before it begins. The lead is shorter than the
    // idle threshold, so the target remains ahead of this slice. It may still
    // skip over intervening slices: every event starts a slice, but only
    // events that change the screen count as activity. A log or HTTP call
    // within the gap therefore starts a slice the skip passes over.
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
