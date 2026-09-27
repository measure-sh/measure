"use client";

import type { JourneyMapWireframe } from "@/app/api/api_calls";
import { cn } from "@/app/utils/shadcn_utils";
import { memo, useMemo } from "react";

// Containers are drawn as outlines and text as filled blocks, the same way
// session replay draws a layout snapshot. Each kind is one path, so a
// snapshot with hundreds of elements is two DOM nodes.
function wireframePaths(wireframe: JourneyMapWireframe) {
  let outlines = "";
  let text = "";
  for (const [x, y, w, h, isText] of wireframe.boxes) {
    const rect = `M${x} ${y}h${w}v${h}h${-w}Z`;
    if (isText) {
      text += rect;
    } else {
      outlines += rect;
    }
  }
  return { outlines, text };
}

// crop fills the box and trims the bottom of a snapshot taller than it,
// otherwise the whole snapshot is fitted inside the box.
export const Wireframe = memo(function Wireframe({
  wireframe,
  crop = false,
  className,
}: {
  wireframe: JourneyMapWireframe;
  crop?: boolean;
  className?: string;
}) {
  const { outlines, text } = useMemo(
    () => wireframePaths(wireframe),
    [wireframe],
  );
  return (
    <svg
      viewBox={`0 0 ${wireframe.width} ${wireframe.height}`}
      preserveAspectRatio={crop ? "xMidYMin slice" : "xMidYMid meet"}
      className={cn("block text-foreground", className)}
      aria-hidden
    >
      <path d={text} className="fill-current opacity-20" />
      <path
        d={outlines}
        className="fill-none stroke-current opacity-45"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

export function NoSnapshot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-center text-[10px] font-body text-muted-foreground",
        className,
      )}
    >
      No snapshot yet
    </div>
  );
}
