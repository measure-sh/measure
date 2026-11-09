import type { JourneyNode } from "@/app/api/api_calls";
import { Fragment, type ReactNode } from "react";
import { PlotTooltip, PlotTooltipSwatch } from "../plot_tooltip";
import { Separator } from "../separator";
import { linkStats, nodeStats, shortName, type Stat } from "./format";

export function nodeTapKey(nodeId: string): string {
  return `node:${nodeId}`;
}

export function linkTapKey(source: string, target: string): string {
  return `link:${source}>${target}`;
}

function Tooltip({
  tapKey,
  colour,
  title,
  stats,
  hint,
}: {
  tapKey: string;
  colour: string;
  title: ReactNode;
  stats: Stat[];
  hint?: string;
}) {
  return (
    <PlotTooltip tapKey={tapKey}>
      <div className="flex flex-row items-center gap-2 px-4 py-3">
        <PlotTooltipSwatch color={colour} />
        <p className="font-display text-sm">{title}</p>
      </div>
      <Separator />
      <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 px-4 py-3">
        {stats.map((stat) => (
          <Fragment key={stat.label}>
            <span className="text-muted-foreground">{stat.label}</span>
            <span className={`text-right tabular-nums ${stat.className ?? ""}`}>
              {stat.value}
            </span>
          </Fragment>
        ))}
      </div>
      {hint && (
        <>
          <Separator />
          {/* The hint has no width of its own. Thus it wraps at the width
              that the title and stats give the tooltip. */}
          <p className="w-0 min-w-full whitespace-normal px-4 py-3 text-muted-foreground">
            {hint}
          </p>
        </>
      )}
    </PlotTooltip>
  );
}

export function NodeTooltip({
  node,
  colour,
  clears,
  clickable,
  extendable,
}: {
  node: JourneyNode;
  colour: string;
  // Whether a click clears the selection.
  clears: boolean;
  clickable: boolean;
  // Whether a click on the plus or a shift-click adds the node to the path.
  extendable: boolean;
}) {
  const hint = !clickable
    ? undefined
    : clears
      ? "Click to clear the selection"
      : "Click to highlight paths and see details";
  return (
    <Tooltip
      tapKey={nodeTapKey(node.id)}
      colour={colour}
      title={shortName(node.name)}
      stats={nodeStats(node)}
      hint={
        hint && extendable
          ? `${hint}. Click the plus or shift-click to add it to the current path`
          : hint
      }
    />
  );
}

export function LinkTooltip({
  source,
  target,
  colour,
  users,
  clickable,
}: {
  source: JourneyNode;
  target: JourneyNode;
  colour: string;
  users: number;
  clickable: boolean;
}) {
  return (
    <Tooltip
      tapKey={linkTapKey(source.id, target.id)}
      colour={colour}
      title={
        <>
          {shortName(source.name)} → {shortName(target.name)}
        </>
      }
      stats={linkStats(source, users)}
      hint={clickable ? "Click to see details" : undefined}
    />
  );
}
