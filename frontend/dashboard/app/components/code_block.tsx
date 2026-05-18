"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  CODE_BLOCK_THEME_DARK,
  CODE_BLOCK_THEME_LIGHT,
  type CodeBlockLanguage,
  getLoadedHighlighter,
  loadHighlighter,
} from "../utils/highlighter";

interface CodeBlockProps {
  code: string;
  language: CodeBlockLanguage;
  className?: string;
}

function highlightSync(
  code: string,
  language: CodeBlockLanguage,
  theme: string,
): string | null {
  const highlighter = getLoadedHighlighter();
  if (highlighter === null) {
    return null;
  }
  try {
    return highlighter.codeToHtml(code, { lang: language, theme });
  } catch {
    return null;
  }
}

// Shared syntax-highlighted code block. Lazy-loads Shiki on first mount and
// re-highlights on theme change. Renders a plain <pre> while loading (and as
// a permanent fallback if Shiki ever fails to load), so the content is always
// readable and copy/clipboard flows that read from `code` are unaffected.
export default function CodeBlock({
  code,
  language,
  className,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "dark" ? CODE_BLOCK_THEME_DARK : CODE_BLOCK_THEME_LIGHT;

  // Sync initializer: if Shiki has already loaded once in this session,
  // compute the highlighted HTML during the first render so the very first
  // paint after a remount shows the styled code rather than the fallback.
  // Cold start (Shiki not yet loaded) returns null and the effect below
  // fills in the HTML once loadHighlighter resolves.
  const [html, setHtml] = useState<string | null>(() =>
    highlightSync(code, language, theme),
  );

  useEffect(() => {
    let cancelled = false;
    // If the highlighter is already loaded, this resolves the same tick
    // and just re-emits the HTML for the current theme/code/language.
    loadHighlighter()
      .then((highlighter) => {
        if (cancelled) {
          return;
        }
        setHtml(highlighter.codeToHtml(code, { lang: language, theme }));
      })
      .catch(() => {
        // Keep the plain-pre fallback if Shiki fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

  if (html === null) {
    return (
      <pre className={className}>
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
