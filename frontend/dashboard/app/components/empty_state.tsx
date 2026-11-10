import type { LucideIcon } from "lucide-react";
import React from "react";
import { cn } from "../utils/shadcn_utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 w-full border border-dashed border-border rounded-sm p-6 text-center font-body",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 max-w-120">
        <Icon className="size-6 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
};

export default EmptyState;
