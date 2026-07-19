"use client";

import { track } from "@/app/utils/analytics/track";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function deriveBlogSection(pathname: string): string {
  // Drop leading "/blog" and any trailing slash to get the in-blog path.
  // Posts are flat, so "/blog/<slug>" -> the post slug; "/blog/tags/<tag>"
  // -> "tags"; "/blog" or "/blog/" -> "index" so we can distinguish the
  // index from individual posts.
  const trimmed = pathname.replace(/^\/blog\/?/, "").replace(/\/$/, "");
  if (trimmed === "") {
    return "index";
  }
  const [first] = trimmed.split("/");
  return first;
}

/** Emits the blog_viewed event on every blog navigation. Renders nothing. */
export default function BlogTracking() {
  const pathname = usePathname();

  useEffect(() => {
    track("blog_viewed", { blog_section: deriveBlogSection(pathname) });
  }, [pathname]);

  return null;
}
