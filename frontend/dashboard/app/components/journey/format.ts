import type { JourneyNode } from "@/app/api/api_calls";
import { useChartColor } from "@/app/utils/chart_utils";
import { numberToKMB } from "@/app/utils/number_utils";
import { formatMillisToHumanReadable } from "@/app/utils/time_utils";
import { formatShare } from "../funnel/format";

export const KIND_LABELS: Record<JourneyNode["kind"], string> = {
  screen: "Screen",
  event: "Custom event",
  fatal: "Fatal error",
};

export function useKindColours(): Record<JourneyNode["kind"], string> {
  const chartColor = useChartColor();
  return {
    screen: chartColor.blue,
    event: chartColor.violet,
    fatal: chartColor.red,
  };
}

// Screen names are often fully qualified class names, whose last segment is
// the part people recognise.
export function shortName(name: string): string {
  return name.split(".").pop() || name;
}

export function formatUsers(users: number): string {
  return `${numberToKMB(users)} ${users === 1 ? "user" : "users"}`;
}

export type Stat = { label: string; value: string; className?: string };

const DROPPED_CLASS = "text-red-600 dark:text-red-400";

// Continuing and dropping off don't apply to the fatal error node, which ends
// every session that reaches it.
export function nodeStats(node: JourneyNode): Stat[] {
  const stats: Stat[] = [{ label: "Users", value: numberToKMB(node.users) }];
  if (node.kind !== "fatal") {
    const dropping = node.users - node.continuing;
    stats.push(
      {
        label: "Continuing",
        value: `${numberToKMB(node.continuing)} (${formatShare(node.continuing, node.users)})`,
      },
      {
        label: "Dropping off",
        value: `${numberToKMB(dropping)} (${formatShare(dropping, node.users)})`,
        className: dropping > 0 ? DROPPED_CLASS : undefined,
      },
    );
  }
  if (node.median_ms_from_previous !== null) {
    stats.push({
      label: "Median time from previous step",
      value: formatMillisToHumanReadable(node.median_ms_from_previous),
    });
  }
  return stats;
}

export function linkStats(source: JourneyNode, users: number): Stat[] {
  return [
    { label: "Users", value: numberToKMB(users) },
    {
      label: `Conversion from ${shortName(source.name)}`,
      value: formatShare(users, source.users),
    },
  ];
}
