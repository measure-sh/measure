"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { formatMillisToHumanReadable } from "../../utils/time_utils";

// Approximate width per label, tuned against the densest formatted values
// (e.g. "1.234s"). Used to pick the tick density that still leaves enough
// horizontal space between adjacent labels to avoid visual overlap.
const MIN_LABEL_PX = 70;

const TICK_DENSITIES: readonly (readonly number[])[] = [
  [0, 0.2, 0.4, 0.6, 0.8, 1],
  [0, 1 / 3, 2 / 3, 1],
  [0, 0.5, 1],
  [0, 1],
];

export function pickTickFractions(width: number): readonly number[] {
  for (const fractions of TICK_DENSITIES) {
    if ((fractions.length - 1) * MIN_LABEL_PX <= width) {
      return fractions;
    }
  }
  return TICK_DENSITIES[TICK_DENSITIES.length - 1];
}

interface TickRulerProps {
  startMs: number;
  windowMs: number;
}

const TickRuler: React.FC<TickRulerProps> = ({ startMs, windowMs }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") {
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fractions = pickTickFractions(width);

  // Inner wrapper carries the ref + the `mr-2` right inset so the rightmost
  // tick (100%) aligns with the rightmost edge a span bar can reach in the
  // body — leaving a small visual gutter on the right side of every row.
  return (
    <div className="flex-1">
      <div
        ref={ref}
        className="relative h-full mx-2"
        data-testid="trace-tick-ruler"
      >
        {fractions.map((f, i) => {
          const labelMs = startMs + f * windowMs;
          const translateX =
            i === 0 ? "0" : i === fractions.length - 1 ? "-100%" : "-50%";
          return (
            <div
              key={i}
              className="absolute inset-y-0 flex items-center"
              style={{
                left: `${f * 100}%`,
                transform: `translateX(${translateX})`,
              }}
            >
              <span className="text-[10px] text-muted-foreground px-1">
                {formatMillisToHumanReadable(labelMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TickRuler;
