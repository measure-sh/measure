import { Badge } from "@/app/components/badge";
import SimpleTooltip from "@/app/components/simple_tooltip";
import { cn } from "@/app/utils/shadcn_utils";
import { ReactNode } from "react";

interface BetaBadgeProps {
  popup?: ReactNode;
}

export default function BetaBadge({ popup }: BetaBadgeProps) {
  return (
    <SimpleTooltip content={popup ? <div className="p-2">{popup}</div> : null}>
      <sup>
        <Badge
          variant="outline"
          className={cn("select-none", popup && "cursor-default")}
        >
          Beta
        </Badge>
      </sup>
    </SimpleTooltip>
  );
}
