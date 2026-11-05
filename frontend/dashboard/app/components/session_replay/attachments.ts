import posthog from "posthog-js";
import { useEffect } from "react";
import {
  useQueryClient,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import { type SessionReplayActor } from "@/app/components/session_replay/machine";
import { type AttachmentRef } from "@/app/components/session_replay/events";
import { type Replay } from "@/app/components/session_replay/replay";
import {
  type Size,
  sourceSizeOf,
  layerCountOf,
} from "@/app/components/session_replay/geometry";

type FrameContent =
  | { kind: "svg"; markup: string }
  | { kind: "image" }
  | { kind: "layout"; root: LayoutElement };

// A fetched attachment, carrying the id of the attachment ref it came from.
export type Attachment = {
  id: string;
  sourceSize: Size;
  layerCount: number | null;
  content: FrameContent;
};

export type AttachmentFit = {
  sourceSize: Size;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type LayoutElement = {
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highlighted: boolean;
  children: LayoutElement[];
};

const attachmentFetchTimeoutMs = 30_000;

// Attachments do not change after they are fetched, so their queries stay
// fresh. The viewer may not reach an attachment until later in the session, so
// the cache must retain it for at least as long as a full session viewing.
// Otherwise, it could drop an attachment fetched ahead of the playhead, forcing
// another fetch when the playhead reaches it.
const attachmentGcTimeMs = 30 * 60 * 1000;

const attachmentFetchConcurrency = 8;

// An attachment gets one retry in case a brief network problem interrupts
// the fetch. React Query counts both attempts, so a failure after the retry is
// the final result for that attachment.
const attachmentFetchRetries = 1;

// Attachments within the first radius of the playhead are fetched, and those
// within the second are kept, so the query cache holds at most 500 at once. The
// gap between the two radii stops a playhead sitting on a boundary from
// dropping and refetching the same attachment.
const attachmentFetchRadius = 225;

const attachmentKeepRadius = 250;

// The window is worked out afresh every time the playhead crosses this many
// attachments.
const attachmentWindowStride = 25;

// Presigned URLs are signed afresh on every session refetch, so the query is
// keyed by the id the attachment carries and takes its URL from whichever
// attachment ref the caller holds at the time.
export function attachmentQueryOptions(
  sessionId: string,
  attachmentRef: AttachmentRef | null,
  sessionAttributes: any,
) {
  return {
    queryKey: ["session-attachment", sessionId, attachmentRef?.id ?? "none"],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const deadline = deadlineOn(signal);
      try {
        return await loadFrame(
          attachmentRef!,
          sessionAttributes,
          deadline.signal,
        );
      } finally {
        deadline.clear();
      }
    },
    enabled: attachmentRef !== null,
    staleTime: Infinity,
    gcTime: attachmentGcTimeMs,
    // An attachment that failed stays failed until a re-signed session brings
    // new URLs, so the stage drawing it again does not set off another fetch.
    retryOnMount: false,
    // Both the window fetching ahead and the stage drawing an attachment ask for
    // the same query, so reporting from either of them would count some
    // failures twice. Reporting from here, where a fetch runs out of attempts,
    // counts each failure once no matter which of the two asked for it.
    retry: (failureCount: number, error: unknown) => {
      if (isCancellation(error)) {
        return false;
      }
      if (failureCount < attachmentFetchRetries) {
        return true;
      }
      reportAttachmentFailure(attachmentRef!, error);
      return false;
    },
  };
}

// Leaving the replay aborts the fetches in flight, and a window that moves on
// drops the attachments it no longer covers, so those rejections say nothing
// about the attachment.
export function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function reportAttachmentFailure(
  attachmentRef: AttachmentRef,
  error: unknown,
): void {
  console.error(
    `session replay could not load attachment ${attachmentRef.id}`,
    error,
  );
  posthog.captureException(
    new Error("session replay failed to load an attachment"),
    {
      attachment_id: attachmentRef.id,
      attachment_format: attachmentRef.format,
    },
  );
}

// A response that never arrives would hold one of the eight fetch slots for
// good, so every fetch carries a deadline alongside the query's cancellation
// signal. The caller gets a clear() function to stop the timer when the fetch
// finishes. jsdom has neither AbortSignal.any nor AbortSignal.timeout, so the
// signals are combined by hand; without them, the tests would run with no
// deadline at all.
function deadlineOn(signal: AbortSignal): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new Error("attachment fetch timed out")),
    attachmentFetchTimeoutMs,
  );
  const onAbort = () => {
    window.clearTimeout(timer);
    controller.abort(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

// The index of the attachment at the given offset into the replay, or of the
// next one after it. This is the centre the window is measured from.
export function attachmentRefIndexAt(
  attachmentRefs: AttachmentRef[],
  atOffsetMs: number,
): number {
  let low = 0;
  let high = attachmentRefs.length - 1;
  let index = attachmentRefs.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (attachmentRefs[mid].atOffsetMs >= atOffsetMs) {
      index = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return index;
}

// The attachments the window covers, nearest to the centre first, so a seek
// fetches the screen the viewer is looking at before the ones around it.
export function windowedAttachmentRefs(
  attachmentRefs: AttachmentRef[],
  centerIndex: number,
  radius: number,
): AttachmentRef[] {
  const first = Math.max(0, centerIndex - radius);
  const last = Math.min(attachmentRefs.length - 1, centerIndex + radius);
  const windowed: AttachmentRef[] = [];
  let ahead = Math.min(Math.max(centerIndex, first), last + 1);
  let behind = ahead - 1;
  while (ahead <= last || behind >= first) {
    if (ahead <= last) {
      windowed.push(attachmentRefs[ahead]);
      ahead += 1;
    }
    if (behind >= first) {
      windowed.push(attachmentRefs[behind]);
      behind -= 1;
    }
  }
  return windowed;
}

// Brings the query cache in line with where the playhead is: attachments beyond
// the keep radius are dropped, and the ones the window covers are fetched a few
// at a time. An attachment already cached needs no request.
async function reconcileAttachmentWindow(
  client: QueryClient,
  sessionId: string,
  attachmentRefs: AttachmentRef[],
  sessionAttributes: any,
  centerIndex: number,
  cancelled: () => boolean,
): Promise<void> {
  // The attachments to keep are named up front, and the rest are dropped in
  // one pass. Checking after each attachment would search the whole query cache
  // each time, and that cache holds every session the viewer has opened.
  const kept = new Set(
    windowedAttachmentRefs(
      attachmentRefs,
      centerIndex,
      attachmentKeepRadius,
    ).map((attachmentRef) => attachmentRef.id),
  );
  const beyondTheWindow = {
    predicate: (query: Query) =>
      query.queryKey[0] === "session-attachment" &&
      query.queryKey[1] === sessionId &&
      !kept.has(query.queryKey[2] as string),
  };
  client.cancelQueries(beyondTheWindow);
  client.removeQueries(beyondTheWindow);

  // A query with no data is stale even when its stale time is infinite. Without
  // this check, each pass would fetch and report a failed attachment again. Keep
  // the failed query until a refetched session provides new signed URLs.
  const failed = new Set(
    client
      .getQueryCache()
      .getAll()
      .filter(
        (query) =>
          query.queryKey[0] === "session-attachment" &&
          query.queryKey[1] === sessionId &&
          query.state.status === "error",
      )
      .map((query) => query.queryKey[2]),
  );
  const wanted = windowedAttachmentRefs(
    attachmentRefs,
    centerIndex,
    attachmentFetchRadius,
  ).filter((attachmentRef) => !failed.has(attachmentRef.id));
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < wanted.length && !cancelled()) {
      const attachmentRef = wanted[nextIndex];
      nextIndex += 1;
      try {
        await client.fetchQuery(
          attachmentQueryOptions(sessionId, attachmentRef, sessionAttributes),
        );
      } catch {
        // The failure has already been reported by the query's retry handler.
        // An attachment that could not be fetched leaves its own screen blank,
        // and the rest of the window is still worth fetching.
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(attachmentFetchConcurrency, wanted.length) },
      worker,
    ),
  );
}

async function loadFrame(
  attachmentRef: AttachmentRef,
  sessionAttributes: any,
  signal: AbortSignal,
): Promise<Attachment> {
  if (attachmentRef.format === "layout") {
    const root = await fetchAttachment(attachmentRef.url, signal).then(
      (response) => response.json(),
    );
    if (!isLayoutElement(root)) {
      throw new Error(
        `layout snapshot ${attachmentRef.id} is not a tree of elements`,
      );
    }
    return {
      id: attachmentRef.id,
      sourceSize: { width: root.width, height: root.height },
      layerCount: layerCountOf(root),
      content: { kind: "layout", root },
    };
  }

  // Wireframe markup is kept as text rather than handed to the browser as an
  // image, because the stage rewrites the SDK's highlight colour to the team's
  // accent in the markup before drawing it.
  if (attachmentRef.format === "svg") {
    const svg = await fetchAttachment(attachmentRef.url, signal).then(
      (response) => response.text(),
    );
    const box = viewBoxOf(svg);
    if (box === null) {
      throw new Error(
        `wireframe ${attachmentRef.id} has no viewBox to size it by`,
      );
    }
    return {
      id: attachmentRef.id,
      sourceSize: box,
      layerCount: null,
      content: { kind: "svg", markup: svg },
    };
  }

  // Only a screenshot's size is worth keeping. Its pixels are fetched by the
  // img that draws it, from whichever URL the attachment ref holds at the time,
  // so a session refetched with newly signed URLs needs nothing dropped from
  // the query cache.
  const size = await imageSizeOf(attachmentRef.url, signal);
  return {
    id: attachmentRef.id,
    sourceSize: sourceSizeOf(size, sessionAttributes),
    layerCount: null,
    content: { kind: "image" },
  };
}

async function fetchAttachment(
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`fetching ${url} returned ${response.status}`);
  }
  return response;
}

// A raster is drawn at the size the device recorded it at, which only the
// decoded image knows, so it is measured before the stage places it.
export function imageSizeOf(url: string, signal: AbortSignal): Promise<Size> {
  return new Promise<Size>((resolve, reject) => {
    const image = new Image();
    const settle = (outcome: () => void) => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
      outcome();
    };
    // Rejecting with the abort's own reason lets isCancellation above tell the
    // two aborts apart. Leaving the replay produces an AbortError that is
    // ignored, while the deadline produces a plain Error that is reported as a
    // failed attachment fetch.
    const onAbort = () =>
      settle(() => {
        // Clear the source to stop the browser's download. Rejecting alone
        // would free this fetch's slot while the transfer continued. With a slow
        // origin, abandoned downloads could pile up and use bandwidth needed by
        // attachments the playhead is approaching.
        image.src = "";
        reject(signal.reason);
      });
    signal.addEventListener("abort", onAbort, { once: true });
    image.onload = () =>
      settle(() =>
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? resolve({
              width: image.naturalWidth,
              height: image.naturalHeight,
            })
          : reject(new Error(`${url} decoded to an empty image`)),
      );
    image.onerror = () =>
      settle(() => reject(new Error(`${url} did not load`)));
    image.src = url;
  });
}

// The size a wireframe is drawn at comes from its viewBox, which the SDKs write
// as four numbers, the last two being the width and height.
export function viewBoxOf(
  svg: string,
): { width: number; height: number } | null {
  const match = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (!match) {
    return null;
  }
  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function isLayoutElement(value: any): value is LayoutElement {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

const emptyAttachmentRefs: AttachmentRef[] = [];
// Keeps the query cache stocked with the attachments around the playhead. The
// window is worked out again each time the playhead crosses a stride of
// attachments, and each run stops fetching when the next one takes over.
export function useAttachmentWindow(
  actor: SessionReplayActor,
  sessionId: string,
  replay: Replay | null,
  sessionAttributes: any,
) {
  const client = useQueryClient();
  const attachmentRefs = replay?.attachmentRefs ?? emptyAttachmentRefs;
  // The playhead's attachment index, rounded down to a stride, so this changes
  // once per stride of attachments crossed rather than on every clock tick.
  const windowCenterIndex = useSelector(
    actor,
    (snapshot) =>
      Math.floor(
        attachmentRefIndexAt(
          attachmentRefs,
          snapshot.context.playheadOffsetMs,
        ) / attachmentWindowStride,
      ) * attachmentWindowStride,
  );
  // A refetched session carries newly signed URLs, which is what an attachment
  // rejected with a 403 needs, so its query is dropped and the window below
  // fetches it again.
  useEffect(() => {
    client.removeQueries({
      predicate: (query: Query) =>
        query.queryKey[0] === "session-attachment" &&
        query.queryKey[1] === sessionId &&
        query.state.status === "error",
    });
  }, [client, sessionId, attachmentRefs]);

  useEffect(() => {
    if (attachmentRefs.length === 0) {
      return;
    }
    let moved = false;
    reconcileAttachmentWindow(
      client,
      sessionId,
      attachmentRefs,
      sessionAttributes,
      windowCenterIndex,
      () => moved,
    );
    // The next window takes over the fetching and keeps any in-flight requests
    // it still covers. This run stops its loop and leaves the cache alone.
    return () => {
      moved = true;
    };
  }, [client, sessionId, attachmentRefs, sessionAttributes, windowCenterIndex]);

  // Leaving the replay cancels the downloads it started and drops what they
  // brought in, so the window's attachments are released on the way out instead
  // of waiting for the query cache to drop them.
  useEffect(() => {
    return () => {
      const queryKey = ["session-attachment", sessionId];
      client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    };
  }, [client, sessionId]);
}
