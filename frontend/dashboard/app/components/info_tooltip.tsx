"use client";

import { Info } from "lucide-react";
import * as React from "react";
import { cn } from "../utils/shadcn_utils";
import SimpleTooltip from "./simple_tooltip";

interface InfoTooltipProps {
  // The tooltip body shown on hover/focus of the info icon.
  content: React.ReactNode;
  // Class applied to the info icon (merged over the defaults).
  className?: string;
  side?: React.ComponentProps<typeof SimpleTooltip>["side"];
  align?: React.ComponentProps<typeof SimpleTooltip>["align"];
  contentClassName?: React.ComponentProps<
    typeof SimpleTooltip
  >["contentClassName"];
}

// A small info (i) icon that reveals descriptive helper text in a tooltip.
// Pair it with a section heading or control label instead of rendering the
// helper text inline. Mirrors the pattern used across the SDK configurator.
export default function InfoTooltip({
  content,
  className,
  side,
  align,
  contentClassName,
}: InfoTooltipProps) {
  return (
    <SimpleTooltip
      content={content}
      side={side}
      align={align}
      // Override the simple tooltip panel's `flex flex-col` (which would drop an inline
      // link onto its own line) and `text-balance` (which leaves the panel
      // narrower than its width) so descriptive text flows as a normal
      // paragraph that fills the width with inline links.
      contentClassName={cn("block text-wrap", contentClassName)}
    >
      <Info className={cn("h-4 w-4 -mt-0.5 shrink-0", className)} />
    </SimpleTooltip>
  );
}
