"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { track } from "@/app/utils/analytics/track";

type TrackGithubLinkProps = React.ComponentProps<typeof Link> & {
  /**
   * Override the page path captured in the event. When omitted, the
   * component reads the current pathname via next/navigation.
   */
  sourcePage?: string;
};

export default function TrackGithubLink({
  sourcePage,
  children,
  onClick,
  ...rest
}: TrackGithubLinkProps) {
  const pathname = usePathname();
  return (
    <Link
      {...rest}
      onClick={(event) => {
        track("github_repo_click", {
          source_page: sourcePage ?? pathname ?? "",
        });
        if (onClick) {
          onClick(event);
        }
      }}
    >
      {children}
    </Link>
  );
}
