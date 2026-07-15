// Mirrors the docs prose links (fumadocs typography plus our fd-primary
// override in globals.css): same decoration pair, thickness, offset, weight
// and fade-on-hover, so links look the same on marketing and docs pages.
export const underlineLinkStyle =
  "underline decoration-[1.5px] underline-offset-[3.5px] decoration-green-700 dark:decoration-green-400 hover:opacity-80 transition-opacity duration-200";

// Amber warning callout for inline notices, such as the cross-platform note in
// onboarding and the Slack reconnect prompt. Callers add their own layout
// classes (flex, spacing) alongside it.
export const warningCalloutStyle =
  "font-body border border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-950 dark:text-amber-400 dark:bg-amber-950/40 p-4 rounded-md";

// Shared palette for charts: Tailwind -400 in both themes, matching the
// `--chart-*` tokens in globals.css, the pill/trace ladder, and the hero
// animation. Use `useChartColor().<name>` for semantic mappings (Sessions
// vs Crashes vs ANRs, 2xx vs 5xx, etc.) and `useChartColors()` (array) for
// sequential series.
//
// Returns concrete hex so Nivo's internal chroma-based derivations (area
// opacity, point border darken, etc.) work; the matching `--chart-*` CSS
// variables exist so Tailwind `bg-chart-*` / `border-chart-*` classes work
// in CSS-only contexts (e.g. trace).
const chartColor = {
  blue: "#38bdf8", // sky-400
  green: "#34d399", // emerald-400
  amber: "#fbbf24", // amber-400
  violet: "#a78bfa", // violet-400
  pink: "#f472b6", // pink-400
  teal: "#2dd4bf", // teal-400
  red: "#f87171", // red-400
  yellow: "#facc15", // yellow-400
} as const;

export function useChartColor() {
  return chartColor;
}

export function useChartColors() {
  return Object.values(chartColor);
}

export const chartTheme = {
  text: {
    fill: "var(--foreground)",
  },
  axis: {
    ticks: {
      text: {
        fill: "var(--foreground)",
      },
    },
  },
  legends: {
    text: {
      fill: "var(--foreground)",
    },
  },
  crosshair: {
    line: {
      stroke: "var(--foreground)",
      strokeWidth: 1,
    },
  },
};
