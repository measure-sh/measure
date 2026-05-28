import { Badge } from "@/app/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/tooltip";
import { ReactNode } from "react";

interface BetaBadgeProps {
  popup?: ReactNode;
}

export default function BetaBadge({ popup }: BetaBadgeProps) {
  if (popup) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <sup>
            <Badge variant="outline" className="select-none cursor-default">
              Beta
            </Badge>
          </sup>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="font-display max-w-80 text-sm"
        >
          <div className="p-2">{popup}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <sup>
      <Badge variant="outline" className="select-none">
        Beta
      </Badge>
    </sup>
  );
}
