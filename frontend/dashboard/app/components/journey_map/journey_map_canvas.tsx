"use client";

import type { JourneyMap, JourneyMapScreen } from "@/app/api/api_calls";
import { cn } from "@/app/utils/shadcn_utils";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  type ReactNode,
  type Ref,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type EdgePlacement,
  type MapLayout,
  cardHeaderHeight,
  cardWidth,
  entryScreens,
  thumbWidth,
} from "./layout";
import { NoSnapshot, Wireframe } from "./wireframe";

export type JourneyMapCanvasHandle = {
  focus: (key: string) => void;
};

const minZoom = 0.1;
const maxZoom = 2.5;
const labelZoom = 0.55;
const dotSpacing = 22;
const fitPadding = 48;
// The panel covers the right of the map, so a focused screen is centered in
// what is left of it.
export const panelWidth = 380;

type View = { x: number; y: number; k: number };

const ScreenCard = memo(function ScreenCard({
  screen,
  x,
  y,
  cardHeight,
  thumbHeight,
  isEntry,
  selected,
  hovered,
  dimmed,
}: {
  screen: JourneyMapScreen;
  x: number;
  y: number;
  cardHeight: number;
  thumbHeight: number;
  isEntry: boolean;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
}) {
  const variant = screen.variants[0];
  return (
    <div
      data-screen-key={screen.key}
      className={cn(
        "absolute rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-[opacity,border-color,box-shadow] duration-200",
        selected && "border-primary ring-2 ring-primary/40",
        !selected && hovered && "border-foreground/40 shadow-md",
        dimmed && "opacity-25",
      )}
      style={{ left: x, top: y, width: cardWidth, height: cardHeight }}
    >
      <div
        className="flex flex-row items-start gap-1 px-2 pt-2"
        style={{ height: cardHeaderHeight }}
      >
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs leading-4 truncate">
            {screen.screen || screen.host || screen.key}
          </p>
          <p className="font-body text-[10px] leading-4 text-muted-foreground truncate">
            {screen.screen ? screen.host : "\u00a0"}
          </p>
        </div>
        {isEntry && (
          <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-px font-body text-[9px] text-foreground">
            Start
          </span>
        )}
      </div>
      <div
        className="relative mx-2 overflow-hidden rounded-sm bg-muted/50"
        style={{ width: thumbWidth, height: thumbHeight }}
      >
        {variant ? (
          <Wireframe
            wireframe={variant.wireframe}
            crop
            className="h-full w-full"
          />
        ) : (
          <NoSnapshot className="h-full w-full" />
        )}
        {screen.variants.length > 1 && (
          <span className="absolute right-1 top-1 rounded-full bg-foreground px-1.5 py-px font-body text-[9px] text-background">
            {screen.variants.length} states
          </span>
        )}
      </div>
    </div>
  );
});

function edgePath(p: EdgePlacement["points"]) {
  return `M${p[0]} ${p[1]}C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`;
}

const Edges = memo(function Edges({
  layout,
  focused,
  showLabels,
}: {
  layout: MapLayout;
  focused: string | null;
  showLabels: boolean;
}) {
  const id = useId();
  const arrow = `${id}-arrow`;
  const activeArrow = `${id}-arrow-active`;
  const isActive = (e: EdgePlacement) =>
    focused !== null && (e.from === focused || e.to === focused);
  // Active edges are drawn last so they sit on top.
  const ordered = [...layout.edges].sort(
    (a, b) => Number(isActive(a)) - Number(isActive(b)),
  );
  return (
    <svg
      width={layout.width}
      height={layout.height}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      aria-hidden
    >
      <defs>
        {[arrow, activeArrow].map((markerId) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="10"
            markerHeight="10"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path
              d="M0 1L10 5L0 9Z"
              className={
                markerId === activeArrow
                  ? "fill-primary"
                  : "fill-muted-foreground"
              }
            />
          </marker>
        ))}
      </defs>
      {ordered.map((e) => {
        const active = isActive(e);
        return (
          <path
            key={`${e.from}\u0000${e.to}`}
            d={edgePath(e.points)}
            strokeWidth={e.strokeWidth}
            markerEnd={`url(#${active ? activeArrow : arrow})`}
            className={cn(
              "fill-none transition-opacity duration-200",
              active ? "stroke-primary" : "stroke-muted-foreground",
              !active && (focused ? "opacity-10" : "opacity-50"),
            )}
          />
        );
      })}
      {ordered.map((e) => {
        const active = isActive(e);
        if (focused ? !active : !showLabels) {
          return null;
        }
        return (
          <text
            key={`${e.from}\u0000${e.to}`}
            x={e.labelX}
            y={e.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className={cn(
              "font-body text-[10px]",
              active ? "fill-foreground" : "fill-muted-foreground",
            )}
            style={{
              paintOrder: "stroke",
              stroke: "var(--background)",
              strokeWidth: 4,
              strokeLinejoin: "round",
            }}
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
});

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
    >
      {children}
    </button>
  );
}

export default function JourneyMapCanvas({
  ref,
  map,
  layout,
  selected,
  panelOpen,
  onSelect,
  children,
}: {
  ref?: Ref<JourneyMapCanvasHandle>;
  map: JourneyMap;
  layout: MapLayout;
  selected: string | null;
  panelOpen: boolean;
  onSelect: (key: string | null) => void;
  children?: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
    key: string | null;
    moved: boolean;
  } | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  const apply = useCallback((animate = false) => {
    const layer = layerRef.current;
    const viewport = viewportRef.current;
    if (!layer || !viewport) return;
    const { x, y, k } = view.current;
    layer.style.transition = animate
      ? "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)"
      : "";
    layer.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    viewport.style.backgroundSize = `${dotSpacing * k}px ${dotSpacing * k}px`;
    viewport.style.backgroundPosition = `${x}px ${y}px`;
    setShowLabels(k >= labelZoom);
  }, []);

  const fit = useCallback(
    (animate = false) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      const k = Math.min(
        1,
        (w - 2 * fitPadding) / Math.max(layout.width, 1),
        (h - 2 * fitPadding) / Math.max(layout.height, 1),
      );
      view.current = {
        k: Math.max(minZoom, k),
        x: (w - layout.width * k) / 2,
        y: (h - layout.height * k) / 2,
      };
      apply(animate);
    },
    [layout, apply],
  );

  const zoomAt = useCallback(
    (px: number, py: number, factor: number, animate = false) => {
      const { x, y, k } = view.current;
      const next = Math.min(maxZoom, Math.max(minZoom, k * factor));
      view.current = {
        k: next,
        x: px - (px - x) * (next / k),
        y: py - (py - y) * (next / k),
      };
      apply(animate);
    },
    [apply],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: (key: string) => {
        const node = layout.nodes[key];
        const viewport = viewportRef.current;
        if (!node || !viewport) return;
        const k = Math.max(view.current.k, 0.9);
        const visibleWidth = Math.max(
          viewport.clientWidth - panelWidth,
          viewport.clientWidth / 2,
        );
        view.current = {
          k,
          x: visibleWidth / 2 - (node.x + cardWidth / 2) * k,
          y: viewport.clientHeight / 2 - (node.y + layout.cardHeight / 2) * k,
        };
        apply(true);
      },
    }),
    [layout, apply],
  );

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      // Pinch gestures arrive as wheel events with ctrlKey set and small
      // deltas, so they zoom faster per unit than a mouse wheel.
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * speed),
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const neighbours = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const t of map.transitions) {
      (out[t.from] ??= new Set()).add(t.to);
      (out[t.to] ??= new Set()).add(t.from);
    }
    return out;
  }, [map.transitions]);

  const entries = useMemo(() => entryScreens(map.screens), [map.screens]);

  const focused = selected ?? hovered;

  const screenKeyAt = (target: EventTarget | null) =>
    (target as Element | null)
      ?.closest("[data-screen-key]")
      ?.getAttribute("data-screen-key") ?? null;

  const zoomCentre = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor, true);
  };

  return (
    <div className="relative h-[72vh] min-h-135 w-full overflow-hidden rounded-md border bg-background">
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            viewX: view.current.x,
            viewY: view.current.y,
            key: screenKeyAt(e.target),
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && d.pointerId === e.pointerId) {
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) {
              d.moved = true;
              viewportRef.current?.setPointerCapture(e.pointerId);
            }
            if (d.moved) {
              view.current = {
                ...view.current,
                x: d.viewX + dx,
                y: d.viewY + dy,
              };
              apply();
            }
            return;
          }
          const key = screenKeyAt(e.target);
          if (key !== hovered) setHovered(key);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.pointerId !== e.pointerId) return;
          if (!d.moved) {
            onSelect(d.key);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerLeave={() => setHovered(null)}
      >
        <div
          ref={layerRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: layout.width, height: layout.height }}
        >
          <Edges layout={layout} focused={focused} showLabels={showLabels} />
          {map.screens.map((s) => {
            const placement = layout.nodes[s.key];
            if (!placement) return null;
            return (
              <ScreenCard
                key={s.key}
                screen={s}
                x={placement.x}
                y={placement.y}
                cardHeight={layout.cardHeight}
                thumbHeight={layout.thumbHeight}
                isEntry={entries.has(s.key)}
                selected={selected === s.key}
                hovered={hovered === s.key}
                dimmed={
                  focused !== null &&
                  focused !== s.key &&
                  !neighbours[focused]?.has(s.key)
                }
              />
            );
          })}
        </div>
      </div>

      <div
        className="absolute bottom-3 flex flex-col divide-y overflow-hidden rounded-md border bg-background/90 backdrop-blur-sm transition-[right] duration-300 ease-in-out"
        style={{ right: panelOpen ? panelWidth + 12 : 12 }}
      >
        <ControlButton label="Zoom in" onClick={() => zoomCentre(1.25)}>
          <Plus className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => zoomCentre(0.8)}>
          <Minus className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Fit to screen" onClick={() => fit(true)}>
          <Maximize className="h-4 w-4" />
        </ControlButton>
      </div>

      <p className="pointer-events-none absolute left-3 top-3 font-body text-[11px] text-muted-foreground">
        Scroll to zoom, drag to pan, click a screen to see its states
      </p>

      {children}
    </div>
  );
}
