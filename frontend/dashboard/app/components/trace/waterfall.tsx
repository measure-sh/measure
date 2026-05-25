"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RowSpacerCell,
  RowState,
  SpanCell,
  ThreadCell,
  TimelineCell,
} from "./cells";
import TraceErrorBanner from "./error_banner";
import { WaterfallHeader } from "./header";
import { PreparedSpan, Trace, matchesSearch, prepareTrace } from "./model";
import TraceSidebar from "./sidebar";
import TraceToolbar from "./toolbar";
import { useBrushToZoom } from "./use_brush_zoom";
import { useColumnResizer } from "./use_column_resizer";
import TraceZoomBanner from "./zoom_banner";

const DEFAULT_SPAN_FRACTION = 0.3;
const DEFAULT_LEFT_FRACTION = 0.45;
const SPAN_MIN_FRACTION = 0.1;
const THREAD_MIN_FRACTION = 0.05;
const LEFT_MAX_FRACTION = 0.75;

// Round to 2 decimals — fraction arithmetic can leak floating-point slop
// into the rendered string (e.g. 0.45 - 0.30 = 0.15000000000000002).
const pct = (f: number) => `${Math.round(f * 1e4) / 100}%`;

interface TraceWaterfallProps {
  inputTrace: Trace;
  sessionTimelineNode?: React.ReactNode;
}

const TraceWaterfall: React.FC<TraceWaterfallProps> = ({
  inputTrace,
  sessionTimelineNode,
}) => {
  const prepared = useMemo(() => prepareTrace(inputTrace), [inputTrace]);
  const traceDurationMs = Math.max(inputTrace.duration, 1);

  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(
    undefined,
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [errorIndex, setErrorIndex] = useState(0);
  const [spanColumnFraction, setSpanColumnFraction] = useState(
    DEFAULT_SPAN_FRACTION,
  );
  const [leftColumnFraction, setLeftColumnFraction] = useState(
    DEFAULT_LEFT_FRACTION,
  );
  const [highlightErrors, setHighlightErrors] = useState(false);
  const [hoveredSpanId, setHoveredSpanId] = useState<string | undefined>();
  const [viewStartMs, setViewStartMs] = useState(0);
  const [viewEndMs, setViewEndMs] = useState(traceDurationMs);

  const waterfallRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    setViewStartMs(0);
    setViewEndMs(traceDurationMs);
  }, [traceDurationMs]);

  const viewWindowMs = Math.max(1, viewEndMs - viewStartMs);
  const isZoomed = viewStartMs > 0 || viewEndMs < traceDurationMs;
  const resetZoom = useCallback(() => {
    setViewStartMs(0);
    setViewEndMs(traceDurationMs);
  }, [traceDurationMs]);

  const { startPx: brushStartPx, currentPx: brushCurrentPx } = useBrushToZoom({
    waterfallRef,
    leftColumnFraction,
    viewStartMs,
    viewEndMs,
    traceDurationMs,
    setViewStartMs,
    setViewEndMs,
  });

  // Span↔Thread resizer adjusts the Span column's share of the total width.
  // Constrained so the Thread column never collapses below THREAD_MIN_FRACTION.
  const onSpanResizePointerDown = useColumnResizer({
    containerRef: waterfallRef,
    min: SPAN_MIN_FRACTION,
    max: leftColumnFraction - THREAD_MIN_FRACTION,
    setFraction: setSpanColumnFraction,
  });
  // Thread↔Timeline resizer adjusts the combined left block. Constrained so
  // it can't cross below the Span column (which already takes spanFraction).
  const onLeftResizePointerDown = useColumnResizer({
    containerRef: waterfallRef,
    min: spanColumnFraction + THREAD_MIN_FRACTION,
    max: LEFT_MAX_FRACTION,
    setFraction: setLeftColumnFraction,
  });

  const visibleSpans = useMemo(
    () =>
      prepared.spans.filter(
        (span) => !span.ancestorIds.some((id) => collapsedIds.has(id)),
      ),
    [prepared.spans, collapsedIds],
  );

  const searchMatches = useMemo<PreparedSpan[]>(() => {
    if (!searchQuery) {
      return [];
    }
    return prepared.spans.filter((s) => matchesSearch(s, searchQuery));
  }, [searchQuery, prepared.spans]);

  const matchIdSet = useMemo(
    () => new Set(searchMatches.map((s) => s.span_id)),
    [searchMatches],
  );

  useEffect(() => {
    if (searchIndex >= searchMatches.length) {
      setSearchIndex(0);
    }
  }, [searchMatches, searchIndex]);

  useEffect(() => {
    if (errorIndex >= prepared.errorSpanIds.length) {
      setErrorIndex(0);
    }
  }, [prepared.errorSpanIds, errorIndex]);

  const expandAncestors = useCallback(
    (spanId: string) => {
      const span = prepared.byId.get(spanId);
      if (!span) {
        return;
      }
      if (span.ancestorIds.some((a) => collapsedIds.has(a))) {
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          for (const a of span.ancestorIds) {
            next.delete(a);
          }
          return next;
        });
      }
    },
    [prepared.byId, collapsedIds],
  );

  const selectSpan = useCallback(
    (spanId: string) => {
      expandAncestors(spanId);
      setSelectedSpanId(spanId);
    },
    [expandAncestors],
  );

  const closeSidebar = useCallback(() => {
    setSelectedSpanId(undefined);
  }, []);

  useLayoutEffect(() => {
    if (!selectedSpanId) {
      return;
    }
    const el = rowRefs.current.get(selectedSpanId);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedSpanId]);

  const toggleCollapse = useCallback((spanId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  }, []);

  const cycle = useCallback(
    (
      ids: string[],
      index: number,
      delta: 1 | -1,
      setIndex: (i: number) => void,
    ) => {
      if (ids.length === 0) {
        return;
      }
      const next = (index + delta + ids.length) % ids.length;
      const id = ids[next];
      setIndex(next);
      selectSpan(id);
      // The selectedSpanId useLayoutEffect only fires when the id actually
      // changes — cycling back to the same span (e.g. one match) wouldn't
      // re-scroll. Trigger imperatively after the next paint so collapsed
      // ancestors have expanded and the row's ref is populated.
      requestAnimationFrame(() => {
        const el = rowRefs.current.get(id);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    },
    [selectSpan],
  );

  const searchIds = useMemo(
    () => searchMatches.map((m) => m.span_id),
    [searchMatches],
  );
  const searchNext = () => cycle(searchIds, searchIndex, 1, setSearchIndex);
  const searchPrev = () => cycle(searchIds, searchIndex, -1, setSearchIndex);
  const errorNext = () =>
    cycle(prepared.errorSpanIds, errorIndex, 1, setErrorIndex);
  const errorPrev = () =>
    cycle(prepared.errorSpanIds, errorIndex, -1, setErrorIndex);

  const selectedSpan = selectedSpanId
    ? prepared.byId.get(selectedSpanId)
    : undefined;
  const sidebarOpen = selectedSpan !== undefined;
  const hasErrors = prepared.errorSpanIds.length > 0;
  const hasSearch = searchQuery.length > 0;
  // Error highlight only has a visual effect when there are error spans.
  const errorHighlightActive = highlightErrors && hasErrors;

  // Search and error navigation both cycle through results, which is
  // confusing if both are active at the same time. Reset search to its
  // default state in the same tick as flipping the toggle on, so the
  // counter/buttons don't briefly remain visible.
  const onHighlightErrorsChange = useCallback((v: boolean) => {
    setHighlightErrors(v);
    if (v) {
      setSearchQuery("");
      setSearchIndex(0);
    }
  }, []);

  const rowStates = useMemo<RowState[]>(
    () =>
      visibleSpans.map((span) => {
        const isSelected = span.span_id === selectedSpanId;
        const isError = span.status === 2;
        const isHighlighted = isSelected || (errorHighlightActive && isError);
        return {
          span,
          isSelected,
          isDimmed: (sidebarOpen || errorHighlightActive) && !isHighlighted,
          isSearchMatch: hasSearch && matchIdSet.has(span.span_id),
        };
      }),
    [
      visibleSpans,
      selectedSpanId,
      errorHighlightActive,
      sidebarOpen,
      hasSearch,
      matchIdSet,
    ],
  );

  const cssVars = {
    "--span-col-width": pct(spanColumnFraction),
    "--thread-col-width": pct(leftColumnFraction - spanColumnFraction),
  } as React.CSSProperties;

  const setRowRef = (id: string, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  };

  // Hover-bridge column aligned with a header resizer. Rendered twice
  // (between Span/Thread and between Thread/Timeline) so a hovered row's
  // highlight stays continuous across the gap.
  const renderSpacerColumn = () => (
    <div className="w-1.5 shrink-0 flex flex-col">
      {rowStates.map((rs) => (
        <RowSpacerCell
          key={rs.span.span_id}
          rowState={rs}
          isHovered={hoveredSpanId === rs.span.span_id}
          errorHighlightActive={errorHighlightActive}
          onSelect={() => selectSpan(rs.span.span_id)}
          onHover={setHoveredSpanId}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col w-full font-body text-foreground gap-4">
      <TraceToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchDisabled={errorHighlightActive}
        matchCount={searchMatches.length}
        matchIndex={searchIndex}
        onSearchPrev={searchPrev}
        onSearchNext={searchNext}
        errorCount={prepared.errorSpanIds.length}
        highlightErrors={highlightErrors}
        setHighlightErrors={onHighlightErrorsChange}
        sessionTimelineNode={sessionTimelineNode}
      />

      {errorHighlightActive && (
        <TraceErrorBanner
          count={prepared.errorSpanIds.length}
          index={errorIndex}
          onPrev={errorPrev}
          onNext={errorNext}
        />
      )}

      {isZoomed && (
        <TraceZoomBanner
          startMs={viewStartMs}
          endMs={viewEndMs}
          onReset={resetZoom}
        />
      )}

      <div className="flex flex-row gap-2 min-h-[500px] h-[calc(100vh-220px)] bg-background pr-2">
        <div
          ref={waterfallRef}
          className="relative flex flex-col flex-1 min-w-0"
          style={cssVars}
          data-testid="trace-waterfall"
        >
          {brushStartPx !== null &&
            brushCurrentPx !== null &&
            Math.abs(brushCurrentPx - brushStartPx) > 1 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 bg-primary/15 border-l border-r border-primary z-20"
                style={{
                  left: `${Math.min(brushStartPx, brushCurrentPx)}px`,
                  width: `${Math.abs(brushCurrentPx - brushStartPx)}px`,
                }}
                data-testid="trace-brush-overlay"
              />
            )}
          <div className="overflow-y-auto flex-1">
            <WaterfallHeader
              viewStartMs={viewStartMs}
              viewWindowMs={viewWindowMs}
              onSpanResizePointerDown={onSpanResizePointerDown}
              onLeftResizePointerDown={onLeftResizePointerDown}
            />

            {visibleSpans.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                No spans match the current filters.
              </p>
            )}

            {visibleSpans.length > 0 && (
              <div className="flex flex-row">
                <div
                  className="shrink-0 min-w-0 overflow-x-auto"
                  style={{ width: "var(--span-col-width)" }}
                >
                  <div className="flex flex-col">
                    {rowStates.map((rs) => (
                      <SpanCell
                        key={rs.span.span_id}
                        ref={(el) => setRowRef(rs.span.span_id, el)}
                        rowState={rs}
                        isHovered={hoveredSpanId === rs.span.span_id}
                        isCollapsed={collapsedIds.has(rs.span.span_id)}
                        errorHighlightActive={errorHighlightActive}
                        onSelect={() => selectSpan(rs.span.span_id)}
                        onHover={setHoveredSpanId}
                        onToggleCollapse={toggleCollapse}
                      />
                    ))}
                  </div>
                </div>
                {renderSpacerColumn()}
                <div
                  className="shrink-0 flex flex-col"
                  style={{ width: "var(--thread-col-width)" }}
                >
                  {rowStates.map((rs) => (
                    <ThreadCell
                      key={rs.span.span_id}
                      rowState={rs}
                      isHovered={hoveredSpanId === rs.span.span_id}
                      errorHighlightActive={errorHighlightActive}
                      onSelect={() => selectSpan(rs.span.span_id)}
                      onHover={setHoveredSpanId}
                    />
                  ))}
                </div>
                {renderSpacerColumn()}
                <div className="relative flex-1 min-w-0 flex flex-col">
                  {rowStates.map((rs) => (
                    <TimelineCell
                      key={rs.span.span_id}
                      rowState={rs}
                      isHovered={hoveredSpanId === rs.span.span_id}
                      errorHighlightActive={errorHighlightActive}
                      viewStartMs={viewStartMs}
                      viewWindowMs={viewWindowMs}
                      onSelect={() => selectSpan(rs.span.span_id)}
                      onHover={setHoveredSpanId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {sidebarOpen && (
          <div className="border rounded-md overflow-hidden shrink-0 w-[320px] md:w-[360px] lg:w-[400px] flex flex-col">
            <TraceSidebar
              span={selectedSpan}
              showErrorAsRed={errorHighlightActive}
              onClose={closeSidebar}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TraceWaterfall;
