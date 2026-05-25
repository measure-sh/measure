"use client";

import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  CODE_BLOCK_THEME_DARK,
  CODE_BLOCK_THEME_LIGHT,
  type CodeBlockLanguage,
  getLoadedHighlighter,
  loadHighlighter,
} from "../utils/highlighter";
import { cn } from "../utils/shadcn_utils";

interface CodeBlockProps {
  code: string;
  language: CodeBlockLanguage;
  className?: string;
  /** Render a copy-to-clipboard button overlaid on the code block. */
  showCopyButton?: boolean;
  /** Fired after a successful copy; used by call sites for tracking. */
  onCopy?: () => void;
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
  showCopyButton = false,
  onCopy,
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
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        if (onCopy) {
          onCopy();
        }
      })
      .catch(() => {
        // Silently ignore — the user can still select and copy manually.
      });
  };

  const copyButton = showCopyButton ? (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  ) : null;

  if (html === null) {
    if (showCopyButton) {
      return (
        <div className={cn("group relative", className)}>
          {copyButton}
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    return (
      <pre className={className}>
        <code>{code}</code>
      </pre>
    );
  }

  if (showCopyButton) {
    return (
      <div className={cn("group relative", className)}>
        {copyButton}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
