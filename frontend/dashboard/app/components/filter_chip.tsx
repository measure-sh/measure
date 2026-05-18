"use client";

import { RotateCcw, X } from "lucide-react";
import React from "react";
import { cn } from "../utils/shadcn_utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const chipBase =
  "rounded-full border border-input bg-background shadow-xs font-display text-xs whitespace-nowrap select-none";
const zone =
  "outline-none transition-colors duration-100 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

// A chip's secondary button. "clear" empties the filter (the chip then
// disappears); "reset" restores a non-empty default. A filter already at its
// default has no action — there is nothing to undo.
export type FilterChipAction = { kind: "clear" | "reset"; onClick: () => void };

interface FilterChipProps {
  label: string;
  // Full, untruncated selection. Shown on hover over the chip body when it
  // has more to say than the (possibly truncated) label.
  tooltip?: string;
  onClick: () => void;
  action?: FilterChipAction;
}

// An active filter shown as a pill: the selection summarised as text, the body
// clickable to open its editor. When there's something to undo it also carries
// a clear (X) or reset (↺) button; both halves stretch to the chip's full
// height so their hover state fills it edge to edge.
const FilterChip: React.FC<FilterChipProps> = ({
  label,
  tooltip,
  onClick,
  action,
}) => {
  // Wrap the chip body in a tooltip only when the full text says more than
  // the label already shows.
  const wrapTip = (trigger: React.ReactElement) => {
    if (!tooltip || tooltip === label) {
      return trigger;
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent className="max-w-96 bg-accent text-accent-foreground fill-accent">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  if (!action) {
    return wrapTip(
      <button
        type="button"
        onClick={onClick}
        className={cn(chipBase, "inline-flex items-center px-3 py-1", zone)}
      >
        {label}
      </button>,
    );
  }

  return (
    <span className={cn(chipBase, "inline-flex items-stretch")}>
      {wrapTip(
        <button
          type="button"
          onClick={onClick}
          className={cn("rounded-l-full px-3 py-1", zone)}
        >
          {label}
        </button>,
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${action.kind === "reset" ? "Reset" : "Clear"} ${
              label.split(":")[0]
            }`}
            onClick={action.onClick}
            className={cn(
              "inline-flex items-center justify-center rounded-r-full pr-2.5 pl-1.5",
              zone,
            )}
          >
            {action.kind === "reset" ? (
              <RotateCcw className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="bg-accent text-accent-foreground fill-accent">
          {action.kind === "reset" ? "Reset to defaults" : "Clear"}
        </TooltipContent>
      </Tooltip>
    </span>
  );
};

export default FilterChip;
