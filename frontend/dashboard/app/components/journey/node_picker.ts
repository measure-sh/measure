import type { Journey, JourneyNode } from "@/app/api/api_calls";

// The graph shows this number of nodes until the user selects which nodes to
// show.
export const DEFAULT_SHOWN_NODES = 25;
// More links than this are too many for a person to read.
const SHOWN_LINKS = 200;

// The screens and custom events of the journey, the ones with the most users
// first. The fatal error node shows when a shown node links to it, so the
// user does not select it.
export function selectableNodes(journey: Journey): JourneyNode[] {
  return journey.nodes
    .filter((node) => node.kind !== "fatal")
    .sort((a, b) => b.users - a.users);
}

// Gives the journey with only the nodes in ids. It has the SHOWN_LINKS links
// with the most users between these nodes, and all their links to the fatal
// error node, which it has when one of these links exists.
export function showNodes(journey: Journey, ids: string[]): Journey {
  const shown = new Set(ids);
  const links: Journey["links"] = [];
  let kept = 0;
  for (const link of [...journey.links].sort((a, b) => b.users - a.users)) {
    const toFatal = link.target === "fatal";
    if (!shown.has(link.source) || (!toFatal && !shown.has(link.target))) {
      continue;
    }
    if (!toFatal) {
      if (kept === SHOWN_LINKS) {
        continue;
      }
      kept++;
    }
    links.push(link);
  }
  if (links.some((link) => link.target === "fatal")) {
    shown.add("fatal");
  }
  return {
    nodes: journey.nodes.filter((node) => shown.has(node.id)),
    links,
    sample_percent: journey.sample_percent,
  };
}
