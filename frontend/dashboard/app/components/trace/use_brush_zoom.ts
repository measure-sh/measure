import { RefObject, useEffect, useState } from "react";

const BRUSH_THRESHOLD_PX = 5;
// Matches the `mx-2` (8px) gutter on the tick ruler and timeline cells so
// the brush stops at the same edges a bar can actually reach.
const TIMELINE_LEFT_INSET_PX = 8;
const TIMELINE_RIGHT_INSET_PX = 8;

// Click + drag across the timeline area, release to zoom into that window.
// A drag of < BRUSH_THRESHOLD_PX falls through to the row's onClick; a real
// drag swallows the trailing click so the row underneath isn't selected.
export function useBrushToZoom(args: {
  waterfallRef: RefObject<HTMLDivElement | null>;
  leftColumnFraction: number;
  viewStartMs: number;
  viewEndMs: number;
  traceDurationMs: number;
  setViewStartMs: (ms: number) => void;
  setViewEndMs: (ms: number) => void;
}): { startPx: number | null; currentPx: number | null } {
  const {
    waterfallRef,
    leftColumnFraction,
    viewStartMs,
    viewEndMs,
    traceDurationMs,
    setViewStartMs,
    setViewEndMs,
  } = args;
  const [startPx, setStartPx] = useState<number | null>(null);
  const [currentPx, setCurrentPx] = useState<number | null>(null);

  useEffect(() => {
    const waterfall = waterfallRef.current;
    if (!waterfall) {
      return;
    }

    // +6 (resizer handle) + TIMELINE_LEFT_INSET_PX (ml-2) gets us past the
    // dead gutter at the left edge of the timeline cell to where bars start.
    const bounds = () => {
      const rect = waterfall.getBoundingClientRect();
      const timelineLeft =
        rect.width * leftColumnFraction + 6 + TIMELINE_LEFT_INSET_PX;
      const timelineRight = rect.width - TIMELINE_RIGHT_INSET_PX;
      return {
        rect,
        timelineLeft,
        timelineRight,
        timelineWidth: timelineRight - timelineLeft,
      };
    };

    let downAt: number | null = null;

    const onMove = (e: MouseEvent) => {
      if (downAt === null) {
        return;
      }
      const { rect, timelineLeft, timelineRight } = bounds();
      setCurrentPx(
        Math.max(timelineLeft, Math.min(timelineRight, e.clientX - rect.left)),
      );
    };

    const onUp = (e: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const start = downAt;
      downAt = null;
      setStartPx(null);
      setCurrentPx(null);
      if (start === null) {
        return;
      }
      const { rect, timelineLeft, timelineRight, timelineWidth } = bounds();
      const end = Math.max(
        timelineLeft,
        Math.min(timelineRight, e.clientX - rect.left),
      );
      if (Math.abs(end - start) < BRUSH_THRESHOLD_PX || timelineWidth <= 0) {
        return;
      }
      const lower = Math.min(start, end);
      const upper = Math.max(start, end);
      const range = viewEndMs - viewStartMs;
      setViewStartMs(
        Math.max(
          0,
          viewStartMs + ((lower - timelineLeft) / timelineWidth) * range,
        ),
      );
      setViewEndMs(
        Math.min(
          traceDurationMs,
          viewStartMs + ((upper - timelineLeft) / timelineWidth) * range,
        ),
      );
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) {
        return;
      }
      const { rect, timelineLeft } = bounds();
      const cursor = e.clientX - rect.left;
      if (cursor < timelineLeft) {
        return;
      }
      downAt = cursor;
      setStartPx(cursor);
      setCurrentPx(cursor);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    waterfall.addEventListener("mousedown", onDown);
    return () => {
      waterfall.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    waterfallRef,
    leftColumnFraction,
    viewStartMs,
    viewEndMs,
    traceDurationMs,
    setViewStartMs,
    setViewEndMs,
  ]);

  return { startPx, currentPx };
}
