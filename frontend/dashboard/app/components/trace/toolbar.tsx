"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import React from "react";
import { Input } from "../input";
import { Switch } from "../switch";

interface TraceToolbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchDisabled?: boolean;
  matchCount: number;
  matchIndex: number;
  onSearchPrev: () => void;
  onSearchNext: () => void;
  errorCount: number;
  highlightErrors: boolean;
  setHighlightErrors: (v: boolean) => void;
  sessionTimelineNode?: React.ReactNode;
}

const TraceToolbar: React.FC<TraceToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  searchDisabled = false,
  matchCount,
  matchIndex,
  onSearchPrev,
  onSearchNext,
  errorCount,
  highlightErrors,
  setHighlightErrors,
  sessionTimelineNode,
}) => {
  const hasSearch = searchQuery.length > 0;
  const hasErrors = errorCount > 0;

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      <div className="relative flex flex-row items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search spans, attributes, checkpoints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs pl-7 pr-2 w-80"
          disabled={searchDisabled}
          aria-label="Search spans, attributes, checkpoints..."
        />
        {hasSearch && (
          <div className="flex flex-row items-center ml-2 gap-1 text-xs select-none">
            <span className="text-muted-foreground">
              {matchCount === 0
                ? "0 matches"
                : `${matchIndex + 1} / ${matchCount}`}
            </span>
            <button
              type="button"
              onClick={onSearchPrev}
              disabled={matchCount === 0}
              className="p-1 rounded-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Previous match"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onSearchNext}
              disabled={matchCount === 0}
              className="p-1 rounded-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Next match"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-1 rounded-sm hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex flex-row items-center gap-4">
        {sessionTimelineNode}
        <label className="flex flex-row items-center gap-2 cursor-pointer select-none">
          <span className="text-xs font-display">
            Show errors{hasErrors ? ` (${errorCount})` : ""}
          </span>
          <Switch
            checked={highlightErrors}
            onCheckedChange={setHighlightErrors}
            aria-label="Show errors"
          />
        </label>
      </div>
    </div>
  );
};

export default TraceToolbar;
