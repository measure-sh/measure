import { useEffect, useState } from "react";
import type { Journey, JourneySelection } from "@/app/api/api_calls";
import type { PageUrlEntries } from "@/app/components/filter_bar/use_filter_page";
import { sameLink } from "./highlight";

const nodeUrlKey = "jn";
const sourceUrlKey = "js";
const targetUrlKey = "jt";
const pathUrlKey = "jp";
export const shownNodesUrlKey = "jk";

export function selectionFromUrl(params: {
  get: (key: string) => string | null;
  getAll: (key: string) => string[];
}): JourneySelection | null {
  const node = params.get(nodeUrlKey);
  if (node !== null) {
    return { node };
  }
  const source = params.get(sourceUrlKey);
  const target = params.get(targetUrlKey);
  if (source !== null && target !== null) {
    return { source, target };
  }
  const path = params.getAll(pathUrlKey);
  return path.length >= 2 ? { path } : null;
}

export function selectionUrlEntries(
  selection: JourneySelection | null,
): PageUrlEntries {
  return {
    [nodeUrlKey]:
      selection !== null && "node" in selection ? selection.node : null,
    [sourceUrlKey]:
      selection !== null && "source" in selection ? selection.source : null,
    [targetUrlKey]:
      selection !== null && "target" in selection ? selection.target : null,
    [pathUrlKey]:
      selection !== null && "path" in selection ? selection.path : null,
  };
}

// A selection from the URL can be from other data or other shown nodes, so it
// is kept only when the journey has its nodes and links.
export function selectionIn(
  journey: Journey,
  selection: JourneySelection,
): boolean {
  const hasNode = (id: string) => journey.nodes.some((node) => node.id === id);
  const hasLink = (source: string, target: string) =>
    journey.links.some((link) => sameLink(link, { source, target }));
  if ("node" in selection) {
    return hasNode(selection.node);
  }
  if ("path" in selection) {
    return (
      selection.path.every(hasNode) &&
      selection.path.every(
        (id, i) => i === 0 || hasLink(selection.path[i - 1], id),
      )
    );
  }
  return hasLink(selection.source, selection.target);
}

// The ids of the nodes can be long, so the URL holds them compressed with
// deflate, in base64url.
export async function encodeNodeIds(ids: string[]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(ids));
  const stream = new Response(json).body!.pipeThrough(
    new CompressionStream("deflate-raw"),
  );
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// Gives null for a value that is not a list of ids from encodeNodeIds.
export async function decodeNodeIds(value: string): Promise<string[] | null> {
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const stream = new Response(bytes).body!.pipeThrough(
      new DecompressionStream("deflate-raw"),
    );
    const ids: unknown = JSON.parse(await new Response(stream).text());
    return Array.isArray(ids) && ids.every((id) => typeof id === "string")
      ? ids
      : null;
  } catch {
    return null;
  }
}

// Decoding is asynchronous, so the ids are pending until the value in the URL
// is decoded. remember stores the ids of a value the page writes, and the ids
// of the value in the URL stay stored, so neither waits for decoding while
// the URL changes from one to the other.
export function useNodeIds(value: string | null): {
  pending: boolean;
  ids: string[] | null;
  remember: (value: string, ids: string[]) => void;
} {
  const [decoded, setDecoded] = useState<Map<string, string[] | null>>(
    () => new Map(),
  );
  const known = value !== null && decoded.has(value);

  useEffect(() => {
    if (value === null || known) {
      return;
    }
    let current = true;
    decodeNodeIds(value).then((ids) => {
      if (current) {
        setDecoded(new Map([[value, ids]]));
      }
    });
    return () => {
      current = false;
    };
  }, [value, known]);

  return {
    pending: value !== null && !known,
    ids: known ? (decoded.get(value) ?? null) : null,
    remember: (next, ids) =>
      setDecoded((current) => {
        const kept = new Map<string, string[] | null>([[next, ids]]);
        if (value !== null && current.has(value)) {
          kept.set(value, current.get(value)!);
        }
        return kept;
      }),
  };
}
