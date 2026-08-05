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

export interface SiblingPoint {
  id: string;
  y: number;
  color: string;
}

// Canvas line charts have no x-slice tooltip, only a nearest-point one, so
// each datum carries the values of every series at its x position for the
// tooltip to list the full breakdown. Series are matched by their x value;
// a series with no datum at that x is absent from the list.
export function embedSiblingPoints<
  D extends { x: string; y: number },
  S extends { id: string; data: D[] },
>(
  plot: S[],
  colorFor: (id: string, index: number) => string,
): (Omit<S, "data"> & { data: (D & { siblings: SiblingPoint[] })[] })[] {
  const byX = new Map<string, SiblingPoint[]>();
  plot.forEach((series, index) => {
    const color = colorFor(series.id, index);
    for (const d of series.data) {
      let list = byX.get(d.x);
      if (!list) {
        list = [];
        byX.set(d.x, list);
      }
      list.push({ id: series.id, y: d.y, color });
    }
  });
  return plot.map((series) => ({
    ...series,
    data: series.data.map((d) => ({ ...d, siblings: byX.get(d.x) ?? [] })),
  }));
}
