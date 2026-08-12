"use client";

import { useEffect, useRef } from "react";
import type { ExprToken } from "./parse";
import type { FilterExprIssue } from "../../api/api_error";

// A transparent textarea is layered over a copy of the same text split into
// coloured spans, so the caret and the selection are the browser's own
// while we control the syntax highlighting.

interface FilterTextEditorProps {
  value: string;
  tokens: ExprToken[];
  issues: FilterExprIssue[];
  parserStopped: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

// Both layers use these classes and must be laid out identically—including
// padding and line height—or the characters will drift apart when the filter
// wraps. Horizontal padding is provided by the surrounding bar so the text
// starts where the conditions it represents begin.
const layout =
  "py-[3px] font-code text-sm leading-[30px] whitespace-pre-wrap break-words";

const tokenColours: Record<ExprToken["kind"], string> = {
  key: "text-foreground",
  operator: "text-muted-foreground",
  value: "text-sky-700 dark:text-sky-300",
  logical: "text-purple-700 dark:text-purple-300 uppercase",
  paren: "text-foreground",
  punctuation: "text-muted-foreground",
};

export default function FilterTextEditor({
  value,
  tokens,
  issues,
  parserStopped,
  placeholder,
  onChange,
  onApply,
  onCancel,
}: FilterTextEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drawnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  return (
    <div className="relative w-full">
      {/* Matches the textarea's height and scroll position so both layers stay aligned. */}
      <div
        ref={drawnRef}
        aria-hidden
        className={`${layout} min-h-9 max-h-96 overflow-hidden`}
      >
        <Highlighted
          value={value}
          tokens={tokens}
          issues={issues}
          parserStopped={parserStopped}
        />
      </div>

      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        spellCheck={false}
        autoComplete="off"
        aria-label="Filter expression"
        aria-invalid={issues.length > 0}
        data-testid="filter-text"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onApply();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={onApply}
        // The filter scrolls the textarea so the caret stays visible as
        // it moves past the bottom. The copy underneath mirrors its scroll
        // position. Its scrollbar is hidden to keep its text aligned with
        // the overlaid copy.
        onScroll={(e) => {
          if (drawnRef.current) {
            drawnRef.current.scrollTop = e.currentTarget.scrollTop;
          }
        }}
        // The text is transparent so the highlighted copy underneath shows through.
        // The caret inherits the text colour unless given its own, so set it back
        // explicitly here.
        className={`${layout} absolute inset-0 h-full w-full resize-none overflow-y-auto [scrollbar-none] [&::-webkit-scrollbar]:hidden bg-transparent text-transparent caret-foreground outline-none placeholder:text-muted-foreground`}
      />
    </div>
  );
}

// Draws one span per token, leaving the text between tokens plain, so the
// highlighted copy contains every character in the filter and stays aligned
// with the textarea layered over it.
function Highlighted({
  value,
  tokens,
  issues,
  parserStopped,
}: {
  value: string;
  tokens: ExprToken[];
  issues: FilterExprIssue[];
  parserStopped: boolean;
}) {
  // Token start and end are code-point offsets rather than string indices, so
  // the text is split the same way the parser split it.
  const runes = Array.from(value);
  const slice = (start: number, end: number) =>
    runes.slice(start, end).join("");

  const spans = issues
    .map((issue) => issue.span)
    .filter((span) => span !== undefined);
  const isMarked = (token: ExprToken) =>
    spans.some((span) => token.start >= span.start && token.end <= span.end);

  const marked = "underline decoration-wavy decoration-destructive";
  const highlighted: React.ReactNode[] = [];
  let at = 0;

  for (const token of tokens) {
    if (token.start > at) {
      highlighted.push(<span key={`gap-${at}`}>{slice(at, token.start)}</span>);
    }

    highlighted.push(
      <span
        key={`token-${token.start}`}
        className={`${tokenColours[token.kind]} ${
          isMarked(token) ? marked : ""
        }`}
      >
        {token.text}
      </span>,
    );
    at = token.end;
  }

  if (at < runes.length) {
    highlighted.push(
      // Only the parser giving up leaves text past the last token to mark.
      <span key="past-tokens" className={parserStopped ? marked : ""}>
        {slice(at, runes.length)}
      </span>,
    );
  }

  return highlighted;
}
