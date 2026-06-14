"use client";

import React from "react";
import { cn } from "../../utils/shadcn_utils";
import { formatMillisToHumanReadable } from "../../utils/time_utils";
import { PreparedSpan, resolveSpanColor } from "./model";

export const ROW_HEIGHT_PX = 48;
export const INDENT_WIDTH_PX = 20;
// Matches the Tailwind `px-2` on the SpanCell + the `mx-2` on the timeline
// inner wrapper, so the row highlight has the same gutter on both sides
// before any content (indent / badge / bar) starts. Flow children shift
// with the padding automatically; cell-level absolute children must add
// this offset explicitly to stay aligned.
const SPAN_LEFT_PADDING_PX = 8;
// Each indent column holds an ancestor line at its centre. The line and the
// dependency-count badge for that depth are vertically aligned, so a row's
// connector can run from the parent's line straight into the centre of the
// child badge's bottom edge.
export const BADGE_SIZE_PX = 20;
export const BADGE_HEIGHT_PX = 16;
const BADGE_CENTER_OFFSET_PX = BADGE_SIZE_PX / 2;
const LEAF_DOT_SIZE_PX = 6;
// Dot is centred inside the BADGE_SIZE_PX-wide wrapper. The horizontal
// connector should stop at the dot's left edge — not its centre — so the
// (potentially differently-coloured) connector doesn't bleed into the dot.
const LEAF_DOT_LEFT_INSET_PX = (BADGE_SIZE_PX - LEAF_DOT_SIZE_PX) / 2;
// Below this width (percent), the duration label renders outside the bar.
const BAR_LABEL_INSIDE_THRESHOLD = 6;

export interface RowState {
  span: PreparedSpan;
  isSelected: boolean;
  isDimmed: boolean;
  isSearchMatch: boolean;
}

export function cellRowClasses(args: {
  isDimmed: boolean;
  isSearchMatch: boolean;
  isHovered: boolean;
  errorHighlightActive: boolean;
}): string {
  return cn(
    "select-none cursor-pointer transition-colors outline-none",
    "focus-visible:ring-ring/50 focus-visible:ring-[2px] focus-visible:ring-inset",
    args.isSearchMatch && "bg-amber-50 dark:bg-amber-950/30",
    args.isHovered && !args.isSearchMatch && "bg-muted/50",
    args.isDimmed &&
      !args.isHovered &&
      (args.errorHighlightActive ? "opacity-30" : "opacity-50"),
  );
}

interface RowCellShellProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onClick" | "onMouseEnter" | "onMouseLeave"
> {
  rowState: RowState;
  isHovered: boolean;
  errorHighlightActive: boolean;
  onSelect: () => void;
  onHover: (id: string | undefined) => void;
}

// Shared wrapper for every row-cell: wires the click + hover handlers,
// applies `cellRowClasses` for the row state, sets the row height, and
// forwards everything else (class, refs, data-* attrs, onKeyDown, etc.)
// to the underlying div.
const RowCellShell = React.forwardRef<HTMLDivElement, RowCellShellProps>(
  (
    {
      rowState: { span, isDimmed, isSearchMatch },
      isHovered,
      errorHighlightActive,
      onSelect,
      onHover,
      className,
      style,
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      {...rest}
      onClick={onSelect}
      onMouseEnter={() => onHover(span.span_id)}
      onMouseLeave={() => onHover(undefined)}
      className={cn(
        className,
        cellRowClasses({
          isDimmed,
          isSearchMatch,
          isHovered,
          errorHighlightActive,
        }),
      )}
      style={{ height: ROW_HEIGHT_PX, ...style }}
    />
  ),
);
RowCellShell.displayName = "RowCellShell";

interface SpanCellProps {
  rowState: RowState;
  isHovered: boolean;
  isCollapsed: boolean;
  errorHighlightActive: boolean;
  onSelect: () => void;
  onHover: (id: string | undefined) => void;
  onToggleCollapse: (id: string) => void;
}

export const SpanCell = React.forwardRef<HTMLDivElement, SpanCellProps>(
  (
    {
      rowState,
      isHovered,
      isCollapsed,
      errorHighlightActive,
      onSelect,
      onHover,
      onToggleCollapse,
    },
    ref,
  ) => {
    const { span } = rowState;
    const color = resolveSpanColor(span, errorHighlightActive);
    const hasFocusableChildren = span.directChildCount > 0;
    const { ancestorColors } = span;

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    };

    return (
      <RowCellShell
        ref={ref}
        rowState={rowState}
        isHovered={isHovered}
        errorHighlightActive={errorHighlightActive}
        onSelect={onSelect}
        onHover={onHover}
        className="relative flex flex-row items-center px-2 shrink-0"
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-span-id={span.span_id}
        data-testid={`span-bar-row-${span.span_id}`}
        aria-label={`Select ${span.span_name}`}
      >
        {span.depth > 0 && (
          <div
            className="relative shrink-0 h-full"
            style={{ width: span.depth * INDENT_WIDTH_PX }}
          >
            {ancestorColors.map((ancestorColor, i) => (
              <div
                key={i}
                className={cn("absolute top-0 bottom-0 w-px", ancestorColor.bg)}
                style={{ left: i * INDENT_WIDTH_PX + BADGE_CENTER_OFFSET_PX }}
              />
            ))}
          </div>
        )}

        {hasFocusableChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(span.span_id);
            }}
            className={cn(
              "shrink-0 inline-flex items-center justify-center text-[10px] font-display rounded-[3px] border mr-1.5 transition-colors",
              isCollapsed
                ? cn(color.bg, "border-transparent text-primary-foreground")
                : cn(color.border, "bg-transparent text-foreground"),
            )}
            style={{
              minWidth: BADGE_SIZE_PX,
              height: BADGE_HEIGHT_PX,
            }}
            aria-label={
              isCollapsed
                ? `Expand ${span.span_name}`
                : `Collapse ${span.span_name}`
            }
            title={
              isCollapsed
                ? `Expand (${span.subtreeSize} hidden)`
                : `Collapse (${span.directChildCount} direct)`
            }
          >
            {isCollapsed ? span.subtreeSize : span.directChildCount}
          </button>
        ) : (
          <span
            className="shrink-0 inline-flex items-center justify-center mr-1.5"
            style={{ width: BADGE_SIZE_PX, height: BADGE_HEIGHT_PX }}
            aria-hidden="true"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", color.bg)} />
          </span>
        )}

        <span
          className="text-xs whitespace-nowrap shrink-0 font-display"
          title={span.span_name}
        >
          {span.span_name}
        </span>

        {span.depth > 0 && (
          <div
            className={cn(
              "absolute h-px pointer-events-none",
              ancestorColors[span.depth - 1].bg,
            )}
            style={{
              left:
                SPAN_LEFT_PADDING_PX +
                (span.depth - 1) * INDENT_WIDTH_PX +
                BADGE_CENTER_OFFSET_PX,
              width:
                INDENT_WIDTH_PX -
                BADGE_CENTER_OFFSET_PX +
                (hasFocusableChildren ? 0 : LEAF_DOT_LEFT_INSET_PX),
              top: "50%",
              transform: "translateY(-50%)",
            }}
            aria-hidden="true"
          />
        )}

        {hasFocusableChildren && !isCollapsed && (
          <div
            className={cn("absolute w-px pointer-events-none", color.bg)}
            style={{
              left:
                SPAN_LEFT_PADDING_PX +
                span.depth * INDENT_WIDTH_PX +
                BADGE_CENTER_OFFSET_PX,
              top: `calc(50% + ${BADGE_HEIGHT_PX / 2}px)`,
              bottom: 0,
            }}
            aria-hidden="true"
          />
        )}
      </RowCellShell>
    );
  },
);
SpanCell.displayName = "SpanCell";

interface RowCellProps {
  rowState: RowState;
  isHovered: boolean;
  errorHighlightActive: boolean;
  onSelect: () => void;
  onHover: (id: string | undefined) => void;
}

export const ThreadCell: React.FC<RowCellProps> = (props) => (
  <RowCellShell
    {...props}
    className="flex flex-row items-center px-2 text-xs text-muted-foreground"
    title={props.rowState.span.thread_name}
  >
    <span className="truncate">{props.rowState.span.thread_name}</span>
  </RowCellShell>
);

// Per-row spacer that bridges the visual gap between sibling columns so a
// hovered row reads as one continuous strip.
export const RowSpacerCell: React.FC<RowCellProps> = (props) => (
  <RowCellShell {...props} aria-hidden="true" />
);

interface TimelineCellProps extends RowCellProps {
  viewStartMs: number;
  viewWindowMs: number;
}

export const TimelineCell: React.FC<TimelineCellProps> = ({
  viewStartMs,
  viewWindowMs,
  ...rest
}) => {
  const { span } = rest.rowState;
  const color = resolveSpanColor(span, rest.errorHighlightActive);

  const leftPercent = ((span.startMs - viewStartMs) / viewWindowMs) * 100;
  const widthPercent = Math.max((span.duration / viewWindowMs) * 100, 0.4);
  const isOutOfView = leftPercent >= 100 || leftPercent + widthPercent <= 0;
  const clampedLeft = Math.max(0, leftPercent);
  const clampedRight = Math.min(100, leftPercent + widthPercent);
  const clampedWidth = Math.max(clampedRight - clampedLeft, 0.4);

  const labelInside = clampedWidth >= BAR_LABEL_INSIDE_THRESHOLD;
  const labelOnRight =
    !labelInside && 100 - clampedLeft - clampedWidth >= clampedLeft;
  const durationText = formatMillisToHumanReadable(span.duration);

  return (
    <RowCellShell {...rest} className="relative">
      {/* Inner positioning context with mx-2 so the bar's 0%/100% leaves a
          visible gutter on each side inside the cell — matches the tick
          ruler so labels still line up with bar ends. */}
      <div className="relative h-full mx-2">
        {!isOutOfView && (
          <>
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-5 rounded-sm flex flex-row items-center overflow-visible",
                color.bg,
              )}
              style={{
                left: `${clampedLeft}%`,
                width: `${clampedWidth}%`,
              }}
              data-testid="span-bar"
            >
              {labelInside && (
                <span className="px-1.5 text-[10px] font-display whitespace-nowrap pointer-events-none text-primary-foreground">
                  {durationText}
                </span>
              )}
            </div>

            {!labelInside && labelOnRight && (
              <span
                className="absolute top-1/2 -translate-y-1/2 ml-1 text-[10px] text-muted-foreground font-display whitespace-nowrap pointer-events-none"
                style={{ left: `${clampedLeft + clampedWidth}%` }}
              >
                {durationText}
              </span>
            )}
            {!labelInside && !labelOnRight && (
              <span
                className="absolute top-1/2 -translate-y-1/2 mr-1 text-[10px] text-muted-foreground font-display whitespace-nowrap pointer-events-none"
                style={{ right: `${100 - clampedLeft}%` }}
              >
                {durationText}
              </span>
            )}

            {span.checkpoints?.map((cp, idx) => {
              const cpPercent =
                ((cp.startMs - viewStartMs) / viewWindowMs) * 100;
              if (cpPercent < -1 || cpPercent > 101) {
                return null;
              }
              return (
                <div
                  key={cp.name + idx}
                  className="absolute w-0.75 h-0.75 rounded-full pointer-events-none bg-primary-foreground"
                  style={{
                    left: `${cpPercent}%`,
                    top: "calc(50% + 5px)",
                    transform: "translate(-50%, -50%)",
                  }}
                  title={`${cp.name} @ ${formatMillisToHumanReadable(cp.startMs - span.startMs)}`}
                  data-testid={`span-checkpoint-${cp.name}`}
                />
              );
            })}
          </>
        )}
      </div>
    </RowCellShell>
  );
};
