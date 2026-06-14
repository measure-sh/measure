"use client";

import { RotateCcw } from "lucide-react";
import React from "react";
import { formatMillisToHumanReadable } from "../../utils/time_utils";

interface TraceZoomBannerProps {
  startMs: number;
  endMs: number;
  onReset: () => void;
}

const TraceZoomBanner: React.FC<TraceZoomBannerProps> = ({
  startMs,
  endMs,
  onReset,
}) => (
  <div className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-medium rounded-md border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-950 text-amber-700 dark:text-amber-400">
    <span>
      Zoomed: {formatMillisToHumanReadable(startMs)} –{" "}
      {formatMillisToHumanReadable(endMs)}
    </span>
    <button
      type="button"
      onClick={onReset}
      className="p-0.5 rounded-sm border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-950 dark:text-amber-400 dark:bg-amber-950/40 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
      aria-label="Reset zoom"
      title="Reset zoom"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  </div>
);

export default TraceZoomBanner;
