"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";

interface TraceErrorBannerProps {
  count: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
}

const TraceErrorBanner: React.FC<TraceErrorBannerProps> = ({
  count,
  index,
  onPrev,
  onNext,
}) => (
  <div
    className="flex flex-row items-center gap-2 px-3 py-1.5 text-xs rounded-md border bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
    data-testid="trace-error-banner"
  >
    <span className="font-display">
      {count} {count === 1 ? "error span" : "error spans"}
    </span>
    <span className="ml-1 select-none">
      {index + 1} / {count}
    </span>
    <button
      type="button"
      onClick={onPrev}
      className="p-0.5 rounded-sm hover:bg-red-100 dark:hover:bg-red-900/40"
      aria-label="Previous error"
    >
      <ChevronUp className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      onClick={onNext}
      className="p-0.5 rounded-sm hover:bg-red-100 dark:hover:bg-red-900/40"
      aria-label="Next error"
    >
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  </div>
);

export default TraceErrorBanner;
