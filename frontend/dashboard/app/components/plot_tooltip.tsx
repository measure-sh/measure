import * as React from "react";
import { cn } from "@/app/utils/shadcn_utils";

// Shared container for Nivo chart hover tooltips: the bordered, shadowed panel
// every plot popover sits in. Pass `className` to override the default padding
// (e.g. "p-4") or to add positioning offsets (heatmap/pie).
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
        "bg-background text-foreground font-body border shadow-md flex flex-col px-4 py-2 text-xs rounded-md whitespace-nowrap",
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
