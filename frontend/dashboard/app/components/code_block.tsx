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

// Framed code block pieces, shared with docs CodeTabs which builds the same
// frame around multiple stacked panels.
export const CODE_FRAME_CLASS =
  "code-frame rounded-2xl border border-border bg-muted/40 p-0.5";
export const CODE_FRAME_HEADER_CLASS =
  "flex min-h-8 items-center justify-between gap-2 py-0.5 pl-3.5 pr-1";
export const CODE_FRAME_PANEL_CLASS =
  "overflow-hidden rounded-xl bg-background font-code text-sm leading-6 [&_pre]:overflow-x-auto [&_pre]:px-4 [&_pre]:py-3.5";

export function CopyCodeButton({
  code,
  onCopy,
  className,
}: {
  code: string;
  /** Fired after a successful copy; used by call sites for tracking. */
  onCopy?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

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

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

interface CodeBlockProps {
  code: string;
  language: CodeBlockLanguage;
  className?: string;
  /** Render a copy-to-clipboard button on the code block. */
  showCopyButton?: boolean;
  /** Fired after a successful copy; used by call sites for tracking. */
  onCopy?: () => void;
  /**
   * "plain" renders the highlighted block as-is. "framed" wraps it in a
   * bordered container with a header row holding `label` and an
   * always-visible copy button.
   */
  variant?: "plain" | "framed";
  /** Header text for the framed variant, e.g. the language name. */
  label?: string;
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
  variant = "plain",
  label,
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

  const overlayCopyButton = showCopyButton ? (
    <CopyCodeButton
      code={code}
      onCopy={onCopy}
      className="absolute top-2 right-2 z-10 rounded-md border border-border bg-background/80 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    />
  ) : null;

  if (variant === "framed") {
    const content =
      html === null ? (
        <pre>
          <code>{code}</code>
        </pre>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      );
    // Without a label there is nothing to put in a header bar, so the block
    // is a single bordered panel with the copy button floating over the
    // code's top-right corner.
    if (label === undefined || label === "") {
      return (
        <div
          className={cn(
            CODE_FRAME_PANEL_CLASS,
            "code-frame relative rounded-2xl border border-border",
            className,
          )}
        >
          {showCopyButton && (
            <CopyCodeButton
              code={code}
              onCopy={onCopy}
              className="absolute top-1.5 right-1.5 z-10"
            />
          )}
          {content}
        </div>
      );
    }
    return (
      <div className={cn(CODE_FRAME_CLASS, className)}>
        <div className={CODE_FRAME_HEADER_CLASS}>
          <span className="font-code text-xs text-muted-foreground">
            {label}
          </span>
          {showCopyButton && <CopyCodeButton code={code} onCopy={onCopy} />}
        </div>
        <div className={CODE_FRAME_PANEL_CLASS}>{content}</div>
      </div>
    );
  }

  if (html === null) {
    if (showCopyButton) {
      return (
        <div className={cn("group relative", className)}>
          {overlayCopyButton}
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
        {overlayCopyButton}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
