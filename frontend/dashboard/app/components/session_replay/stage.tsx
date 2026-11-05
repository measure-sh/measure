"use client";

import { memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import { cn } from "@/app/utils/shadcn_utils";
import {
  type Tilt,
  type SessionReplayActor,
} from "@/app/components/session_replay/machine";
import { type AttachmentRef } from "@/app/components/session_replay/events";
import {
  type Attachment,
  type AttachmentFit,
  type LayoutElement,
  attachmentQueryOptions,
  reportAttachmentFailure,
} from "@/app/components/session_replay/attachments";
import {
  type DevicePoint,
  type ReplayTouch,
  type AttachmentRefGroup,
  swipeTravelMs,
} from "@/app/components/session_replay/replay";
import {
  replayOutlineWidthProperty,
  layerGapRatio,
  perspectiveRatio,
  maxLayerDepth,
  tiltProgress,
  projectedExtent,
} from "@/app/components/session_replay/geometry";

const sdkAccent = /#fef08a/gi;

function accentedWireframe(markup: string, accent: string): string {
  return markup.replace(sdkAccent, accent);
}

export function ringPositionAt(
  touch: ReplayTouch,
  playheadOffsetMs: number,
): DevicePoint {
  const travelMs = Math.min(
    swipeTravelMs,
    touch.releaseOffsetMs - touch.pressOffsetMs,
  );
  const progress =
    travelMs <= 0
      ? 1
      : Math.min(1, (playheadOffsetMs - touch.pressOffsetMs) / travelMs);
  return {
    x: touch.from.x + (touch.to.x - touch.from.x) * progress,
    y: touch.from.y + (touch.to.y - touch.from.y) * progress,
  };
}

export function stagePointFrom(
  point: DevicePoint,
  fit: AttachmentFit,
): { xPercent: number; yPercent: number } {
  return {
    xPercent:
      fit.leftPercent + (point.x / fit.sourceSize.width) * fit.widthPercent,
    yPercent:
      fit.topPercent + (point.y / fit.sourceSize.height) * fit.heightPercent,
  };
}

function ringOnStageAt(
  touch: ReplayTouch,
  playheadOffsetMs: number,
  fit: AttachmentFit,
): { xPercent: number; yPercent: number } {
  return stagePointFrom(ringPositionAt(touch, playheadOffsetMs), fit);
}

export function tiltScaleFor(
  layerCount: number | null,
  fit: AttachmentFit,
  tilt: Tilt,
): number {
  // Once the layers are tilted they paint outside the box the attachment was
  // fitted into, so the whole stack is scaled down far enough to stay on the
  // stage. Untilted layers need no scaling and the attachment draws full size.
  if (layerCount === null) {
    return 1;
  }
  // The lift between layers and the perspective they are drawn with are both a
  // share of the attachment's drawn width, so both are measured against the
  // width the attachment was given rather than against the whole stage.
  const bounds = projectedExtent(
    {
      width: fit.widthPercent,
      height: fit.heightPercent,
      depth: layerCount * layerGapRatio * fit.widthPercent * tiltProgress(tilt),
    },
    tilt,
    perspectiveRatio * fit.widthPercent,
  );
  const halfWidth = Math.abs(bounds.centreX) + bounds.width / 2;
  const halfHeight = Math.abs(bounds.centreY) + bounds.height / 2;
  return Math.min(1, 50 / Math.max(halfWidth, 1), 50 / Math.max(halfHeight, 1));
}

// Each node is lifted towards the viewer by its depth in the layout tree,
// multiplied by the --msr-depth CSS variable that the stage ramps from 0 to 1
// as the view is turned. At 0 every node is flat against the others, and the
// tree fans out into separate layers as an angle appears.
//
// The SDK records each node's box in device pixels, and the scale converts it
// to the pixels the stage draws it at. The nodes are laid out at that size
// instead of being scaled after layout. With a scale transform above the
// perspective, Chrome's compositor leaves the flat layers painted after the
// tree unrasterised, making the controls and event list go blank whenever the
// tree mounts or repaints.
function layoutNodeViews(
  root: LayoutElement,
  scale: number,
  liftPerDepth: number,
) {
  const nodes: React.ReactElement[] = [];
  const visit = (node: LayoutElement, depth: number, path: string) => {
    const lift = Math.min(depth, maxLayerDepth) * liftPerDepth;
    const isTarget = node.highlighted;
    const isText = !isTarget && node.type === "text";
    nodes.push(
      <div
        key={path}
        className={cn(
          "absolute box-border border-solid hover:border-primary",
          isTarget && "border-primary bg-primary/30",
          isText && "border-transparent bg-foreground/20",
          !isTarget && !isText && "border-foreground/50",
        )}
        data-label={node.label ? `${node.label} (${node.type})` : node.type}
        style={{
          left: node.x * scale,
          top: node.y * scale,
          width: node.width * scale,
          height: node.height * scale,
          borderWidth: isTarget
            ? `calc(var(${replayOutlineWidthProperty}, 1px) * 2)`
            : `var(${replayOutlineWidthProperty}, 1px)`,
          transform: `translateZ(calc(var(--msr-depth, 0) * ${lift}px))`,
        }}
      />,
    );
    (node.children ?? []).forEach((child, index) =>
      visit(child, depth + 1, `${path}.${index}`),
    );
  };
  visit(root, 0, "0");
  return nodes;
}

export const StageAttachment = memo(function StageAttachment({
  attachment,
  imageUrl,
  onImageError,
  hidden,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
}: {
  attachment: Attachment;
  imageUrl: string;
  onImageError?: () => void;
  hidden: boolean;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
}) {
  if (attachment.content.kind !== "layout") {
    const src =
      attachment.content.kind === "svg"
        ? `data:image/svg+xml;utf8,${encodeURIComponent(accentedWireframe(attachment.content.markup, accent))}`
        : imageUrl;
    return (
      <div className="absolute inset-0" hidden={hidden}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          onError={onImageError}
          className="absolute block object-contain"
          alt=""
          style={{
            left: `${fit.leftPercent}%`,
            top: `${fit.topPercent}%`,
            width: `${fit.widthPercent}%`,
            height: `${fit.heightPercent}%`,
          }}
        />
      </div>
    );
  }

  // The tree fills the box the attachment was fitted into, and the lift
  // between layers and the perspective are both a share of that box's width,
  // so the fanned-out tree looks the same whatever size the stage is.
  const drawnWidthPx = (stageWidthPx * fit.widthPercent) / 100;
  const scale = drawnWidthPx / fit.sourceSize.width;
  const liftPerDepth = drawnWidthPx * layerGapRatio;
  const perspective = drawnWidthPx * perspectiveRatio;
  return (
    <div className="absolute inset-0" hidden={hidden}>
      <div
        className="absolute"
        style={{
          left: `${fit.leftPercent}%`,
          top: `${fit.topPercent}%`,
          width: `${fit.widthPercent}%`,
          height: `${fit.heightPercent}%`,
          perspective: `${perspective}px`,
        }}
      >
        <div
          ref={tiltLayer}
          className="absolute inset-0 transform-3d origin-center transition-transform duration-300 ease-out"
        >
          {layoutNodeViews(attachment.content.root, scale, liftPerDepth)}
        </div>
      </div>
    </div>
  );
});

export const StageFrame = memo(function StageFrame({
  group,
  sessionId,
  sessionAttributes,
  shownIndex,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
  onDrawFailed,
}: {
  group: AttachmentRefGroup;
  sessionId: string;
  sessionAttributes: any;
  shownIndex: number;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
  onDrawFailed: (attachmentRef: AttachmentRef) => void;
}) {
  return (
    <>
      {group.attachmentRefs.map((attachmentRef, index) => (
        // Every attachment the switcher offers stays mounted, hidden until it is
        // picked, so switching to one draws it at once.
        <StageAttachmentLoader
          key={attachmentRef.id}
          attachmentRef={attachmentRef}
          sessionId={sessionId}
          sessionAttributes={sessionAttributes}
          hidden={index !== shownIndex}
          accent={accent}
          fit={fit}
          stageWidthPx={stageWidthPx}
          tiltLayer={index === shownIndex ? tiltLayer : undefined}
          onDrawFailed={onDrawFailed}
        />
      ))}
    </>
  );
});

// Draws one attachment, and only once it has been fetched.
const StageAttachmentLoader = memo(function StageAttachmentLoader({
  attachmentRef,
  sessionId,
  sessionAttributes,
  hidden,
  accent,
  fit,
  stageWidthPx,
  tiltLayer,
  onDrawFailed,
}: {
  attachmentRef: AttachmentRef;
  sessionId: string;
  sessionAttributes: any;
  hidden: boolean;
  accent: string;
  fit: AttachmentFit;
  stageWidthPx: number;
  tiltLayer?: React.Ref<HTMLDivElement>;
  onDrawFailed: (attachmentRef: AttachmentRef) => void;
}) {
  const { data: attachment } = useQuery(
    attachmentQueryOptions(sessionId, attachmentRef, sessionAttributes),
  );
  // A screenshot is measured once and drawn from its URL every time, so the
  // browser can drop the pixels and come back to a URL that has since expired.
  // The frame goes blank, which the viewer sees, and this is what says why.
  const onImageError = useCallback(() => {
    reportAttachmentFailure(
      attachmentRef,
      new Error(`drawing ${attachmentRef.url} failed`),
    );
    onDrawFailed(attachmentRef);
  }, [attachmentRef, onDrawFailed]);
  if (attachment === undefined) {
    return null;
  }
  return (
    <StageAttachment
      attachment={attachment}
      imageUrl={attachmentRef.url}
      onImageError={onImageError}
      hidden={hidden}
      accent={accent}
      fit={fit}
      stageWidthPx={stageWidthPx}
      tiltLayer={tiltLayer}
    />
  );
});

export const TouchRing = memo(function TouchRing({
  actor,
  touch,
  fit,
  ringPercent,
  stageWidthPx,
}: {
  actor: SessionReplayActor;
  touch: ReplayTouch | null;
  fit: AttachmentFit | null;
  ringPercent: number;
  stageWidthPx: number;
}) {
  const ring = useSelector(
    actor,
    (snapshot) =>
      touch === null || fit === null
        ? null
        : ringOnStageAt(touch, snapshot.context.playheadOffsetMs, fit),
    (a, b) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.xPercent === b.xPercent &&
        a.yPercent === b.yPercent),
  );
  if (ring === null) {
    return null;
  }
  return (
    <div
      data-testid="session-replay-touch-ring"
      className="absolute box-border rounded-full border-solid border-primary pointer-events-none"
      style={{
        left: `${ring.xPercent}%`,
        top: `${ring.yPercent}%`,
        width: `${ringPercent}%`,
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        // A border-width given as a percentage is ignored by CSS, so the ring's
        // is worked out in pixels from the stage's measured width.
        borderWidth: `${Math.max(1, (stageWidthPx * ringPercent) / 100 / 12)}px`,
      }}
    />
  );
});
