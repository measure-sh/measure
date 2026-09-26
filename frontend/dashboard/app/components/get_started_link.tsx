"use client";

import type React from "react";
import { useAuthStatusQuery } from "../query/auth_status";
import TrackCtaLink from "./analytics/track_cta_link";

type GetStartedLinkProps = {
  location: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export default function GetStartedLink({
  location,
  className,
  onClick,
}: GetStartedLinkProps) {
  const { data: signedIn } = useAuthStatusQuery();

  return (
    <TrackCtaLink
      location={location}
      destination={signedIn ? "dashboard" : "signup"}
      href="/auth/login"
      className={className}
      onClick={onClick}
    >
      {signedIn ? "Dashboard" : "Get Started"}
    </TrackCtaLink>
  );
}
