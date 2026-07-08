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
  /** Passed through to CodeBlock. */
  variant?: "plain" | "framed";
  /** Passed through to CodeBlock; header text for the framed variant. */
  label?: string;
}

/**
 * Section identifier sent with code_copied events. Also used by CodeTabs,
 * which tracks copies itself.
 */
export function defaultCodeCopySection(
  pathname: string,
  language: string,
): string {
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
  variant,
  label,
}: TrackableCodeBlockProps) {
  const pathname = usePathname() ?? "";
  return (
    <CodeBlock
      code={code}
      language={language}
      className={className}
      variant={variant}
      label={label}
      showCopyButton
      onCopy={() => {
        track("code_copied", {
          source_page: sourcePage ?? pathname,
          section: section ?? defaultCodeCopySection(pathname, language),
        });
      }}
    />
  );
}
