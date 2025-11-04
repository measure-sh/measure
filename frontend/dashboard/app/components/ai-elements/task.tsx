"use client";

import { cn } from "@/app/utils/shadcn_utils";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";

export type TaskItemFileProps = ComponentProps<"div">;

export const TaskItemFile = ({
  children,
  className,
  ...props
}: TaskItemFileProps) => (
  <div
    className={cn(
      "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-slate-950 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-50",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type TaskItemProps = ComponentProps<"div">;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cn("text-slate-500 text-sm dark:text-slate-400", className)} {...props}>
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = ({
  defaultOpen = true,
  className,
  ...props
}: TaskProps) => (
  <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
};

export const TaskTrigger = ({
  children,
  className,
  title,
  ...props
}: TaskTriggerProps) => (
  <CollapsibleTrigger asChild className={cn("group", className)} {...props}>
    {children ?? (
      <div className="flex w-full cursor-pointer items-center gap-2 text-slate-500 text-sm transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
        <SearchIcon className="size-4" />
        <p className="text-sm">{title}</p>
        <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </div>
    )}
  </CollapsibleTrigger>
);

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-slate-950 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in dark:text-slate-50",
      className
    )}
    {...props}
  >
    <div className="mt-4 space-y-2 border-slate-100 border-l-2 pl-4 dark:border-slate-800">
      {children}
    </div>
  </CollapsibleContent>
);
