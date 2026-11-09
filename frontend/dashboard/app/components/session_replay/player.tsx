"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActorRef, useSelector } from "@xstate/react";
import { cn } from "@/app/utils/shadcn_utils";
import { Switch } from "@/app/components/switch";
import {
  type HoverLabel,
  sessionReplayMachine,
  tickOffsetMs,
  restingTilt,
} from "@/app/components/session_replay/machine";
import {
  type ReplayEvent,
  type AttachmentRef,
} from "@/app/components/session_replay/events";
import {
  attachmentQueryOptions,
  isCancellation,
  useAttachmentWindow,
} from "@/app/components/session_replay/attachments";
import { type ReplayRow } from "@/app/components/session_replay/replay";
import {
  fitInto,
  replayOutlineWidthProperty,
  treeOutlineWidthPx,
  containerScaleOf,
  tiltProgress,
} from "@/app/components/session_replay/geometry";
import {
  tiltScaleFor,
  StageFrame,
  TouchRing,
} from "@/app/components/session_replay/stage";
import { ReplayEventRow } from "@/app/components/session_replay/event_rows";
import {
  useSessionMetricStrips,
  SessionReplayMetrics,
} from "@/app/components/session_replay/metrics";
import {
  formatSkipped,
  SessionAttributePills,
  ReplayTimeLabel,
  ReplayScrubber,
} from "@/app/components/session_replay/stage_chrome";
import { demoSession } from "@/app/components/session_replay/demo_data";

const emptyReplayEvents: ReplayEvent[] = [];

const emptyReplayRows: ReplayRow[] = [];

const speeds = [0.5, 1, 2, 4];

const stageHeight = 600;

const minimumPlayerHeight = 420;

const viewportBottomGap = 16;

const touchRingRatio = 0.13;

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

const defaultReplayAccent = "oklch(79.2% 0.209 151.711)";

// Playing a session moves the playhead past attachments that have not been
// fetched yet, and most fetches finish well inside this time, so the stage
// waits this long before saying it is loading. Without the wait the message
// would flash on screen at nearly every attachment.
const stageMessageDelayMs = 200;

type SessionReplayProps = {
  teamId?: string;
  appId?: string;
  session?: any;
  demo?: boolean;
  hideDemoTitle?: boolean;
};

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
  // This component re-renders when one of its selected machine values changes.
  // It does not select the playhead; the time label, scrubber, touch ring, and
  // metric charts select it themselves. This keeps each 60 Hz tick from
  // redrawing the whole player.
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
  const shownAttachmentRef =
    currentAttachmentRefGroup?.attachmentRefs[shownIndex] ?? null;
  const currentTouch =
    slice?.touchIndex != null && shownAttachmentRef?.type !== "screenshot"
      ? replay!.touches[slice.touchIndex]
      : null;
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
  // Stage elements are positioned from this fit, and the tilt effect depends
  // on it. Memoising it keeps the object stable when its inputs do not change,
  // avoiding a layout tree redraw on every render during playback.
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

  // Playback time advances here: each frame sends elapsed real time, scaled by
  // playback speed, to the machine as a tick. The machine holds the resulting
  // position, and stage content is derived from it, so seeking only needs to
  // set that position. Frames stop in a hidden tab or on a blocked main thread;
  // capping each step lets playback resume near where it stopped instead of
  // jumping forward by the full gap.
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
            className={cn("absolute top-0 w-px h-full", row.markClass)}
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
  // Track the URL being awaited, not just whether a wait finished. This gives
  // each attachment its own full delay; a leftover flag would show the message
  // as soon as playback reached an attachment that was still being fetched.
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
