"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/utils/shadcn_utils";

// PlotTooltip renders a tooltip that lives in the document's body instead of
// the chart, so that it can exceed the chart's bounds and not get cut off,
// while also staying within the viewport.
//
// It uses the following mechanism:
// 1. A PlotTooltipArea wraps the chart. When the chart renders, the area uses
//    React's portal to render a hidden tooltip layer with a fixed position into
//    the body of its own document, through its ownerDocument. This is needed
//    because in product demos, we use same-origin iframes, where we need to
//    place the tooltip inside the iframe's document and not our main page.
// 2. The area records the pointer position from the pointer events inside it,
//    and tracks the viewport size and the layer's size.
// 3. While something is hovered, the chart renders a PlotTooltip, which
//    hands its content to the area to render in the layer, and makes the layer
//    visible.
//    The layer stays mounted, so a chart that remounts its tooltip only swaps
//    the content.
// 4. As the pointer moves, the viewport resizes or the tooltip size changes,
//    we use these inputs to position the layer relative to the pointer, so
//    that it stays within the viewport. The area's `placement` preference and
//    the available space decide which side of the pointer it goes on: above,
//    below, left or right.
// 5. Touch screens have no hover, so a tap that shows a tooltip also clicks the
//    chart. A chart that acts on a press or click gives its area a TooltipTaps,
//    gives each PlotTooltip the tapKey of its target, and checks `shouldAct`
//    before it acts. A tap acts only if the tooltip visible when the tap starts
//    has the tapped target's key. The first tap shows the tooltip; a second tap
//    on the same target acts. Mouse and pen presses always act.
// 6. Scrolling sends no pointer events, so the tooltip stays open while
//    the recorded pointer position becomes stale. The area adjusts that
//    position by how far it moved, keeping the tooltip beside its point.

// Gap between the pointer and the tooltip for each placement.
const ABOVE_GAP = 14;
const CORNER_GAP = 12;
const VIEWPORT_MARGIN = 8;
const HIDE_DELAY_MS = 100;
const TRANSITION_CLASSES = [
  "transition-transform",
  "duration-150",
  "ease-out",
  "motion-reduce:transition-none",
];

type Point = { x: number; y: number };
type Size = { width: number; height: number };

// "above" centres the tooltip above the pointer and keeps it inside the
// viewport horizontally. If there's no room above, it goes below. "corner"
// opens below and to the right of the pointer, moving to the other side on
// either axis where it won't fit.
export type TooltipPlacement = "above" | "corner";

// Returns the tooltip's left and top edges in viewport coordinates.
export function tooltipPosition(
  tooltipSize: Size,
  pointer: Point,
  viewportSize: Size,
  placement: TooltipPlacement = "above",
): Point {
  if (placement === "corner") {
    const rightX = pointer.x + CORNER_GAP;
    const belowY = pointer.y + CORNER_GAP;
    return {
      x:
        rightX + tooltipSize.width > viewportSize.width - VIEWPORT_MARGIN
          ? pointer.x - CORNER_GAP - tooltipSize.width
          : rightX,
      y:
        belowY + tooltipSize.height > viewportSize.height - VIEWPORT_MARGIN
          ? pointer.y - CORNER_GAP - tooltipSize.height
          : belowY,
    };
  }
  const x = Math.max(
    VIEWPORT_MARGIN,
    Math.min(
      pointer.x - tooltipSize.width / 2,
      viewportSize.width - VIEWPORT_MARGIN - tooltipSize.width,
    ),
  );
  const aboveY = pointer.y - tooltipSize.height - ABOVE_GAP;
  return {
    x,
    y: aboveY < VIEWPORT_MARGIN ? pointer.y + ABOVE_GAP : aboveY,
  };
}

// The fixed tooltip element for a PlotTooltipArea, positioned using pointer
// position, viewport size, and tooltip size. Style writes move it without
// rerendering the chart.
class TooltipLayer {
  private element: HTMLDivElement | null = null;
  private placement: TooltipPlacement = "above";
  private pointer: Point | null = null;
  private anchor: Element | null = null;
  private anchorOrigin: Point | null = null;
  private tooltipSize: Size | null = null;
  private viewportSize: Size = { width: 0, height: 0 };
  private shownCount = 0;
  private visible = false;
  private animationFrame = 0;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private renderContent: (content: React.ReactNode) => void) {}

  setContent(content: React.ReactNode) {
    this.renderContent(content);
  }

  setElement(element: HTMLDivElement | null) {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.element = element;
    this.visible = false;
    if (element) {
      element.style.setProperty("visibility", "hidden");
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(([entry]) => {
          this.tooltipSize = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };
          this.place();
        });
        this.resizeObserver.observe(element);
      }
    }
  }

  setPlacement(placement: TooltipPlacement) {
    this.placement = placement;
    this.place();
  }

  setPointer(x: number, y: number) {
    this.pointer = { x, y };
    this.anchorOrigin = this.anchor ? viewportOrigin(this.anchor) : null;
    if (this.visible) {
      this.element?.classList.add(...TRANSITION_CLASSES);
    }
    if (this.shownCount > 0) {
      this.place();
    }
  }

  private followScroll() {
    const anchor = this.anchor;
    const from = this.anchorOrigin;
    if (this.shownCount === 0 || !this.pointer || !anchor || !from) {
      return;
    }
    const to = viewportOrigin(anchor);
    if (to.x === from.x && to.y === from.y) {
      return;
    }
    this.pointer = {
      x: this.pointer.x + to.x - from.x,
      y: this.pointer.y + to.y - from.y,
    };
    this.anchorOrigin = to;
    // The slide transition would make the tooltip trail behind the
    // scrolling chart, so it is turned off here. The next pointer event
    // turns it back on.
    this.element?.classList.remove(...TRANSITION_CLASSES);
    this.element?.ownerDocument.defaultView?.cancelAnimationFrame(
      this.animationFrame,
    );
    this.place();
  }

  watchViewport(win: Window, area: HTMLElement) {
    // An area with display: contents has no box of its own, so use its
    // first child to track the chart's position.
    this.anchor =
      area.getClientRects().length > 0 ? area : area.firstElementChild;
    const read = () => {
      this.viewportSize = {
        width: win.document.documentElement.clientWidth,
        height: win.document.documentElement.clientHeight,
      };
      this.place();
    };
    // Scroll events don't bubble, so listen on the window in capture
    // phase to receive scrolls from elements containing the chart.
    const followScroll = () => this.followScroll();
    read();
    win.addEventListener("resize", read);
    win.addEventListener("scroll", followScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      win.removeEventListener("resize", read);
      win.removeEventListener("scroll", followScroll, { capture: true });
    };
  }

  show() {
    clearTimeout(this.hideTimer);
    this.shownCount++;
    if (!this.visible) {
      // The layer still reflects the size of its previous content. It stays
      // hidden until the observer reports the new size, then the tooltip
      // appears in the right place without sliding there.
      this.tooltipSize = null;
      if (this.element && this.resizeObserver) {
        this.resizeObserver.unobserve(this.element);
        this.resizeObserver.observe(this.element);
      }
    }
    this.place();
  }

  // The layer keeps its last content briefly after the tooltip unmounts.
  // If the pointer crosses a gap between bars or nodes, the next tooltip
  // appears before the delay ends. The tooltip moves without flashing out
  // and back in. This also covers charts that remount their tooltip.
  hide() {
    this.shownCount--;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.shownCount === 0) {
        this.renderContent(null);
        this.place();
      }
    }, HIDE_DELAY_MS);
  }

  private place() {
    const element = this.element;
    if (!element) {
      return;
    }
    if (this.shownCount > 0) {
      element.setAttribute("role", "tooltip");
    } else {
      element.removeAttribute("role");
    }
    if (this.shownCount === 0 || !this.pointer || !this.tooltipSize) {
      if (this.visible) {
        this.visible = false;
        element.style.setProperty("visibility", "hidden");
        element.classList.remove(...TRANSITION_CLASSES);
        element.ownerDocument.defaultView?.cancelAnimationFrame(
          this.animationFrame,
        );
      }
      return;
    }
    const position = tooltipPosition(
      this.tooltipSize,
      this.pointer,
      this.viewportSize,
      this.placement,
    );
    element.style.setProperty(
      "transform",
      `translate(${position.x}px, ${position.y}px)`,
    );
    if (!this.visible) {
      this.visible = true;
      element.style.removeProperty("visibility");
      // The transition starts one frame after the tooltip appears, so it
      // appears in place instead of sliding in from where it was last shown.
      this.animationFrame =
        element.ownerDocument.defaultView?.requestAnimationFrame(() =>
          element.classList.add(...TRANSITION_CLASSES),
        ) ?? 0;
    }
  }
}

function viewportOrigin(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

const ANY_TARGET = Symbol("any target");

export class TooltipTaps {
  private shownKey: string | null = null;
  private armedKey: string | null | typeof ANY_TARGET = ANY_TARGET;

  pointerDown(pointerType: string) {
    this.armedKey = pointerType === "touch" ? this.shownKey : ANY_TARGET;
  }

  show(key: string) {
    this.shownKey = key;
  }

  hide(key: string) {
    if (this.shownKey === key) {
      this.shownKey = null;
    }
  }

  // `key` is the tapKey of the tooltip shown by the tapped target, or null if
  // the target has no tooltip.
  shouldAct(key: string | null) {
    return (
      this.armedKey === ANY_TARGET || (key !== null && this.armedKey === key)
    );
  }
}

export function useTooltipTaps() {
  const [tooltipTaps] = React.useState(() => new TooltipTaps());
  return tooltipTaps;
}

const PlotTooltipContext = React.createContext<{
  tooltipLayer: TooltipLayer;
  tooltipTaps: TooltipTaps;
} | null>(null);

export function PlotTooltipArea({
  placement = "above",
  className = "size-full",
  taps,
  children,
}: {
  placement?: TooltipPlacement;
  className?: string;
  taps?: TooltipTaps;
  children: React.ReactNode;
}) {
  const [content, setContent] = React.useState<React.ReactNode>(null);
  const [tooltipLayer] = React.useState(() => new TooltipLayer(setContent));
  const ownTaps = useTooltipTaps();
  const tooltipTaps = taps ?? ownTaps;
  const contextValue = React.useMemo(
    () => ({ tooltipLayer, tooltipTaps }),
    [tooltipLayer, tooltipTaps],
  );
  const [area, setArea] = React.useState<HTMLDivElement | null>(null);
  const body = area?.ownerDocument.body;
  const attachLayer = React.useCallback(
    (element: HTMLDivElement | null) => tooltipLayer.setElement(element),
    [tooltipLayer],
  );

  React.useLayoutEffect(() => {
    tooltipLayer.setPlacement(placement);
  }, [tooltipLayer, placement]);

  React.useEffect(() => {
    const win = area?.ownerDocument.defaultView;
    if (!area || !win) {
      return;
    }
    return tooltipLayer.watchViewport(win, area);
  }, [tooltipLayer, area]);

  // Touch screens don't fire pointermove on tap, so pointerover and pointerdown
  // also record the pointer position.
  const recordPointer = (event: React.PointerEvent) => {
    tooltipLayer.setPointer(event.clientX, event.clientY);
  };

  // The area receives each tap's pointer event before the chart, so this
  // records which tooltip was visible before the tap.
  const recordPointerDown = (event: React.PointerEvent) => {
    recordPointer(event);
    tooltipTaps.pointerDown(event.pointerType);
  };

  return (
    <PlotTooltipContext.Provider value={contextValue}>
      {/* nivo's responsive charts size themselves from their parent element,
          so the area fills its container by default. */}
      <div
        ref={setArea}
        className={className}
        onPointerOverCapture={recordPointer}
        onPointerDownCapture={recordPointerDown}
        onPointerMoveCapture={recordPointer}
      >
        {children}
      </div>
      {body &&
        createPortal(
          <div
            ref={attachLayer}
            className="pointer-events-none fixed left-0 top-0 z-50"
          >
            {content}
          </div>,
          body,
        )}
    </PlotTooltipContext.Provider>
  );
}

// Passing the content to the area leaves nivo's tooltip wrapper empty,
// so it cannot make the page scroll sideways.
export function PlotTooltip({
  className,
  tapKey,
  children,
}: {
  className?: string;
  tapKey?: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(PlotTooltipContext);
  if (!context) {
    throw new Error("PlotTooltip must be used within a PlotTooltipArea.");
  }
  const { tooltipLayer, tooltipTaps } = context;

  React.useLayoutEffect(() => {
    tooltipLayer.show();
    return () => tooltipLayer.hide();
  }, [tooltipLayer]);

  React.useLayoutEffect(() => {
    if (tapKey === undefined) {
      return;
    }
    tooltipTaps.show(tapKey);
    return () => tooltipTaps.hide(tapKey);
  }, [tooltipTaps, tapKey]);

  React.useLayoutEffect(() => {
    tooltipLayer.setContent(
      <PlotTooltipShell className={className}>{children}</PlotTooltipShell>,
    );
  });

  return null;
}

// The bordered panel around a chart's hover tooltip. It has no padding, so each
// tooltip passes its own through `className`.
export function PlotTooltipShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-background text-foreground font-body border shadow-md flex flex-col text-xs rounded-md whitespace-nowrap",
        className,
      )}
    >
      {children}
    </div>
  );
}

// The small colour dot that labels a series in a plot tooltip row.
export function PlotTooltipSwatch({ color }: { color: string }) {
  return (
    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
  );
}
