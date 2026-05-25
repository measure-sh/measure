"use client";

import { usePathname } from "next/navigation";
import type { CodeBlockLanguage } from "@/app/utils/highlighter";
import { track } from "@/app/utils/analytics/track";
import CodeBlock from "@/app/components/code_block";

interface TrackableCodeBlockProps {
  code: string;
  language: CodeBlockLanguage;
  className?: string;
  /**
   * Optional override for the section identifier sent with code_copied.
   * When not provided, falls back to "<first-path-segment>-<language>".
   */
  section?: string;
  /** Optional override for source_page. Defaults to the current pathname. */
  sourcePage?: string;
}

function defaultSection(pathname: string, language: string): string {
  const trimmed = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const segments = trimmed.split("/").filter(Boolean);
  // For docs pages, skip the leading "docs" segment so sections track per topic
  // (e.g. "android-kotlin", "ios-swift") rather than always "docs-...".
  const meaningful = segments[0] === "docs" ? segments.slice(1) : segments;
  const base = meaningful.join("-") || "index";
  return `${base}-${language}`;
}

export default function TrackableCodeBlock({
  code,
  language,
  className,
  section,
  sourcePage,
}: TrackableCodeBlockProps) {
  const pathname = usePathname() ?? "";
  return (
    <CodeBlock
      code={code}
      language={language}
      className={className}
      showCopyButton
      onCopy={() => {
        track("code_copied", {
          source_page: sourcePage ?? pathname,
          section: section ?? defaultSection(pathname, language),
        });
      }}
    />
  );
}
