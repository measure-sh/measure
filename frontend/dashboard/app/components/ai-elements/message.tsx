import { cn } from "@/app/utils/shadcn_utils";

import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-4",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      className
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "is-user:dark flex flex-col gap-2 overflow-hidden rounded-lg text-sm",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[80%] px-4 py-3",
          "group-[.is-user]:bg-slate-900 group-[.is-user]:text-slate-50 dark:group-[.is-user]:bg-slate-50 dark:group-[.is-user]:text-slate-900",
          "group-[.is-assistant]:bg-slate-100 group-[.is-assistant]:text-slate-950 dark:group-[.is-assistant]:bg-slate-800 dark:group-[.is-assistant]:text-slate-50",
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-slate-100 group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-slate-950 dark:group-[.is-user]:bg-slate-800 dark:group-[.is-user]:text-slate-50",
          "group-[.is-assistant]:text-slate-950 dark:group-[.is-assistant]:text-slate-50",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("size-8 ring-1 ring-slate-200 dark:ring-slate-800", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
