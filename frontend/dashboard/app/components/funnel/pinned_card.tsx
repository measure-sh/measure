"use client";

import { ResponsiveBarCanvas } from "@nivo/bar";
import {
  ArrowDown,
  ArrowUp,
  Pin,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DateTime } from "luxon";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Funnel, FunnelTrend } from "../../api/api_calls";
import { type FilterParams, useFunnelTrendQuery } from "../../query/hooks";
import { urlFiltersKeyMap } from "../../stores/filters_store";
import { formatConversionWindow, funnelHref, trendPeriodRange } from "./format";
import { numberToKMB } from "../../utils/number_utils";
import { formatMillisToHumanReadable } from "../../utils/time_utils";
import { Button } from "../button";
import { Card } from "../card";
import { DateRange } from "../filter_bar/date_range_select";
import FunnelSteps from "./steps";
import Pill from "../pill";
import { PlotTooltipShell, PlotTooltipSwatch } from "../plot_tooltip";
import SimpleTooltip from "../simple_tooltip";
import { Skeleton } from "../skeleton";

type TrendPoint = FunnelTrend["points"][number];

type DropOff = { eventName: string; share: number };

// Every pinned card has the same width, so metric columns of capped width line
// up the weekly plots of stacked cards. A card too narrow for one row puts the
// metrics in two columns above the plot.
const METRIC_GRID =
  "grid grid-cols-2 items-start gap-x-8 gap-y-4 @3xl:grid-cols-[minmax(0,13rem)_minmax(0,8rem)_minmax(0,8rem)_minmax(0,10rem)_minmax(8rem,1fr)]";

function conversionOf(point: TrendPoint): number | null {
  const { steps } = point;
  return steps[0].users === 0
    ? null
    : Number(
        ((steps[steps.length - 1].users / steps[0].users) * 100).toFixed(1),
      );
}

// The step that loses the largest share of the users who reached the step
// before it.
function biggestDropOff(
  eventNames: string[],
  point: TrendPoint,
): DropOff | null {
  let worst: DropOff | null = null;
  for (let i = 1; i < point.steps.length; i++) {
    const from = point.steps[i - 1].users;
    if (from === 0) {
      continue;
    }
    const share = (1 - point.steps[i].users / from) * 100;
    if (worst === null || share > worst.share) {
      worst = { eventName: eventNames[i], share };
    }
  }
  return worst;
}

export function FunnelPinButton({
  pinned,
  disabled,
  onClick,
}: {
  pinned: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <SimpleTooltip content={pinned ? "Unpin" : "Pin"} side="top" align="center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={pinned ? "Unpin funnel" : "Pin funnel"}
        aria-pressed={pinned}
        disabled={disabled}
        onClick={onClick}
        className={pinned ? undefined : "text-muted-foreground"}
      >
        <Pin fill={pinned ? "currentColor" : "none"} />
      </Button>
    </SimpleTooltip>
  );
}

function Metric({
  label,
  value,
  detail,
  bold = false,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="font-display text-xs text-muted-foreground truncate">
        {label}
      </p>
      <p
        className={`font-code truncate text-xl ${bold ? "font-semibold" : ""}`}
      >
        {value}
      </p>
      {detail !== undefined && (
        <div className="font-code text-xs text-muted-foreground truncate">
          {detail}
        </div>
      )}
    </div>
  );
}

// The change is rounded like the conversions it compares, so two weeks that
// show the same conversion do not show a change.
function WeekChange({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const change = Number((current - previous).toFixed(1));
  if (change === 0) {
    return <span className="block truncate">Same as week before</span>;
  }
  const better = change > 0;
  const Icon = better ? TrendingUp : TrendingDown;
  const color = better
    ? "text-green-600 dark:text-green-400"
    : "text-yellow-600 dark:text-yellow-400";
  return (
    <span className={`flex items-center gap-1 min-w-0 ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">
        {better ? "+" : ""}
        {change} pts vs week before
      </span>
    </span>
  );
}

function WeeklyConversionPlot({
  points,
  href,
}: {
  points: TrendPoint[];
  href: string | null;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const completeColor = resolvedTheme === "dark" ? "#a1a1a1" : "#a3a3a3";
  const incompleteColor = resolvedTheme === "dark" ? "#404040" : "#e5e5e5";
  const data = points.map((point) => ({
    datetime: point.datetime,
    conversion: conversionOf(point) ?? 0,
    entered: point.steps[0].users,
  }));

  const weekHref = (href: string, point: TrendPoint) => {
    const { start, end } = trendPeriodRange(point.datetime, "week");
    const [path, query] = href.split("?");
    const params = new URLSearchParams(query);
    params.set(urlFiltersKeyMap.dateRange, DateRange.Custom);
    params.set(urlFiltersKeyMap.startDate, start.toISO()!);
    params.set(urlFiltersKeyMap.endDate, end.toISO()!);
    return `${path}?${params}`;
  };

  return (
    // The plot is raised above the card link so hovering a bar shows its
    // tooltip. A click on a bar opens the funnel over that bar's week, and a
    // click between bars opens it like the rest of the card.
    <div
      className={`relative z-20 h-16 w-full border-b border-border ${href === null ? "" : "cursor-pointer"}`}
      onClick={() => {
        if (href !== null) {
          router.push(href);
        }
      }}
    >
      <ResponsiveBarCanvas
        data={data}
        keys={["conversion"]}
        indexBy="datetime"
        colors={({ index }) =>
          points[index].complete ? completeColor : incompleteColor
        }
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        padding={0.2}
        valueScale={{ type: "linear", min: 0 }}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={null}
        enableGridY={false}
        enableLabel={false}
        onClick={(bar, event) => {
          event.stopPropagation();
          if (href !== null) {
            router.push(weekHref(href, points[bar.index]));
          }
        }}
        tooltip={({ data, index, color }) => (
          <PlotTooltipShell className="px-4 py-2">
            <p className="p-2">
              Week of{" "}
              {DateTime.fromISO(String(data.datetime)).toFormat("d MMM, yyyy")}
              {points[index].complete ? "" : " · Still converting"}
            </p>
            <div className="flex flex-row items-center p-2">
              <PlotTooltipSwatch color={color} />
              <span className="px-2">
                {data.entered === 0
                  ? "No users entered"
                  : `${data.conversion}% conversion`}
              </span>
            </div>
            <p className="p-2">
              Users entered: {numberToKMB(Number(data.entered))}
            </p>
            <p className="p-2 text-muted-foreground">Click to open this week</p>
          </PlotTooltipShell>
        )}
      />
    </div>
  );
}

export default function FunnelPinnedCard({
  teamId,
  funnel,
  params,
  reordering,
  isFirst,
  isLast,
  pinDisabled,
  onMoveUp,
  onMoveDown,
  onUnpin,
}: {
  teamId: string;
  funnel: Funnel;
  params: FilterParams | null;
  reordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  pinDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUnpin: () => void;
}) {
  // While the user reorders the pinned funnels, the card has no link, so a
  // click cannot leave the page and lose the unsaved order.
  const href = reordering ? null : funnelHref(teamId, funnel, "pinned");
  const trendQuery = useFunnelTrendQuery(params, funnel.id, "week", false);
  const points = trendQuery.data?.points ?? [];
  // Users who entered in the latest weeks can still convert within the
  // conversion window, so the metrics describe the last week that has finished
  // converting.
  const completed = points.filter((point) => point.complete);
  const latest = completed.at(-1);
  const previous = completed.at(-2);
  const conversion = latest ? conversionOf(latest) : null;
  const previousConversion = previous ? conversionOf(previous) : null;
  const dropOff =
    latest && trendQuery.data
      ? biggestDropOff(trendQuery.data.event_names, latest)
      : null;

  let conversionDetail: React.ReactNode = "No week has finished converting yet";
  if (latest && conversion === null) {
    conversionDetail = "No users entered";
  } else if (previous && previousConversion === null) {
    conversionDetail = "No users entered the week before";
  } else if (conversion !== null && previousConversion !== null) {
    conversionDetail = (
      <WeekChange current={conversion} previous={previousConversion} />
    );
  } else if (latest) {
    conversionDetail = "No earlier week to compare";
  }

  return (
    <Card className="relative w-full p-5 font-body select-none has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50">
      {href !== null && (
        <Link
          href={href}
          className="absolute inset-0 z-10 rounded-lg outline-none"
          aria-label={funnel.name}
        />
      )}
      <div className="@container flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3 min-w-0">
            <p className="font-display text-lg truncate">{funnel.name}</p>
            <div className="flex items-center gap-2 min-w-0">
              <FunnelSteps funnel={funnel} />
              <Pill>
                {`Conversion window: ${formatConversionWindow(funnel.conversion_window_seconds)}`}
              </Pill>
            </div>
          </div>
          {reordering ? (
            <div className="flex shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${funnel.name} up`}
                disabled={isFirst}
                onClick={onMoveUp}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${funnel.name} down`}
                disabled={isLast}
                onClick={onMoveDown}
              >
                <ArrowDown />
              </Button>
            </div>
          ) : (
            <div className="relative z-20">
              <FunnelPinButton
                pinned
                disabled={pinDisabled}
                onClick={onUnpin}
              />
            </div>
          )}
        </div>

        {trendQuery.isPending && (
          <div className={METRIC_GRID}>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20 col-span-2 @3xl:col-span-1" />
          </div>
        )}

        {trendQuery.isError && (
          <p className="text-sm text-muted-foreground">
            Error fetching weekly conversion, please refresh page to try again
          </p>
        )}

        {trendQuery.isSuccess && (
          <div className={METRIC_GRID}>
            <Metric
              bold
              label={
                latest
                  ? `Conversion · Week of ${DateTime.fromISO(latest.datetime).toFormat("d MMM")}`
                  : "Conversion"
              }
              value={conversion === null ? "–" : `${conversion}%`}
              detail={conversionDetail}
            />
            <Metric
              label="Users entered"
              value={latest ? numberToKMB(latest.steps[0].users) : "–"}
              detail={
                latest
                  ? `${numberToKMB(latest.steps[latest.steps.length - 1].users)} converted`
                  : undefined
              }
            />
            <Metric
              label="Time to convert"
              value={
                latest?.median_seconds_to_convert != null
                  ? formatMillisToHumanReadable(
                      latest.median_seconds_to_convert * 1000,
                    )
                  : "–"
              }
              detail="Median"
            />
            <Metric
              label="Biggest drop-off"
              value={dropOff === null ? "–" : `${dropOff.share.toFixed(0)}%`}
              detail={
                dropOff === null ? undefined : `before ${dropOff.eventName}`
              }
            />
            <div className="flex flex-col gap-1 min-w-0 col-span-2 @3xl:col-span-1">
              <p className="font-display text-xs text-muted-foreground">
                Weekly conversion
              </p>
              <WeeklyConversionPlot points={points} href={href} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
