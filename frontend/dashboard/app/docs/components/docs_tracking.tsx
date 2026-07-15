"use client";

import { track } from "@/app/utils/analytics/track";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function deriveDocSection(pathname: string): string {
  // Drop leading "/docs" and any trailing slash to get the in-docs path.
  // "/docs/android/quickstart" -> first segment "android"; "/docs" or "/docs/"
  // -> "index" so we can distinguish the landing doc from individual sections.
  const trimmed = pathname.replace(/^\/docs\/?/, "").replace(/\/$/, "");
  if (trimmed === "") {
    return "index";
  }
  const [first] = trimmed.split("/");
  return first;
}

/** Emits the docs_viewed event on every docs navigation. Renders nothing. */
export default function DocsTracking() {
  const pathname = usePathname();

  useEffect(() => {
    track("docs_viewed", { doc_section: deriveDocSection(pathname) });
  }, [pathname]);

  return null;
}
