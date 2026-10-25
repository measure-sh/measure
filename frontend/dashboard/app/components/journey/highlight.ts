import type {
  Journey,
  JourneyLink,
  JourneyNode,
  JourneySelection,
} from "@/app/api/api_calls";

export type Highlight = {
  active: boolean;
  isSelectedNode: (id: string) => boolean;
  isLitNode: (id: string) => boolean;
  isSelectedLink: (link: JourneyLink) => boolean;
  isLitLink: (link: JourneyLink) => boolean;
  // Whether a link goes to the node from the last node of the selection, so
  // the node can come next in the path.
  isNextNode: (id: string) => boolean;
};

export function sameLink(a: JourneyLink, b: JourneyLink): boolean {
  return a.source === b.source && a.target === b.target;
}

// Two selections are the same when this key is the same. A link and a path of
// the same two nodes get different keys.
export function selectionKey(selection: JourneySelection): string {
  if ("node" in selection) {
    return `node:${selection.node}`;
  }
  if ("path" in selection) {
    return `path:${selection.path.join(">")}`;
  }
  return `link:${selection.source}>${selection.target}`;
}

function nodesOf(selection: JourneySelection): string[] {
  return "node" in selection
    ? [selection.node]
    : "path" in selection
      ? selection.path
      : [selection.source, selection.target];
}

// A path follows links. Thus only the links out of the last node of the
// selection go to nodes that can come next.
function nextLinks(journey: Journey, selection: JourneySelection) {
  const nodes = nodesOf(selection);
  const last = nodes[nodes.length - 1];
  return journey.links.filter((link) => link.source === last);
}

// The node goes on the end of the selection when a link goes to it from the
// last node of the selection. Thus a node or a link becomes a path. When the
// node is the last node, the function removes it. For other nodes, the
// selection does not change.
export function extendSelection(
  journey: Journey,
  selection: JourneySelection | null,
  node: JourneyNode,
): JourneySelection | null {
  if (selection === null) {
    return { node: node.id };
  }
  const path = nodesOf(selection);
  if (node.id === path[path.length - 1]) {
    const rest = path.slice(0, -1);
    return rest.length === 0
      ? null
      : rest.length === 1
        ? { node: rest[0] }
        : { path: rest };
  }
  if (!nextLinks(journey, selection).some((l) => l.target === node.id)) {
    return selection;
  }
  return { path: [...path, node.id] };
}

// A selected node lights itself, the links into and out of it, and the nodes
// at the other ends of these links. The highlight does not follow links
// further. Sessions move back and forth between screens, so most of the graph
// would light. A selected link or path lights its nodes and links. Each
// selection also lights the links out of its last node and the nodes at their
// ends. These nodes can come next in the path.
export function highlightOf(
  journey: Journey,
  selection: JourneySelection | null,
): Highlight {
  if (selection === null) {
    return {
      active: false,
      isSelectedNode: () => false,
      isLitNode: () => false,
      isSelectedLink: () => false,
      isLitLink: () => false,
      isNextNode: () => false,
    };
  }
  const next = nextLinks(journey, selection);
  const nextIds = new Set(next.map((link) => link.target));
  if ("node" in selection) {
    const isLitLink = (link: JourneyLink) =>
      link.source === selection.node || link.target === selection.node;
    const litIds = new Set([selection.node]);
    for (const link of journey.links.filter(isLitLink)) {
      litIds.add(link.source);
      litIds.add(link.target);
    }
    return {
      active: true,
      isSelectedNode: (id) => id === selection.node,
      isLitNode: (id) => litIds.has(id),
      isSelectedLink: () => false,
      isLitLink,
      isNextNode: (id) => nextIds.has(id),
    };
  }
  const nodes = nodesOf(selection);
  const isSelectedLink = (link: JourneyLink) =>
    nodes.some((id, i) => id === link.source && nodes[i + 1] === link.target);
  return {
    active: true,
    isSelectedNode: (id) => "path" in selection && nodes.includes(id),
    isLitNode: (id) => nodes.includes(id) || nextIds.has(id),
    isSelectedLink,
    isLitLink: (link) =>
      isSelectedLink(link) || next.some((n) => sameLink(n, link)),
    isNextNode: (id) => nextIds.has(id),
  };
}
