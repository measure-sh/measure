import {
  and,
  assertEvent,
  assign,
  raise,
  setup,
  type ActorRefFrom,
} from "xstate";
import { type AttachmentRef } from "@/app/components/session_replay/events";
import {
  type ReplaySlice,
  type Replay,
  type AttachmentRefGroup,
  replayFrom,
  sliceIndexAt,
} from "@/app/components/session_replay/replay";

export type Tilt = { xDegrees: number; yDegrees: number };

export type HoverLabel = { label: string; x: number; y: number; flip: boolean };

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

export type SessionReplayActor = ActorRefFrom<typeof sessionReplayMachine>;

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

const dragDegreesPerPixel = 0.5;

export const restingTilt: Tilt = { xDegrees: -8, yDegrees: 24 };

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
