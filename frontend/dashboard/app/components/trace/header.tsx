"use client";

import React from "react";
import TickRuler from "./tick_ruler";

interface WaterfallHeaderProps {
  viewStartMs: number;
  viewWindowMs: number;
  onSpanResizePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLeftResizePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const WaterfallHeader: React.FC<WaterfallHeaderProps> = ({
  viewStartMs,
  viewWindowMs,
  onSpanResizePointerDown,
  onLeftResizePointerDown,
}) => (
  <div className="sticky top-0 z-10 bg-background border-b flex flex-row items-stretch h-12 select-none">
    <div
      className="flex items-center px-2 text-xs font-display text-muted-foreground shrink-0 min-w-0"
      style={{ width: "var(--span-col-width)" }}
    >
      Span
    </div>
    <ResizerHandle
      onPointerDown={onSpanResizePointerDown}
      testId="trace-column-resizer-span"
    />
    <div
      className="flex items-center px-2 text-xs font-display text-muted-foreground shrink-0 min-w-0"
      style={{ width: "var(--thread-col-width)" }}
    >
      Thread
    </div>
    <ResizerHandle
      onPointerDown={onLeftResizePointerDown}
      testId="trace-column-resizer"
    />
    <TickRuler startMs={viewStartMs} windowMs={viewWindowMs} />
  </div>
);

const ResizerHandle: React.FC<{
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  testId: string;
}> = ({ onPointerDown, testId }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    onPointerDown={onPointerDown}
    className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-border transition-colors"
    data-testid={testId}
  />
);
