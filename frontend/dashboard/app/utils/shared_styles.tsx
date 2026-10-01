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
