"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "../utils/shadcn_utils";

interface SimpleTooltipProps {
  // The tooltip body. When falsy, children render with no tooltip wrapper.
  content: React.ReactNode;
  // The element the tooltip is attached to.
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  sideOffset?: number;
  // Class applied to the floating content panel.
  contentClassName?: string;
  // Class applied to the trigger wrapper.
  triggerClassName?: string;
  // Render the trigger as its single child (Radix asChild). Defaults to true,
  // matching every current call site.
  asChild?: boolean;
}

// Collapses the Tooltip / TooltipTrigger / TooltipContent trio into one element
// for the common case of a single trigger with a simple content panel. Defaults
// side/align to the bottom-start placement shared by all dashboard tooltips.
export default function SimpleTooltip({
  content,
  children,
  side = "bottom",
  align = "start",
  sideOffset,
  contentClassName,
  triggerClassName,
  asChild = true,
}: SimpleTooltipProps) {
  if (!content) {
    return <>{children}</>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild} className={triggerClassName}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-background max-w-96 text-foreground font-display text-sm border drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex flex-col px-4 py-2 rounded-md",
          contentClassName,
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
