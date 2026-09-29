"use client";

import { type AttributeDistributionResponse } from "@/app/api/api_calls";
import {
  type AttributeDistribution,
  type DistributionAttribute,
  distributionAttributes,
  parseAttributeDistribution,
  type useErrorsAttributeDistributionPlotQuery,
  type useErrorsDistributionPlotQuery,
} from "@/app/query/hooks";
import { ResponsiveBar } from "@nivo/bar";
import { ArrowLeft, ChartColumn } from "lucide-react";
import React from "react";
import { numberToKMB } from "../utils/number_utils";
import { cn } from "../utils/shadcn_utils";
import { chartTheme, useChartColors } from "../utils/shared_styles";
import { Button } from "./button";
import EmptyState from "./empty_state";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import { SkeletonPlot } from "./skeleton";

const demoValues: Record<DistributionAttribute, [string, number][]> = {
  app_version: [
    ["2.0.0 (200)", 2204],
    ["1.0.0 (100)", 1796],
  ],
  os_version: [
    ["android 33", 2400],
    ["android 34", 800],
    ["android 31", 400],
    ["android 30", 200],
    ["android 29", 120],
    ["android 28", 80],
  ],
  country: [
    ["US", 1800],
    ["UK", 900],
    ["IN", 700],
    ["DE", 300],
    ["BR", 180],
    ["JP", 120],
  ],
  network_type: [
    ["wifi", 2700],
    ["cellular", 1300],
  ],
  locale: [
    ["en-US", 1600],
    ["en-GB", 900],
    ["en-IN", 700],
    ["de-DE", 400],
    ["pt-BR", 250],
    ["ja-JP", 150],
  ],
  device: [
    ["Samsung - Galaxy S23", 1100],
    ["Google - Pixel 8", 820],
    ["Samsung - Galaxy A54", 610],
    ["Google - Pixel 7 Pro", 470],
    ["Xiaomi - Redmi Note 12", 350],
    ["Motorola - Razr", 240],
    ["OnePlus - 11", 190],
    ["Samsung - Galaxy S21", 130],
    ["Google - Pixel 6a", 90],
  ],
};

const demoSummary = distributionAttributes.map((attribute) => {
  const values = demoValues[attribute];
  const response: AttributeDistributionResponse = {
    values: values.slice(0, 5).map(([value, count]) => ({ value, count })),
    other_count: values.slice(5).reduce((sum, [, count]) => sum + count, 0),
    distinct_count: values.length,
  };
  return parseAttributeDistribution(attribute, response);
});

function formatShare(count: number, total: number): string {
  if (total === 0) {
    return "0%";
  }
  const share = (count / total) * 100;
  if (share > 0 && share < 0.1) {
    return "<0.1%";
  }
  return `${share.toFixed(share < 10 ? 1 : 0)}%`;
}

function otherLabel(distribution: AttributeDistribution): string {
  const others = distribution.distinctCount - distribution.values.length;
  return `Other (${others} ${others === 1 ? "value" : "values"})`;
}

// Long names are cut so the rotated labels fit in the bottom margin. The
// tooltip shows the full name.
function truncateLabel(label: string): string {
  return label.length > 11 ? `${label.slice(0, 10)}…` : label;
}

// Both charts share these margins so their axes stay in place when the user
// switches between them.
const chartMargin = { top: 40, right: 20, bottom: 180, left: 60 };

const summaryPadding = 0.6;

// Both charts span the same width, so the padding shrinks as the number of
// values grows to keep an attribute's bars as wide as the summary's, down to a
// minimum once the columns get too narrow.
function attributeChartPadding(values: number): number {
  return Math.max(
    0.1,
    1 - ((1 - summaryPadding) * values) / distributionAttributes.length,
  );
}

const errorInstancesAxis = {
  tickSize: 1,
  tickPadding: 5,
  format: (value: number) =>
    Number.isInteger(value) ? numberToKMB(value) : "",
  legend: "Error instances",
  legendOffset: -50,
  legendPosition: "middle" as const,
};

interface DistributionTooltipProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const DistributionTooltip: React.FC<DistributionTooltipProps> = ({
  label,
  count,
  total,
  color,
}) => (
  <PlotTooltipShell>
    <div className="flex flex-row items-center p-2">
      <PlotTooltipSwatch color={color} />
      <span className="px-2">
        {label} - {numberToKMB(count)} {count === 1 ? "instance" : "instances"}{" "}
        ({formatShare(count, total)})
      </span>
    </div>
  </PlotTooltipShell>
);

const otherKey = "other";

function valueKey(rank: number): string {
  return `value-${rank}`;
}

interface SummaryChartProps {
  summary: AttributeDistribution[];
  demo: boolean;
  onSelect: (attribute: DistributionAttribute) => void;
}

// Keys are value ranks, since every attribute has different values.
const SummaryChart: React.FC<SummaryChartProps> = ({
  summary,
  demo,
  onSelect,
}) => {
  const chartColors = useChartColors();
  const ranks = Math.max(
    ...summary.map((distribution) => distribution.values.length),
  );
  const keys = [
    ...Array.from({ length: ranks }, (_, rank) => valueKey(rank)),
    otherKey,
  ];
  const data = summary.map((distribution) => ({
    attribute: distribution.attribute,
    ...Object.fromEntries(
      distribution.values.map(({ count }, rank) => [valueKey(rank), count]),
    ),
    ...(distribution.otherCount > 0
      ? { [otherKey]: distribution.otherCount }
      : {}),
  }));
  const byAttribute = new Map(
    summary.map((distribution) => [distribution.attribute, distribution]),
  );

  return (
    <ResponsiveBar
      data={data}
      keys={keys}
      indexBy="attribute"
      theme={chartTheme}
      colors={chartColors}
      margin={chartMargin}
      padding={summaryPadding}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        legend: "Attributes",
        tickPadding: 10,
        legendOffset: 100,
        tickRotation: 60,
        legendPosition: "middle",
        format: (attribute) => byAttribute.get(attribute)?.label ?? "",
      }}
      axisLeft={{ ...errorInstancesAxis, legendOffset: demo ? -55 : -50 }}
      enableLabel={false}
      enableGridX={false}
      enableGridY={false}
      onClick={({ indexValue }) =>
        onSelect(indexValue as DistributionAttribute)
      }
      tooltip={({ id, indexValue, value, color }) => {
        const distribution = byAttribute.get(
          indexValue as DistributionAttribute,
        )!;
        return (
          <DistributionTooltip
            label={
              id === otherKey
                ? otherLabel(distribution)
                : distribution.values[keys.indexOf(String(id))].label
            }
            count={value}
            total={distribution.total}
            color={color}
          />
        );
      }}
    />
  );
};

interface AttributeChartProps {
  distribution: AttributeDistribution;
}

// Bars are indexed by position, because two values can share a label once
// formatted.
const AttributeChart: React.FC<AttributeChartProps> = ({ distribution }) => {
  const chartColors = useChartColors();
  const data = distribution.values.map(({ label, count }, i) => ({
    id: String(i),
    label,
    count,
  }));

  return (
    <ResponsiveBar
      data={data}
      keys={["count"]}
      indexBy="id"
      theme={chartTheme}
      colors={chartColors}
      colorBy="indexValue"
      margin={chartMargin}
      padding={attributeChartPadding(data.length)}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        legend: distribution.label,
        tickPadding: 10,
        legendOffset: 100,
        tickRotation: 60,
        legendPosition: "middle",
        format: (id) => truncateLabel(data[Number(id)].label),
      }}
      axisLeft={errorInstancesAxis}
      enableLabel={false}
      enableGridX={false}
      enableGridY={false}
      tooltip={({ data: datum, value, color }) => (
        <DistributionTooltip
          label={datum.label}
          count={value}
          total={distribution.total}
          color={color}
        />
      )}
    />
  );
};

interface ErrorsDistributionPlotProps {
  query?: ReturnType<typeof useErrorsDistributionPlotQuery>;
  attributeQuery?: ReturnType<typeof useErrorsAttributeDistributionPlotQuery>;
  selected?: DistributionAttribute | null;
  onSelect?: (attribute: DistributionAttribute | null) => void;
  demo?: boolean;
}

const ErrorsDistributionPlot: React.FC<ErrorsDistributionPlotProps> = ({
  query,
  attributeQuery,
  selected = null,
  onSelect = () => {},
  demo = false,
}) => {
  const effectiveStatus = demo ? "success" : (query?.status ?? "pending");
  const summary = demo ? demoSummary : query?.data;
  const selectedSummary = summary?.find(
    (distribution) => distribution.attribute === selected,
  );
  const selectedDistribution = attributeQuery?.data;

  return (
    <div
      data-testid="exception-distribution-plot"
      className="flex font-body items-center justify-center w-full md:w-1/2 h-128 select-none"
    >
      {effectiveStatus === "pending" && <SkeletonPlot />}
      {effectiveStatus === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {effectiveStatus === "success" && summary === null && (
        <div
          data-testid="exception-distribution-plot-no-data"
          className="size-full pt-2 md:pt-0 md:pl-2"
        >
          <EmptyState
            icon={ChartColumn}
            title="No distribution data found"
            description="Try a wider time range or different filters"
            className="h-full"
          />
        </div>
      )}
      {effectiveStatus === "success" && summary && !selectedSummary && (
        <div
          data-testid="exception-distribution-plot-data"
          className="size-full"
        >
          <SummaryChart summary={summary} demo={demo} onSelect={onSelect} />
        </div>
      )}
      {effectiveStatus === "success" && selectedSummary && attributeQuery && (
        <div
          data-testid="exception-distribution-plot-details"
          className="relative size-full"
        >
          {selectedDistribution &&
            !attributeQuery.isPlaceholderData &&
            selectedDistribution.distinctCount >
              selectedDistribution.values.length && (
              <p className="absolute left-8 top-0 z-10 flex h-8 items-center text-xs text-muted-foreground">
                Showing {selectedDistribution.values.length} of{" "}
                {selectedDistribution.distinctCount} values
              </p>
            )}
          <Button
            variant="outline"
            size="sm"
            className="absolute right-0 top-0 z-10"
            onClick={() => onSelect(null)}
          >
            <ArrowLeft />
            All attributes
          </Button>
          {attributeQuery.status === "error" && (
            <p className="text-lg font-display text-center p-4">
              Error fetching values, please change filters or refresh page to
              try again
            </p>
          )}
          {attributeQuery.status === "pending" && <SkeletonPlot />}
          {selectedDistribution && attributeQuery.status !== "error" && (
            <div
              className={cn(
                "size-full transition-opacity",
                attributeQuery.isPlaceholderData && "opacity-60",
              )}
            >
              <AttributeChart distribution={selectedDistribution} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorsDistributionPlot;
