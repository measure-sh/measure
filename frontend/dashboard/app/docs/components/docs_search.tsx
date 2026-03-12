"use client";

import { Command } from "cmdk";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface SearchEntry {
  slug: string;
  title: string;
  headings: string[];
  content: string;
}

interface ScoredResult {
  entry: SearchEntry;
  snippet: string;
}

export function getMatchSnippet(content: string, terms: string[]): string {
  const contentLower = content.toLowerCase();
  let bestIndex = -1;

  // Find earliest match position
  for (const term of terms) {
    const idx = contentLower.indexOf(term);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    return "";
  }

  const start = Math.max(0, bestIndex - 40);
  const end = Math.min(content.length, bestIndex + 80);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();

  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

export function highlightTerms(text: string, query: string): React.ReactNode {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, i) =>
    terms.some((t) => part.toLowerCase() === t) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-300 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function DocsSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [results, setResults] = useState<ScoredResult[]>([]);
  const loaded = useRef(false);

  // Load search index on first open
  useEffect(() => {
    if (open && !loaded.current) {
      loaded.current = true;
      fetch("/docs/search-index.json")
        .then((res) => res.json())
        .then((data: SearchEntry[]) => setEntries(data))
        .catch(() => { });
    }
  }, [open]);

  // Simple client-side search
  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = entries
        .map((entry) => {
          const titleLower = entry.title.toLowerCase();
          const headingsLower = entry.headings.join(" ").toLowerCase();
          const contentLower = entry.content.toLowerCase();

          let score = 0;
          for (const term of terms) {
            if (titleLower.includes(term)) {
              score += 10;
            }
            if (headingsLower.includes(term)) {
              score += 5;
            }
            if (contentLower.includes(term)) {
              score += 1;
            }
          }
          const snippet = getMatchSnippet(entry.content, terms);
          return { entry, score, snippet };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setResults(scored);
    },
    [entries]
  );

  useEffect(() => {
    search(query);
  }, [query, search]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (slug: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/docs${slug === "/" ? "" : slug}`);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Command
          className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center px-3 py-2 gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search documentation..."
              className="flex h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none placeholder:text-muted-foreground font-body md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              autoFocus
            />
            <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">esc</kbd>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            {query.trim() && results.length === 0 && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground font-body">
                No results found.
              </Command.Empty>
            )}
            {results.map(({ entry, snippet }) => (
              <Command.Item
                key={entry.slug}
                value={entry.slug}
                onSelect={() => handleSelect(entry.slug)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer aria-selected:bg-muted font-body"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5 self-start" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{entry.title}</p>
                  {snippet ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {highlightTerms(snippet, query)}
                    </p>
                  ) : entry.headings.length > 0 ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.headings.slice(0, 3).join(" / ")}
                    </p>
                  ) : null}
                </div>
              </Command.Item>
            ))}
            {!query.trim() && entries.length > 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground font-body">
                Type to search documentation...
              </div>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
