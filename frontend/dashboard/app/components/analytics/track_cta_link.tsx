"use client";

import Link from "next/link";
import type React from "react";
import { track } from "@/app/utils/analytics/track";

type TrackCtaLinkProps = React.ComponentProps<typeof Link> & {
  location: string;
  destination: string;
};

export default function TrackCtaLink({
  location,
  destination,
  children,
  onClick,
  ...rest
}: TrackCtaLinkProps) {
  return (
    <Link
      {...rest}
      onClick={(event) => {
        track("cta_click", { location, destination });
        if (onClick) {
          onClick(event);
        }
      }}
    >
      {children}
    </Link>
  );
}
