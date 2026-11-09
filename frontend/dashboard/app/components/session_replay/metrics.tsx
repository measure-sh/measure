"use client";

import { DateTime } from "luxon";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "@xstate/react";
import { kilobytesToMegabytes } from "@/app/utils/number_utils";
import { useChartColor, useChartColors } from "@/app/utils/chart_utils";
import {
  formatChartFormatTimestampToHumanReadable,
  formatTimestampToChartFormat,
} from "@/app/utils/time_utils";
import {
  PlotTooltip,
  PlotTooltipArea,
  PlotTooltipSwatch,
  useTooltipTaps,
} from "@/app/components/plot_tooltip";
import { type SessionReplayActor } from "@/app/components/session_replay/machine";

const laneHeight = 34;

const plotWidth = 1000;
const plotHeight = 100;

type Series = { label: string; color: string; values: (number | null)[] };

type MetricStrip = {
  key: string;
  title: string;
  unit: string;
  max: number;
  times: { absMs: number; iso: string }[];
  series: Series[];
};

function roundUpToNiceMemoryValue(memory: number): number {
  if (memory < 1000) {
    return Math.ceil(memory / 100) * 100;
  }
  if (memory < 1_000_000) {
    return Math.ceil(memory / 1000) * 1000;
  }
  if (memory < 1_000_000_000) {
    return Math.ceil(memory / 1_000_000) * 1_000_000;
  }
  return Math.ceil(memory / 1_000_000_000) * 1_000_000_000;
}

type StripSpec = {
  key: string;
  title: string;
  unit: string;
  samples: any[] | null;
  read: (
    sample: any,
  ) => { label: string; color: string; value: number | null }[];
  max?: number;
};

function buildStrip(
  spec: StripSpec,
  startAbsMs: number,
  endAbsMs: number,
): MetricStrip | null {
  if (!Array.isArray(spec.samples) || spec.samples.length === 0) {
    return null;
  }

  const times: MetricStrip["times"] = [];
  const columns: (number | null)[][] = [];
  let labels: { label: string; color: string }[] = [];
  let peak = 0;

  spec.samples.forEach((sample) => {
    const absMs = DateTime.fromISO(sample.timestamp, {
      zone: "utc",
    }).toMillis();
    if (!Number.isFinite(absMs) || absMs < startAbsMs || absMs > endAbsMs) {
      return;
    }
    const readings = spec.read(sample);
    if (labels.length === 0) {
      labels = readings.map(({ label, color }) => ({ label, color }));
    }
    times.push({ absMs, iso: sample.timestamp });
    columns.push(readings.map((reading) => reading.value));
    readings.forEach((reading) => {
      if (reading.value !== null) peak = Math.max(peak, reading.value);
    });
  });

  if (times.length === 0) {
    return null;
  }

  const last = times[times.length - 1];
  if (last.absMs < endAbsMs) {
    times.push({
      absMs: endAbsMs,
      iso: DateTime.fromMillis(endAbsMs, { zone: "utc" }).toISO() ?? last.iso,
    });
    columns.push(columns[columns.length - 1]);
  }

  return {
    key: spec.key,
    title: spec.title,
    unit: spec.unit,
    max: spec.max ?? Math.max(1, roundUpToNiceMemoryValue(peak)),
    times,
    series: labels.map((label, index) => ({
      ...label,
      values: columns.map((column) => column[index]),
    })),
  };
}

export function useSessionMetricStrips(
  session: any,
  startAbsMs: number,
  endAbsMs: number,
): MetricStrip[] {
  const chartColor = useChartColor();
  const chartColors = useChartColors();

  return useMemo(() => {
    const megabytes =
      (fields: [label: string, color: string, field: string][]) =>
      (sample: any) =>
        fields.map(([label, color, field]) => ({
          label,
          color,
          value: Number.isFinite(sample[field])
            ? kilobytesToMegabytes(sample[field])
            : null,
        }));

    const androidMemoryFields: [string, string, string][] = [
      ["Java Free Heap", chartColor.violet, "java_free_heap"],
      ["Java Max Heap", chartColor.red, "java_max_heap"],
      ["Java Total Heap", chartColor.yellow, "java_total_heap"],
      ["Native Free Heap", chartColor.amber, "native_free_heap"],
      ["Native Total Heap", chartColor.teal, "native_total_heap"],
      ["RSS", chartColor.green, "rss"],
      ["Total PSS", chartColor.pink, "total_pss"],
    ];
    // Older API responses can lack this field. Only plot a complete series.
    if (
      Array.isArray(session.memory_usage) &&
      session.memory_usage.every((sample: any) =>
        Number.isFinite(sample.dynamic_memory),
      )
    ) {
      androidMemoryFields.push([
        "Dynamic Memory",
        chartColor.blue,
        "dynamic_memory",
      ]);
    }

    const specs: StripSpec[] = [
      {
        key: "cpu",
        title: "CPU",
        unit: "%",
        samples: session.cpu_usage,
        read: (sample) => [
          { label: "Cpu Usage", color: chartColors[0], value: sample.value },
        ],
        max: 100,
      },
      {
        key: "memory",
        title: "Memory",
        unit: "MB",
        samples: session.memory_usage,
        read: megabytes(androidMemoryFields),
      },
      {
        key: "memory-absolute",
        title: "Memory",
        unit: "MB",
        samples: session.memory_usage_absolute,
        read: megabytes([
          ["Available Memory", chartColor.blue, "available_memory"],
          ["Max Memory", chartColor.violet, "max_memory"],
          ["Used Memory", chartColor.red, "used_memory"],
        ]),
      },
    ];
    return specs
      .map((spec) => buildStrip(spec, startAbsMs, endAbsMs))
      .filter((strip): strip is MetricStrip => strip !== null);
  }, [session, startAbsMs, endAbsMs, chartColor, chartColors]);
}

function MetricsPlayheadLine({
  actor,
  startAbsMs,
  xFor,
}: {
  actor: SessionReplayActor;
  startAbsMs: number;
  xFor: (absMs: number) => number;
}) {
  const x = useSelector(actor, (snapshot) =>
    xFor(startAbsMs + snapshot.context.playheadOffsetMs),
  );
  return (
    <line
      x1={x}
      x2={x}
      y1={0}
      y2={plotHeight}
      stroke="currentColor"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      className="text-foreground"
    />
  );
}

export const SessionReplayMetrics = memo(function SessionReplayMetrics({
  strips,
  startAbsMs,
  durationMs,
  actor,
  onSeek,
}: {
  strips: MetricStrip[];
  startAbsMs: number;
  durationMs: number;
  actor: SessionReplayActor;
  onSeek: (offsetMs: number) => void;
}) {
  const [hover, setHover] = useState<{
    key: string;
    index: number;
  } | null>(null);
  const tooltipTaps = useTooltipTaps();
  const stripsRef = useRef<HTMLDivElement | null>(null);

  // A touch pointer leaves the strip when the finger lifts, so it keeps the
  // tap's hover until the next press outside the strips.
  useEffect(() => {
    const doc = stripsRef.current?.ownerDocument;
    if (hover === null || !doc) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" &&
        !stripsRef.current?.contains(event.target as Node)
      ) {
        setHover(null);
      }
    };
    doc.addEventListener("pointerdown", onPointerDown, true);
    return () => doc.removeEventListener("pointerdown", onPointerDown, true);
  }, [hover]);

  const xFor = useCallback(
    (absMs: number) => ((absMs - startAbsMs) / durationMs) * plotWidth,
    [startAbsMs, durationMs],
  );

  const seriesLines = useMemo(
    () =>
      new Map(
        strips.map((strip) => [
          strip.key,
          strip.series.map((series) => {
            // Missing available memory is unknown, not zero. Break the line at gaps.
            let penDown = false;
            const commands = series.values.map((value, index) => {
              if (value === null) {
                penDown = false;
                return "";
              }
              const x = xFor(strip.times[index].absMs);
              const y =
                plotHeight -
                (Math.min(value, strip.max) / strip.max) * plotHeight;
              const command = `${penDown ? "L" : "M"}${x},${y}`;
              penDown = true;
              return command;
            });
            const d = commands.filter(Boolean).join(" ");
            if (d === "") return null;
            return (
              <path
                key={series.label}
                fill="none"
                stroke={series.color}
                strokeWidth={1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                d={d}
              />
            );
          }),
        ]),
      ),
    [strips, xFor],
  );

  if (strips.length === 0) {
    return null;
  }

  const nearestTo = (strip: MetricStrip, fraction: number) => {
    const wanted = startAbsMs + fraction * durationMs;
    let nearest = 0;
    for (let index = 1; index < strip.times.length; index++) {
      if (
        Math.abs(strip.times[index].absMs - wanted) <
        Math.abs(strip.times[nearest].absMs - wanted)
      ) {
        nearest = index;
      }
    }
    return nearest;
  };

  const pointTapKey = (strip: MetricStrip, index: number) =>
    `${strip.key}:${index}`;

  const fractionFrom = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
  };

  return (
    // The strips size themselves, so the area adds no box of its own and
    // takes no height from the player above it.
    <PlotTooltipArea className="contents" taps={tooltipTaps}>
      <div ref={stripsRef} className="flex flex-col gap-1 select-none">
        {strips.map((strip) => {
          const hovered =
            hover !== null && hover.key === strip.key ? hover : null;
          return (
            <div
              key={strip.key}
              role="img"
              aria-label={`${strip.title} usage`}
              className="relative rounded-md border border-border cursor-pointer touch-none"
              style={{ height: laneHeight }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") {
                  setHover(null);
                }
              }}
              onPointerMove={(event) =>
                setHover({
                  key: strip.key,
                  index: nearestTo(strip, fractionFrom(event)),
                })
              }
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                const fraction = fractionFrom(event);
                const index = nearestTo(strip, fraction);
                if (!tooltipTaps.shouldAct(pointTapKey(strip, index))) {
                  setHover({ key: strip.key, index });
                  return;
                }
                onSeek(fraction * durationMs);
              }}
            >
              <svg
                viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                preserveAspectRatio="none"
                className="block w-full h-full"
              >
                {seriesLines.get(strip.key)}
                {hovered !== null && (
                  <line
                    x1={xFor(strip.times[hovered.index].absMs)}
                    x2={xFor(strip.times[hovered.index].absMs)}
                    y1={0}
                    y2={plotHeight}
                    stroke="currentColor"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    className="text-foreground/40"
                  />
                )}
                <MetricsPlayheadLine
                  actor={actor}
                  startAbsMs={startAbsMs}
                  xFor={xFor}
                />
              </svg>

              <p className="absolute top-0.5 left-1.5 text-[10px] leading-none text-muted-foreground pointer-events-none">
                {strip.title}
              </p>

              {hovered !== null && (
                <PlotTooltip
                  className="px-4 py-2"
                  tapKey={pointTapKey(strip, hovered.index)}
                >
                  <p>
                    Time:{" "}
                    {formatChartFormatTimestampToHumanReadable(
                      formatTimestampToChartFormat(
                        strip.times[hovered.index].iso,
                      ),
                    )}
                  </p>
                  {strip.series
                    .filter((series) => series.values[hovered.index] !== null)
                    .map((series) => (
                      <div
                        key={series.label}
                        className="flex flex-row items-center gap-2 mt-2"
                      >
                        <PlotTooltipSwatch color={series.color} />
                        <p>
                          {series.label}:{" "}
                          {series.values[hovered.index]!.toFixed(2)}
                          {strip.unit === "%" ? "%" : ` ${strip.unit}`}
                        </p>
                      </div>
                    ))}
                </PlotTooltip>
              )}
            </div>
          );
        })}
      </div>
    </PlotTooltipArea>
  );
});
