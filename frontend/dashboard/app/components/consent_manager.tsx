"use client";

import {
  ConsentBanner,
  ConsentDialog,
  ConsentManagerProvider,
  policyPackPresets,
  type Theme,
} from "@c15t/nextjs";
import { googleTagManager } from "@c15t/scripts/google-tag-manager";
import { PostHogProvider } from "../context/posthog";
import { isCloud } from "../utils/env_utils";
import { buttonVariants } from "./button_variants";

// Flip to true to run c15t offline (no backend) for local testing — the
// jurisdiction then comes from the `overrides` set below. Keep false on
// committed builds.
export const offlineMode = false;

// c15t runs in offline mode, or in cloud with a backend URL configured.
// Otherwise (self-host, or a cloud build with no backend URL) it is not run.
export function isConsentManaged(): boolean {
  return (
    offlineMode ||
    (isCloud() && Boolean(process.env.NEXT_PUBLIC_C15T_BACKEND_URL))
  );
}

// Measure's design tokens for the c15t consent UI. Every value is a CSS
// variable from globals.css; those are already redefined under `.dark`, so the
// same set drives both schemes. Passing `dark` explicitly stops c15t falling
// back to its own dark palette; only the switch thumb needs a distinct dark
// value so it stays light against the dark track.
const measureColors = {
  primary: "var(--primary)",
  primaryHover: "var(--primary)",
  textOnPrimary: "var(--primary-foreground)",
  surface: "var(--popover)",
  surfaceHover: "var(--muted)",
  border: "var(--border)",
  borderHover: "var(--border)",
  text: "var(--popover-foreground)",
  textMuted: "var(--muted-foreground)",
  switchTrack: "var(--input)",
  switchTrackActive: "var(--primary)",
  switchThumb: "var(--background)",
};

// Styles the c15t legal-link anchors so only the underline sets them apart:
// `[font:inherit]` + `text-inherit` make them match the surrounding text's
// type, size and colour; the underline is `underlineLinkStyle`
// (shared_styles.tsx). `[&_a]`-scoped — the anchors share the description slot.
const legalLinkClasses =
  "[&_a]:[font:inherit] [&_a]:text-inherit [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-2 [&_a]:decoration-amber-300 [&_a:hover]:decoration-amber-400";

const measureTheme = {
  colors: measureColors,
  dark: { ...measureColors, switchThumb: "var(--foreground)" },
  radius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
  },
  typography: { fontFamily: "var(--font-work-sans)" },
  slots: {
    consentBannerTitle: "font-display",
    consentDialogTitle: "font-display",
    // c15t renders the legal links inside the description, sharing its slot —
    // legalLinkClasses scopes the underline to the `<a>`s only.
    consentBannerDescription: legalLinkClasses,
    consentDialogDescription: legalLinkClasses,
    // Reuse the dashboard's button styling. c15t keeps its own `.button`
    // classes regardless of the slot, but they sit in `@layer components` so
    // the app's utility classes win; border overrides cancel c15t's base
    // border and its default stroke-mode inset shadow.
    buttonPrimary: `${buttonVariants({ variant: "default" })} border-0 shadow-none`,
    buttonSecondary: `${buttonVariants({ variant: "secondary" })} border-0.5 shadow-none`,
    // c15t's switch is sized from CSS variables on its root — override them to
    // match the dashboard switch (track 1.15rem x 2rem, thumb 1rem).
    toggle: {
      style: {
        "--switch-height": "1.15rem",
        "--switch-width": "2rem",
        "--switch-thumb-size": "1rem",
        "--switch-padding": "0.075rem",
      },
    },
  },
} satisfies Theme;

// In offline mode, without local policy packs c15t always shows the opt-in
// banner. These presets carry the jurisdiction rules so the `overrides`
// country/region resolves to a real policy (GDPR / CCPA / …). In production
// the hosted backend handles this resolution instead.
const offlinePolicyPacks = [
  policyPackPresets.europeOptIn(),
  policyPackPresets.californiaOptOut(),
  policyPackPresets.quebecOptIn(),
  policyPackPresets.worldNoBanner(),
];

export function ConsentManager({ children }: { children: React.ReactNode }) {
  const backendURL = process.env.NEXT_PUBLIC_C15T_BACKEND_URL;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  // How c15t initialises. Offline mode runs it with no backend and a fixed
  // jurisdiction (from `overrides`); otherwise it runs hosted, but only in
  // cloud with a backend URL. Anything else — self-host, or a cloud build not
  // pointed at a backend — gets no c15t at all: no banner, no link, no trackers.
  let init:
    | { mode: "offline"; overrides: { country: string; region?: string } }
    | { mode: "hosted"; backendURL: string };
  if (offlineMode) {
    // Jurisdiction to test: { country: "DE" } → GDPR (opt-in),
    // { country: "US", region: "CA" } → CCPA (opt-out), { country: "GB" } → UK.
    init = { mode: "offline", overrides: { country: "DE" } };
  } else if (isCloud() && backendURL) {
    init = { mode: "hosted", backendURL };
  } else {
    return <>{children}</>;
  }

  return (
    <ConsentManagerProvider
      options={{
        ...init,
        // Offline mode needs the jurisdiction rules locally; the hosted backend
        // supplies them in production.
        ...(offlineMode
          ? { offlinePolicy: { policyPacks: offlinePolicyPacks } }
          : {}),
        consentCategories: ["necessary", "measurement", "marketing"],
        theme: measureTheme,
        legalLinks: {
          privacyPolicy: { href: "/privacy-policy", target: "_self" },
        },
        // GTM runs only in cloud and only if its container ID is set; c15t's
        // Consent Mode v2 then gates its tags on marketing consent. Must be an
        // array even when empty — c15t's script loader iterates it unguarded.
        scripts: isCloud() && gtmId ? [googleTagManager({ id: gtmId })] : [],
      }}
    >
      {/* legalLinks must be an explicit array — c15t 2.1.0 renders no links
          for the documented `undefined` default. URL comes from the provider's
          `legalLinks` option above. */}
      <ConsentBanner legalLinks={["privacyPolicy"]} />
      <ConsentDialog legalLinks={["privacyPolicy"]} />
      <PostHogProvider proxyPath="/yrtmlt">{children}</PostHogProvider>
    </ConsentManagerProvider>
  );
}
