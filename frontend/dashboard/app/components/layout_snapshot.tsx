"use client";

import { useEffect, useRef, useState } from "react";
import SimpleTooltip from "./simple_tooltip";

export type LayoutElementType =
  | "container"
  | "text"
  | "input"
  | "button"
  | "image"
  | "video"
  | "list"
  | "icon"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "slider"
  | "progress";

// Translucent primary fill marking the clicked/highlighted element.
export const LayoutSnapshotHighlightBg =
  "oklch(from var(--primary) l c h / 0.3)";

// Faux-3D tuning. The snapshot rests at a slight default tilt so its layered
// depth is discoverable at a glance; dragging spins it further, and a
// double-click returns it to this resting pose.
const DEFAULT_ROT = { x: -8, y: 24 }; // resting rotation (deg)
const FIT_SCALE = 0.82; // shrink device within its box, leaving room to spin
const LAYER_GAP = 24; // px of z-separation per nesting level, at full tilt
const MAX_DEPTH = 16; // cap z-lift so deep trees don't blow up near the camera
const MAX_TILT = 55; // clamp rotation (deg) so layers never flip to their backface
const TILT_REF = 40; // tilt (deg) at which layers reach full separation
const PERSPECTIVE = 1000; // px
const DRAG_SENSITIVITY = 0.5; // deg of rotation per px dragged

type LayoutElement = {
  label: string;
  type: LayoutElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  scrollable: boolean;
  highlighted: boolean;
  children: LayoutElement[];
};

type LayoutSnapshotProps = {
  layoutUrl: string;
  width: number;
  height: number;
};

function LayoutElementNode({
  element,
  scaleX,
  scaleY,
  depth,
  t,
}: {
  element: LayoutElement;
  scaleX: number;
  scaleY: number;
  depth: number;
  t: number;
}) {
  const isTextElement = element.type === "text";

  const bgStyle = element.highlighted
    ? {
        backgroundColor: LayoutSnapshotHighlightBg,
      }
    : isTextElement
      ? {
          backgroundColor: "oklch(from var(--foreground) l c h / 0.20)",
        }
      : {};

  const borderClass = element.highlighted
    ? "border-primary hover:border-primary"
    : isTextElement
      ? "border-transparent hover:border-primary"
      : "border-foreground/50 hover:border-primary";

  const z = Math.min(depth, MAX_DEPTH) * LAYER_GAP * t;

  const positionStyle = {
    left: element.x * scaleX,
    top: element.y * scaleY,
    width: element.width * scaleX,
    height: element.height * scaleY,
    transform: `translateZ(${z}px)`,
  };

  return (
    <>
      <div className="absolute" style={positionStyle}>
        <SimpleTooltip content={element.label}>
          <div
            className={`absolute inset-0 border box-border ${borderClass}`}
            style={bgStyle}
          />
        </SimpleTooltip>
      </div>

      {/* Children - on top, will intercept pointer events */}
      {element.children?.map((child, index) => (
        <LayoutElementNode
          key={`${child.label}-${index}`}
          element={child}
          scaleX={scaleX}
          scaleY={scaleY}
          depth={depth + 1}
          t={t}
        />
      ))}
    </>
  );
}

export default function LayoutSnapshot({
  layoutUrl,
  width,
  height,
}: LayoutSnapshotProps) {
  const verticalOrienationWidth = 211;
  const verticalOrienationHeight = 366;
  const horizontalOrienationWidth = 366;
  const horizontalOrienationHeight = 211;

  const [layout, setLayout] = useState<LayoutElement | null>(null);
  const [rot, setRot] = useState(DEFAULT_ROT);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    rotX: number;
    rotY: number;
  } | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const fetchLayout = async () => {
      try {
        const response = await fetch(layoutUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch layout: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setLayout(data);
        }
      } catch (error) {
        console.error("Error fetching layout:", error);
      }
    };
    fetchLayout();
    return () => {
      cancelled = true;
    };
  }, [layoutUrl]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const clamp = (value: number) =>
      Math.max(-MAX_TILT, Math.min(MAX_TILT, value));

    const handleMove = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start) {
        return;
      }
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const dx = event.clientX - start.pointerX;
        const dy = event.clientY - start.pointerY;
        setRot({
          x: clamp(start.rotX - dy * DRAG_SENSITIVITY),
          y: clamp(start.rotY + dx * DRAG_SENSITIVITY),
        });
      });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging]);

  if (!layout) {
    return null;
  }

  // Determine base dimensions based on orientation
  let baseWidth = verticalOrienationWidth;
  let baseHeight = verticalOrienationHeight;

  if (layout.width > layout.height) {
    baseWidth = horizontalOrienationWidth;
    baseHeight = horizontalOrienationHeight;
  }

  // The outer box is whatever was requested (typically a square), shared by both
  // orientations. The device is fitted inside it at its own aspect ratio, zoomed
  // out by FIT_SCALE so there's room to spin without clipping, then centred.
  const deviceScale = Math.min(
    (width * FIT_SCALE) / baseWidth,
    (height * FIT_SCALE) / baseHeight,
  );
  const deviceWidth = baseWidth * deviceScale;
  const deviceHeight = baseHeight * deviceScale;
  const offsetX = (width - deviceWidth) / 2;
  const offsetY = (height - deviceHeight) / 2;

  // Scale layout coordinates into the fitted device dimensions
  const scaleX = deviceWidth / layout.width;
  const scaleY = deviceHeight / layout.height;

  // How "tilted" we are, 0 (flat) → 1 (full depth). Drives the per-layer z-lift.
  const t = Math.min(1, Math.max(Math.abs(rot.x), Math.abs(rot.y)) / TILT_REF);
  // Whether the user has spun it away from the resting pose (controls the hint).
  const movedFromRest = rot.x !== DEFAULT_ROT.x || rot.y !== DEFAULT_ROT.y;

  const handlePointerDown = (event: React.PointerEvent) => {
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      rotX: rot.x,
      rotY: rot.y,
    };
    setDragging(true);
  };

  const handleDoubleClick = () => {
    setDragging(false);
    setRot(DEFAULT_ROT);
  };

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width,
        height,
        perspective: PERSPECTIVE,
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: deviceWidth,
          height: deviceHeight,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: dragging ? "none" : "transform 300ms ease-out",
          // suppress hover/tooltips mid-drag; window listeners still drive rotation
          pointerEvents: dragging ? "none" : "auto",
        }}
      >
        <LayoutElementNode
          element={layout}
          scaleX={scaleX}
          scaleY={scaleY}
          depth={0}
          t={t}
        />
      </div>

      {movedFromRest && (
        <div className="absolute bottom-1 right-1.5 text-[10px] leading-none text-foreground-muted pointer-events-none">
          Double-click to reset
        </div>
      )}
    </div>
  );
}
