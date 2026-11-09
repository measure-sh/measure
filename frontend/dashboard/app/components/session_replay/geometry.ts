import { type Tilt } from "@/app/components/session_replay/machine";
import {
  type AttachmentFit,
  type LayoutElement,
} from "@/app/components/session_replay/attachments";
export type Size = { width: number; height: number };

// The bands the stage's overlays are drawn in. The attachment is fitted below
// the switcher and the notice and above the turn hint, so it clears all three.
const stageInsetTopPx = 64;

const stageInsetBottomPx = 40;

const stageInsetXPx = 28;

export function fitInto(
  sourceSize: Size,
  stageWidth: number,
  stageHeight: number,
): AttachmentFit {
  // The attachment keeps its aspect ratio and takes the largest box that fits
  // the stage once room is left for the overlays: the attachment switcher and
  // the skip notice along the top, the turn hint along the bottom.
  const boxWidth = Math.max(1, stageWidth - stageInsetXPx * 2);
  const boxHeight = Math.max(
    1,
    stageHeight - stageInsetTopPx - stageInsetBottomPx,
  );
  const scale = Math.min(
    boxWidth / sourceSize.width,
    boxHeight / sourceSize.height,
  );
  const drawnWidth = sourceSize.width * scale;
  const drawnHeight = sourceSize.height * scale;
  const width = Math.max(1, stageWidth);
  const height = Math.max(1, stageHeight);
  return {
    sourceSize,
    leftPercent: ((width - drawnWidth) / 2 / width) * 100,
    topPercent:
      ((stageInsetTopPx + (boxHeight - drawnHeight) / 2) / height) * 100,
    widthPercent: (drawnWidth / width) * 100,
    heightPercent: (drawnHeight / height) * 100,
  };
}

export function sourceSizeOf(
  intrinsicSize: Size,
  sessionAttributes: any,
): Size {
  // On iOS and iPadOS a screenshot is recorded in device pixels while gestures
  // and layout nodes are recorded in points, so the screenshot is divided by
  // the screen density to bring all three into the same coordinates.
  const osName = String(sessionAttributes?.os_name ?? "").toLowerCase();
  if (osName !== "ios" && osName !== "ipados") {
    return intrinsicSize;
  }
  const density = Number(sessionAttributes?.device_density);
  if (!Number.isFinite(density) || density <= 0) {
    return intrinsicSize;
  }
  return {
    width: intrinsicSize.width / density,
    height: intrinsicSize.height / density,
  };
}

export function layerCountOf(root: LayoutElement): number {
  return Math.min(treeDepth(root) - 1, maxLayerDepth);
}

function treeDepth(node: LayoutElement): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(treeDepth));
}

export const replayOutlineWidthProperty = "--msr-outline-width";

const treeOutlineDevicePx = 2.5;

// The browser rounds borders down to whole device pixels. After tilt
// resampling, a one-pixel border can look broken or gappy. Requesting a width
// slightly greater than two device pixels ensures rounding leaves a solid
// two-pixel outline at any tilt.
export function treeOutlineWidthPx(
  devicePixelRatio: number,
  containerScale: number,
): number {
  return Math.max(
    1,
    treeOutlineDevicePx / Math.max(0.01, devicePixelRatio * containerScale),
  );
}

// How much the document has been scaled by its containing elements. The
// marketing page scales the player inside an iframe with CSS. That scale is
// visible on the iframe element, so measure each frame's rendered width against
// its layout width.
export function containerScaleOf(view: Window): number {
  let scale = 1;
  try {
    let frame = view.frameElement as HTMLElement | null;
    while (frame && frame.offsetWidth > 0) {
      scale *= frame.getBoundingClientRect().width / frame.offsetWidth;
      frame = frame.ownerDocument.defaultView
        ?.frameElement as HTMLElement | null;
    }
  } catch {
    return scale;
  }
  return scale;
}

export const layerGapRatio = 0.09;

export const perspectiveRatio = 4.7;

export const maxLayerDepth = 16;

const fullTiltDegrees = 40;

export function tiltProgress(tilt: Tilt): number {
  return Math.min(
    1,
    Math.max(Math.abs(tilt.xDegrees), Math.abs(tilt.yDegrees)) /
      fullTiltDegrees,
  );
}

type ProjectedExtent = Size & {
  centreX: number;
  centreY: number;
};

export function projectedExtent(
  box: { width: number; height: number; depth: number },
  tilt: Tilt,
  perspective: number,
): ProjectedExtent {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const xRadians = toRadians(tilt.xDegrees);
  const yRadians = toRadians(tilt.yDegrees);
  const cosX = Math.cos(xRadians);
  const sinX = Math.sin(xRadians);
  const cosY = Math.cos(yRadians);
  const sinY = Math.sin(yRadians);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const x of [-box.width / 2, box.width / 2]) {
    for (const y of [-box.height / 2, box.height / 2]) {
      for (const z of [0, box.depth]) {
        const turnedX = x * cosY + z * sinY;
        const zAfterYTurn = -x * sinY + z * cosY;
        const turnedY = y * cosX - zAfterYTurn * sinX;
        const turnedZ = y * sinX + zAfterYTurn * cosX;

        const magnification =
          perspective / Math.max(perspective * 0.05, perspective - turnedZ);
        minX = Math.min(minX, turnedX * magnification);
        maxX = Math.max(maxX, turnedX * magnification);
        minY = Math.min(minY, turnedY * magnification);
        maxY = Math.max(maxY, turnedY * magnification);
      }
    }
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
  };
}
