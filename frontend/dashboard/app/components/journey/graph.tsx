"use client";

import type {
  Journey,
  JourneyNode,
  JourneySelection,
} from "@/app/api/api_calls";
import { useChartColor } from "@/app/utils/chart_utils";
import { Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../button";
import {
  PlotTooltipArea,
  PlotTooltipSwatch,
  useTooltipTaps,
} from "../plot_tooltip";
import { formatUsers, KIND_LABELS, shortName, useKindColours } from "./format";
import { extendSelection, highlightOf } from "./highlight";
import {
  fit,
  layOut,
  linkPath,
  NODE_HEIGHT,
  NODE_WIDTH,
  type View,
  zoomAround,
} from "./graph_layout";
import { LinkTooltip, linkTapKey, NodeTooltip, nodeTapKey } from "./tooltips";

const KINDS: JourneyNode["kind"][] = ["screen", "event", "fatal"];
const MAX_LABEL_CHARS = 20;
// Moving the pointer further than this between press and release counts as a
// drag, so the release doesn't also click the node or link under it.
const DRAG_THRESHOLD = 4;
const FIT_INSET = { top: 16, bottom: 16 };

type LinkState = "default" | "lit" | "dimmed" | "selected";

// Dimmed links draw first and the selected link last, so the links that
// matter stay on top of the rest.
const LINK_ORDER: Record<LinkState, number> = {
  dimmed: 0,
  default: 1,
  lit: 2,
  selected: 3,
};

type Hover =
  | { kind: "node"; node: JourneyNode }
  | { kind: "link"; link: Journey["links"][number] };

type Drag = { startX: number; startY: number; view: View; dragged: boolean };

function Gesture({ keys, action }: { keys: string[]; action: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && "+"}
          <kbd className="rounded border bg-muted px-1 font-body text-[0.65rem] leading-4 text-foreground">
            {key}
          </kbd>
        </Fragment>
      ))}
      {` ${action}`}
    </span>
  );
}

function label(name: string): string {
  const short = shortName(name);
  return short.length > MAX_LABEL_CHARS
    ? `${short.slice(0, MAX_LABEL_CHARS - 1)}…`
    : short;
}

export default function JourneyGraph({
  journey,
  selection = null,
  onSelect,
  toolbarStart,
  toolbarEnd,
  placeholder,
  summary,
}: {
  journey: Journey;
  selection?: JourneySelection | null;
  onSelect?: (selection: JourneySelection | null) => void;
  // Controls the toolbar shows before the clear button, and before the zoom
  // buttons.
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  // Shown in the canvas in place of the nodes, such as while the journey loads
  // or when it has no nodes. The toolbar stays usable.
  placeholder?: React.ReactNode;
  // Shown in the footer before the gestures the graph supports.
  summary?: React.ReactNode[];
}) {
  const chartColor = useChartColor();
  const kindColours = useKindColours();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The view the user panned or zoomed to, kept only for the journey it was
  // made on, so a new journey starts fitted to the container.
  const [moved, setMoved] = useState<{ journey: Journey; view: View } | null>(
    null,
  );
  // Hover state belongs to the journey it was set on. A new journey has its own
  // nodes and links and refits the view, so a kept hover could describe a node
  // or link the graph no longer shows.
  const [hoverState, setHoverState] = useState<{
    journey: Journey;
    hover: Hover;
  } | null>(null);
  const hover =
    hoverState !== null && hoverState.journey === journey
      ? hoverState.hover
      : null;
  const setHover = (next: Hover | null) =>
    setHoverState(next === null ? null : { journey, hover: next });
  // A touch pointer enters on press and leaves on lift. So pointer enter and
  // leave update hover only for a mouse or pen; on touch, a press on a node or
  // link shows its tooltip, and a press elsewhere hides it.
  const hoverWithoutTouch = (event: React.PointerEvent, next: Hover | null) => {
    if (event.pointerType !== "touch") {
      setHover(next);
    }
  };
  const hoverOnTouch = (event: React.PointerEvent, next: Hover) => {
    if (event.pointerType === "touch") {
      setHover(next);
    }
  };
  const tooltipTaps = useTooltipTaps();
  // A finger lifts off the node or link, so its tooltip closes when the next
  // tap selects it. A mouse stays over the target, so its tooltip stays open.
  const pressPointerType = useRef<string | null>(null);
  const closeTouchTooltip = () => {
    if (pressPointerType.current === "touch") {
      setHover(null);
    }
  };

  // A touch pointer leaves a node or link when the finger lifts, so the hover
  // stays until the next press outside the canvas.
  useEffect(() => {
    const doc = containerRef.current?.ownerDocument;
    if (hover === null || !doc) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" &&
        !containerRef.current?.contains(event.target as Node)
      ) {
        setHover(null);
      }
    };
    doc.addEventListener("pointerdown", onPointerDown, true);
    return () => doc.removeEventListener("pointerdown", onPointerDown, true);
  }, [hover]);
  // Kept until the next press, so the click that follows a drag's release can
  // tell it ended a drag.
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const layout = useMemo(() => layOut(journey), [journey]);
  const view =
    moved !== null && moved.journey === journey
      ? moved.view
      : fit(layout, size.width, size.height, FIT_INSET);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  const setView = (next: View) => setMoved({ journey, view: next });
  const zoomAt = (px: number, py: number, factor: number) =>
    setView(zoomAround(viewRef.current, px, py, factor));

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Plain scrolling is left to the page so the graph doesn't trap it. Pinch
  // gestures arrive as wheel events with ctrlKey set, so they zoom too. React
  // registers wheel listeners as passive, which can't stop the page zooming,
  // so this one is added directly.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        Math.exp(-event.deltaY * 0.01),
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  });

  const pointerAt = (event: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const wasDrag = () => drag.current?.dragged ?? false;

  const highlight = highlightOf(journey, selection);
  const selectedNodeId =
    selection !== null && "node" in selection ? selection.node : null;
  const path = selection !== null && "path" in selection ? selection.path : [];
  // During a path, a click without shift clears the path. A selection of the
  // clicked node alone would look like the path going on from that node.
  const clickClears = (id: string) => path.length > 0 || id === selectedNodeId;
  // A path can go through a node more than once. Thus a node can have more
  // than one step number.
  const pathSteps = new Map<string, number[]>();
  path.forEach((id, i) =>
    pathSteps.set(id, [...(pathSteps.get(id) ?? []), i + 1]),
  );

  const linkStyles: Record<LinkState, { colour: string; opacity: number }> = {
    default: { colour: "var(--muted-foreground)", opacity: 0.35 },
    lit: { colour: "var(--muted-foreground)", opacity: 0.6 },
    dimmed: { colour: "var(--muted-foreground)", opacity: 0.03 },
    selected: { colour: chartColor.blue, opacity: 0.95 },
  };
  const maxUsers = Math.max(1, ...journey.links.map((l) => l.users));
  const thickness = (users: number) => 1.5 + 5.5 * Math.sqrt(users / maxUsers);

  const links = journey.links
    .flatMap((link) => {
      const source = layout.boxes.get(link.source);
      const target = layout.boxes.get(link.target);
      if (!source || !target) {
        return [];
      }
      const state: LinkState = highlight.isSelectedLink(link)
        ? "selected"
        : !highlight.active
          ? "default"
          : highlight.isLitLink(link)
            ? "lit"
            : "dimmed";
      return [{ link, state, path: linkPath(source, target) }];
    })
    .sort((a, b) => LINK_ORDER[a.state] - LINK_ORDER[b.state]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border select-none">
      <div className="flex items-center gap-2 border-b p-2">
        {toolbarStart}
        {onSelect && selection !== null && (
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Clear selection"
            onClick={() => onSelect(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {toolbarEnd}
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomAt(size.width / 2, size.height / 2, 1.25)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomAt(size.width / 2, size.height / 2, 0.8)}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Fit to view"
            onClick={() => setMoved(null)}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <PlotTooltipArea
        placement="corner"
        className="contents"
        taps={tooltipTaps}
      >
        <div
          ref={containerRef}
          className="relative min-h-0 flex-1 overflow-hidden touch-none"
          style={{
            cursor:
              placeholder !== undefined
                ? undefined
                : dragging
                  ? "grabbing"
                  : "grab",
          }}
          onPointerDownCapture={(event) => {
            pressPointerType.current = event.pointerType;
            if (event.pointerType === "touch") {
              setHover(null);
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            const p = pointerAt(event);
            drag.current = {
              startX: p.x,
              startY: p.y,
              view: viewRef.current,
              dragged: false,
            };
          }}
          onPointerMove={(event) => {
            const p = pointerAt(event);
            const d = drag.current;
            if (d !== null && event.buttons === 1) {
              const dx = p.x - d.startX;
              const dy = p.y - d.startY;
              if (!d.dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
                d.dragged = true;
                setDragging(true);
                setHover(null);
                event.currentTarget.setPointerCapture(event.pointerId);
              }
              if (d.dragged) {
                setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
                return;
              }
            }
          }}
          onPointerUp={(event) => {
            if (wasDrag()) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDragging(false);
          }}
          onPointerLeave={(event) => hoverWithoutTouch(event, null)}
        >
          {placeholder !== undefined ? (
            <div className="absolute inset-0">{placeholder}</div>
          ) : (
            <svg width={size.width} height={size.height} className="block">
              <defs>
                {Object.entries(linkStyles).map(([state, style]) => (
                  <marker
                    key={state}
                    id={`journey-arrow-${state}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerUnits="userSpaceOnUse"
                    markerWidth="11"
                    markerHeight="11"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L10,5 L0,10 z"
                      fill={style.colour}
                      fillOpacity={
                        state === "dimmed"
                          ? style.opacity
                          : Math.min(1, style.opacity + 0.25)
                      }
                    />
                  </marker>
                ))}
              </defs>
              <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {links.map(({ link, state, path }) => (
                  <g key={`${link.source}>${link.target}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke={linkStyles[state].colour}
                      strokeOpacity={linkStyles[state].opacity}
                      strokeWidth={thickness(link.users)}
                      markerEnd={`url(#journey-arrow-${state})`}
                    />
                    {/* A wider, invisible copy of the link that takes the pointer,
                      so thin links are easy to hover and click. */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(12, thickness(link.users) + 6)}
                      className={onSelect ? "cursor-pointer" : undefined}
                      onPointerEnter={(event) =>
                        !dragging &&
                        hoverWithoutTouch(event, { kind: "link", link })
                      }
                      onPointerLeave={(event) => hoverWithoutTouch(event, null)}
                      onPointerDown={(event) =>
                        hoverOnTouch(event, { kind: "link", link })
                      }
                      onClick={() => {
                        if (
                          !wasDrag() &&
                          tooltipTaps.shouldAct(
                            linkTapKey(link.source, link.target),
                          )
                        ) {
                          closeTouchTooltip();
                          onSelect?.({
                            source: link.source,
                            target: link.target,
                          });
                        }
                      }}
                    />
                  </g>
                ))}
                {[...layout.boxes.values()].map(({ node, x, y }) => {
                  const colour = kindColours[node.kind];
                  const isSelected = highlight.isSelectedNode(node.id);
                  const stepLabel = pathSteps.get(node.id)?.join(",");
                  const isNext =
                    onSelect !== undefined && highlight.isNextNode(node.id);
                  const isLit = highlight.isLitNode(node.id);
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x},${y})`}
                      opacity={
                        !highlight.active || isSelected
                          ? 1
                          : isLit
                            ? 0.85
                            : 0.12
                      }
                      className={
                        onSelect ? "group/node cursor-pointer" : undefined
                      }
                      onPointerEnter={(event) =>
                        !dragging &&
                        hoverWithoutTouch(event, { kind: "node", node })
                      }
                      onPointerLeave={(event) => hoverWithoutTouch(event, null)}
                      onPointerDown={(event) =>
                        hoverOnTouch(event, { kind: "node", node })
                      }
                      onClick={(event) => {
                        if (
                          wasDrag() ||
                          !tooltipTaps.shouldAct(nodeTapKey(node.id))
                        ) {
                          return;
                        }
                        closeTouchTooltip();
                        const next = event.shiftKey
                          ? extendSelection(journey, selection, node)
                          : clickClears(node.id)
                            ? null
                            : { node: node.id };
                        if (next !== selection) {
                          onSelect?.(next);
                        }
                      }}
                    >
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx={8}
                        fill="var(--background)"
                      />
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx={8}
                        fill={colour}
                        fillOpacity={isSelected ? 0.3 : 0.1}
                        stroke={colour}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className={
                          isSelected
                            ? undefined
                            : "transition-[fill-opacity] group-hover/node:[fill-opacity:0.2] group-active/node:[fill-opacity:0.3]"
                        }
                      />
                      <text
                        x={12}
                        y={18}
                        fontSize={12}
                        fill="var(--foreground)"
                        className="font-body"
                      >
                        {label(node.name)}
                      </text>
                      <text
                        x={12}
                        y={34}
                        fontSize={11}
                        fill={
                          isLit
                            ? "var(--foreground)"
                            : "var(--muted-foreground)"
                        }
                        fillOpacity={isLit ? 0.8 : 1}
                        className="font-body"
                      >
                        {formatUsers(node.users)}
                      </text>
                      {stepLabel && (
                        <g transform={`translate(${NODE_WIDTH - 8},0)`}>
                          <rect
                            x={-stepLabel.length * 3.5 - 7}
                            y={-9}
                            width={stepLabel.length * 7 + 14}
                            height={18}
                            rx={9}
                            fill={colour}
                            stroke={colour}
                            strokeWidth={1.5}
                          />
                          <text
                            y={4}
                            fontSize={11}
                            textAnchor="middle"
                            fill="var(--background)"
                            className="font-body"
                          >
                            {stepLabel}
                          </text>
                        </g>
                      )}
                      {!stepLabel && isNext && (
                        <g
                          transform={`translate(${NODE_WIDTH - 8},0)`}
                          aria-label={`Add ${shortName(node.name)} to the path`}
                          className="group"
                          style={{ "--badge": colour } as React.CSSProperties}
                          // A click on the plus adds the node to the path, like a
                          // shift-click. The click stops here, so the node's own
                          // click handler does not also select the node alone.
                          onClick={(event) => {
                            event.stopPropagation();
                            if (
                              !wasDrag() &&
                              tooltipTaps.shouldAct(nodeTapKey(node.id))
                            ) {
                              closeTouchTooltip();
                              onSelect?.(
                                extendSelection(journey, selection, node),
                              );
                            }
                          }}
                        >
                          {/* A CSS transform replaces the transform attribute of
                            the same element. Thus the hover and press scale is on
                            this inner group, and the outer group keeps the plus
                            in position. */}
                          <g className="origin-center transition-transform transform-fill group-hover:scale-125 group-active:scale-90">
                            <rect
                              x={-10.5}
                              y={-9}
                              width={21}
                              height={18}
                              rx={9}
                              fill="var(--background)"
                              stroke={colour}
                              strokeWidth={1.5}
                              className="transition-colors group-hover:fill-(--badge)"
                            />
                            <text
                              y={4}
                              fontSize={11}
                              textAnchor="middle"
                              fill={colour}
                              className="font-body transition-colors group-hover:fill-background"
                            >
                              +
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {hover?.kind === "node" ? (
            <NodeTooltip
              node={hover.node}
              colour={kindColours[hover.node.kind]}
              clears={clickClears(hover.node.id)}
              clickable={onSelect !== undefined}
              extendable={
                onSelect !== undefined && highlight.isNextNode(hover.node.id)
              }
            />
          ) : hover?.kind === "link" ? (
            <LinkTooltip
              source={layout.boxes.get(hover.link.source)!.node}
              target={layout.boxes.get(hover.link.target)!.node}
              colour={
                kindColours[layout.boxes.get(hover.link.source)!.node.kind]
              }
              users={hover.link.users}
              clickable={onSelect !== undefined}
            />
          ) : null}
        </div>
      </PlotTooltipArea>
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground font-body">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {[
            ...(summary ?? []),
            <Gesture key="pan" keys={["Drag"]} action="pan" />,
            <Gesture key="zoom" keys={["Ctrl", "Scroll"]} action="zoom" />,
            onSelect && (
              <Gesture
                key="path"
                keys={["Shift", "Click"]}
                action="build path"
              />
            ),
          ]
            .filter(Boolean)
            .map((hint, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden>·</span>}
                {hint}
              </Fragment>
            ))}
        </p>
        <div className="flex items-center gap-3">
          {KINDS.filter((kind) =>
            journey.nodes.some((n) => n.kind === kind),
          ).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <PlotTooltipSwatch color={kindColours[kind]} />
              {KIND_LABELS[kind]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
