import * as React from "react";
import { cn } from "@/app/utils/shadcn_utils";

// The bordered panel around a chart's hover tooltip. It has no padding, so each
// tooltip passes its own through `className`.
export function PlotTooltipShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-background text-foreground font-body border shadow-md flex flex-col text-xs rounded-md whitespace-nowrap",
        className,
      )}
    >
      {children}
    </div>
  );
}

// The small colour dot that labels a series in a plot tooltip row.
export function PlotTooltipSwatch({ color }: { color: string }) {
  return (
    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
  );
}
