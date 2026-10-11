"use client";

import { type FunnelCustomLayerProps, ResponsiveFunnel } from "@nivo/funnel";
import { Fragment } from "react";
import type { FunnelConversion } from "../../api/api_calls";
import { CHART_TEXT_SIZE, chartTheme } from "../../utils/chart_utils";
import { formatShare } from "./format";
import { useStepColor } from "./step_color";
import { numberToKMB } from "../../utils/number_utils";
import { formatMillisToHumanReadable } from "../../utils/time_utils";
import { PlotTooltipShell, PlotTooltipSwatch } from "../plot_tooltip";
import { Separator } from "../separator";

function StepTooltip({
  conversion,
  index,
  color,
}: {
  conversion: FunnelConversion;
  index: number;
  color: string;
}) {
  const { steps } = conversion;
  const step = steps[index];
  const previous = index === 0 ? null : steps[index - 1];
  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Users", value: step.users.toLocaleString() },
    {
      label: "Conversion from start",
      value: formatShare(step.users, steps[0].users),
    },
  ];
  if (previous) {
    rows.push(
      {
        label: "Conversion from previous step",
        value: formatShare(step.users, previous.users),
      },
      {
        label: "Dropped",
        value: (previous.users - step.users).toLocaleString(),
        className: "text-red-600 dark:text-red-400",
      },
    );
    if (step.median_seconds_from_previous !== null) {
      rows.push({
        label: "Median time",
        value: formatMillisToHumanReadable(
          step.median_seconds_from_previous * 1000,
        ),
      });
    }
  }

  return (
    <PlotTooltipShell>
      <div className="flex flex-row items-center px-4 py-3">
        <PlotTooltipSwatch color={color} />
        <span className="px-2 font-display">{step.event_name}</span>
      </div>
      <Separator />
      <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 px-4 py-3">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`text-right tabular-nums ${row.className ?? ""}`}>
              {row.value}
            </span>
          </Fragment>
        ))}
      </div>
    </PlotTooltipShell>
  );
}

type StepDatum = { id: number; label: string; value: number };

// nivo draws each step of the funnel as a shape it calls a part. A step's user
// count keeps this much space from the edges of its part.
const PART_LABEL_PADDING = 6;
const PART_LABEL_FONT = `${CHART_TEXT_SIZE}px sans-serif`;

let measureContext: CanvasRenderingContext2D | null = null;

function labelWidth(label: string): number {
  measureContext ??= document.createElement("canvas").getContext("2d")!;
  measureContext.font = PART_LABEL_FONT;
  return measureContext.measureText(label).width + 2 * PART_LABEL_PADDING;
}

// Each step's user count, written across its part. When any part is too narrow
// for its count, as in a funnel of many steps, every count is rotated to read
// from bottom to top so they all read the same way, and a count too long for
// its part either way is left out. The step's tooltip still shows it.
function PartLabels({ parts }: FunnelCustomLayerProps<StepDatum>) {
  const labels = parts.map((part) => String(part.formattedValue));
  const widths = labels.map(labelWidth);
  const across = parts.every((part, i) => widths[i] <= part.width);
  return (
    <g>
      {parts.map((part, i) =>
        across || widths[i] <= part.height ? (
          <text
            key={part.data.id}
            transform={`translate(${part.x}, ${part.y})${across ? "" : " rotate(-90)"}`}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              font: PART_LABEL_FONT,
              fill: part.labelColor,
              pointerEvents: "none",
            }}
          >
            {labels[i]}
          </text>
        ) : null,
      )}
    </g>
  );
}

interface FunnelChartProps {
  conversion: FunnelConversion;
  onSelectStep: (step: number) => void;
}

export default function FunnelChart({
  conversion,
  onSelectStep,
}: FunnelChartProps) {
  const colorOf = useStepColor();
  const { steps } = conversion;
  // Event names can repeat across steps, so parts are keyed by position.
  const data: StepDatum[] = steps.map((step, i) => ({
    id: i,
    label: step.event_name,
    value: step.users,
  }));

  return (
    <div className="w-full h-72 font-body cursor-pointer">
      <ResponsiveFunnel
        data={data}
        direction="horizontal"
        margin={{ top: 20, right: 0, bottom: 20, left: 0 }}
        spacing={8}
        shapeBlending={0.66}
        colors={(datum) => colorOf(datum.id)}
        borderWidth={20}
        borderOpacity={0.35}
        valueFormat={(value) => numberToKMB(value)}
        labelColor={{ from: "color", modifiers: [["darker", 3]] }}
        layers={["parts", PartLabels]}
        currentPartSizeExtension={10}
        currentBorderWidth={28}
        theme={chartTheme}
        tooltip={({ part }) => (
          <StepTooltip
            conversion={conversion}
            index={part.data.id}
            color={part.color}
          />
        )}
        onClick={(part) => {
          if (part.data.id > 0) {
            onSelectStep(part.data.id);
          }
        }}
      />
    </div>
  );
}
