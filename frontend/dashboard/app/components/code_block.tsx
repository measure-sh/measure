"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  CODE_BLOCK_COLOR_REPLACEMENTS,
  CODE_BLOCK_THEME_DARK,
  CODE_BLOCK_THEME_LIGHT,
  type CodeBlockLanguage,
  getLoadedHighlighter,
  loadHighlighter,
} from "../utils/highlighter";
import { cn } from "../utils/shadcn_utils";

// Docs-style card chrome, matching the fumadocs codeblock frame (card
// background, border, xl rounding, shadow) and its code padding. Text
// size is left to the call site; blocks that should sit flat on the page
// (e.g. the common-path steps) skip this and style themselves.
export const CODE_BLOCK_CARD_CLASS =
  "rounded-xl border border-border bg-card shadow-sm overflow-hidden font-code [&_pre]:overflow-x-auto [&_pre]:px-4 [&_pre]:py-3.5";

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
    return highlighter.codeToHtml(code, {
      lang: language,
      theme,
      colorReplacements: CODE_BLOCK_COLOR_REPLACEMENTS,
    });
  } catch {
    return null;
  }
}

// Shared syntax-highlighted code block. Lazy-loads Shiki on first mount and
// re-highlights on theme change. Renders a plain <pre> while loading (and as
// a permanent fallback if Shiki ever fails to load), so the content is always
// readable.
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
        setHtml(
          highlighter.codeToHtml(code, {
            lang: language,
            theme,
            colorReplacements: CODE_BLOCK_COLOR_REPLACEMENTS,
          }),
        );
      })
      .catch(() => {
        // Keep the plain-pre fallback if Shiki fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

  // not-fumadocs-codeblock opts the block out of the fumadocs preset in
  // globals.css, which otherwise pads every .shiki line by 1rem on top of
  // whatever the call site sets. The fallback uses the same wrapper-plus-pre
  // structure as the highlighted output so [&_pre] classes apply to both
  // and the layout doesn't shift when Shiki finishes loading.
  const wrapperClassName = cn("not-fumadocs-codeblock", className);

  if (html === null) {
    return (
      <div className={wrapperClassName}>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className={wrapperClassName}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
