import { useTheme } from "next-themes";
import { useMemo } from "react";

export const CHART_TEXT_SIZE = 11;
export const CHART_TICK_SIZE = 5;
export const CHART_TICK_PADDING = 8;
const CHART_AXIS_TITLE_GAP = 32;
// Fits a four-character count label like "150K".
export const COUNT_TICK_LABEL_WIDTH = 26;
export const CHART_VALUE_TICK_COUNT = 5;
export const CHART_GRID_DOT_SIZE = 2;
const CHART_GRID_OPACITY_LIGHT = 0.3;
const CHART_GRID_OPACITY_DARK = 0.1;
const CHART_GRID_DOTS_PER_TICK = 4;

// Tailwind -400 shades in both themes, matching the `--chart-*` tokens in
// globals.css so charts and Tailwind `bg-chart-*` classes show the same colors.
// The values are hex because nivo computes lighter and darker shades of a
// series color, which it cannot do from a CSS variable. Use
// `useChartColor().<name>` when a color stands for something, such as crashes
// or 5xx responses, and `useChartColors()` for series in order.
const chartColor = {
  blue: "#38bdf8", // sky-400
  amber: "#fbbf24", // amber-400
  violet: "#a78bfa", // violet-400
  green: "#34d399", // emerald-400
  pink: "#f472b6", // pink-400
  teal: "#2dd4bf", // teal-400
  red: "#f87171", // red-400
  yellow: "#facc15", // yellow-400
} as const;

// Callers use this array as a memo dependency, and a fresh array on every
// call would recompute every memo that depends on it, so one instance is
// built and shared.
const chartColors = Object.values(chartColor);

export function useChartColor() {
  return chartColor;
}

export function useChartColors() {
  return chartColors;
}

export const chartTheme = {
  text: {
    fill: "var(--foreground)",
    fontSize: CHART_TEXT_SIZE,
  },
  axis: {
    ticks: {
      text: {
        fill: "var(--muted-foreground)",
      },
    },
  },
};

// Canvas cannot resolve the CSS variables in chartTheme, so canvas charts get
// the `--foreground` and `--muted-foreground` values from globals.css as hex;
// keep the two in sync.
export function useChartCanvasTheme() {
  const { resolvedTheme } = useTheme();
  const foreground = resolvedTheme === "dark" ? "#fafafa" : "#222222";
  const mutedForeground = resolvedTheme === "dark" ? "#a1a1a1" : "#6b6b6b";
  return useMemo(
    () => ({
      text: { fill: foreground, fontSize: CHART_TEXT_SIZE },
      axis: { ticks: { text: { fill: mutedForeground } } },
    }),
    [foreground, mutedForeground],
  );
}

export function useChartGridOpacity() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark"
    ? CHART_GRID_OPACITY_DARK
    : CHART_GRID_OPACITY_LIGHT;
}

export function chartAxisMargin(tickLabelSize: number, hasTitle: boolean) {
  const tickLabels = CHART_TICK_SIZE + CHART_TICK_PADDING + tickLabelSize;
  return hasTitle
    ? tickLabels + CHART_AXIS_TITLE_GAP + CHART_TEXT_SIZE
    : tickLabels;
}

// Every tick gets a dot so the grid lines up with the axis labels, and the dots
// continue past the first and last ticks because an axis rarely starts or ends
// on a tick.
export function gridDotPositions(tickPositions: number[], axisLength: number) {
  const ticks = [...tickPositions].sort((a, b) => a - b);
  if (ticks.length < 2) {
    return ticks;
  }
  const positions: number[] = [];
  const firstStep = (ticks[1] - ticks[0]) / CHART_GRID_DOTS_PER_TICK;
  const lastStep = (ticks.at(-1)! - ticks.at(-2)!) / CHART_GRID_DOTS_PER_TICK;
  if (firstStep <= 0 || lastStep <= 0) {
    return ticks;
  }
  // Tick positions carry floating point error, which would otherwise leave out
  // the dot at an end of the axis.
  const tolerance = 0.5;
  for (let p = ticks[0] - firstStep; p >= -tolerance; p -= firstStep) {
    positions.push(p);
  }
  for (let i = 0; i < ticks.length - 1; i++) {
    const step = (ticks[i + 1] - ticks[i]) / CHART_GRID_DOTS_PER_TICK;
    for (let j = 0; j < CHART_GRID_DOTS_PER_TICK; j++) {
      positions.push(ticks[i] + step * j);
    }
  }
  for (let p = ticks.at(-1)!; p <= axisLength + tolerance; p += lastStep) {
    positions.push(p);
  }
  return positions;
}
