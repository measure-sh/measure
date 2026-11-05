"use client";

import { memo } from "react";
import { useSelector } from "@xstate/react";
import { formatMillisToHumanReadable } from "@/app/utils/time_utils";
import Pill from "@/app/components/pill";
import { type SessionReplayActor } from "@/app/components/session_replay/machine";
import { formatOffset } from "@/app/components/session_replay/event_rows";

export function formatSkipped(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

export const SessionAttributePills = memo(function SessionAttributePills({
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

export const ReplayTimeLabel = memo(function ReplayTimeLabel({
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

export const ReplayScrubber = memo(function ReplayScrubber({
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
